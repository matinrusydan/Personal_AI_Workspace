import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';
import {
  sealIntegrationSecret,
  openIntegrationSecret,
  hashIntegrationToken,
} from '../src/modules/integrations/token-crypto';

const db = vi.hoisted(() => ({
  connectedAccount: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  oAuthTransaction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  telegramPairingChallenge: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@paw/database', () => ({ prisma: db }));

describe('IntegrationsService (Isolated Unit Tests)', () => {
  const ownerId = '11111111-1111-1111-1111-111111111111';
  const sessionId = '22222222-2222-2222-2222-222222222222';
  let service: IntegrationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-secret');
    vi.stubEnv('ZOOM_CLIENT_ID', 'test-zoom-id');
    vi.stubEnv('ZOOM_CLIENT_SECRET', 'test-zoom-secret');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123456789:TEST_BOT_TOKEN');
    vi.stubEnv('TELEGRAM_OWNER_USER_ID', '99887766');
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');

    service = new IntegrationsService();
  });

  describe('Token Crypto (AES-256-GCM)', () => {
    it('encrypts and decrypts secrets with context-specific AAD', () => {
      const plaintext = 'ya29.sensitive-google-access-token';
      const aad = 'owner-1|google|acc-1|access';

      const sealed = sealIntegrationSecret(plaintext, aad);
      expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      const opened = openIntegrationSecret(sealed, aad);
      expect(opened).toBe(plaintext);
    });

    it('rejects decryption when AAD does not match', () => {
      const plaintext = 'sensitive-token';
      const sealed = sealIntegrationSecret(plaintext, 'owner-1|google|acc-1|access');

      expect(() => {
        openIntegrationSecret(sealed, 'different-owner|google|acc-1|access');
      }).toThrow();
    });
  });

  describe('listStatuses', () => {
    it('returns statuses from database without calling external network', async () => {
      const globalFetchSpy = vi.spyOn(globalThis, 'fetch');
      db.connectedAccount.findMany.mockResolvedValueOnce([
        {
          provider: 'google',
          status: 'CONNECTED',
          displayName: 'John Doe',
          email: 'johndoe@gmail.com',
          lastVerifiedAt: new Date('2026-10-30T10:00:00Z'),
        },
      ]);

      const res = await service.listStatuses(ownerId);
      expect(res.data).toHaveLength(3);

      const google = res.data.find((d) => d.provider === 'google');
      expect(google?.status).toBe('CONNECTED');
      expect(google?.account?.email).toBe('johndoe@gmail.com');

      const zoom = res.data.find((d) => d.provider === 'zoom');
      expect(zoom?.status).toBe('DISCONNECTED'); // Configured in env, not in DB

      // CRITICAL ASSERTION: ZERO EXTERNAL CALLS!
      expect(globalFetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('startOAuth', () => {
    it('creates single-use state and pending transaction', async () => {
      db.oAuthTransaction.create.mockResolvedValueOnce({});

      const res = await service.startOAuth(ownerId, sessionId, 'google');
      expect(res.data.authorizationUrl).toContain('accounts.google.com');
      expect(res.data.bindingToken).toBeDefined();
      expect(res.data.transactionId).toBeDefined();

      expect(db.oAuthTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId,
            sessionId,
            provider: 'google',
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('stageOAuthCallback', () => {
    it('verifies state & Lax binding token, then stages encrypted code', async () => {
      const state = 'oauth-state-xyz';
      const bindingToken = 'lax-binding-abc';
      const transactionId = 'tx-123';
      const stateHash = hashIntegrationToken(state, 'oauth_state');
      const bindingHash = hashIntegrationToken(bindingToken, 'oauth_binding');

      db.oAuthTransaction.findFirst.mockResolvedValueOnce({
        id: transactionId,
        provider: 'google',
        stateHash,
        bindingHash,
        status: 'PENDING',
        session: { revokedAt: null, expiresAt: new Date(Date.now() + 3600_000) },
      });
      db.oAuthTransaction.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await service.stageOAuthCallback('google', transactionId, bindingToken, state, 'auth-code-123');
      expect(res.data.flowId).toBe(transactionId);
      expect(db.oAuthTransaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: transactionId, status: 'PENDING' },
          data: expect.objectContaining({ status: 'STAGED' }),
        }),
      );
    });

    it('rejects if state or binding token does not match', async () => {
      db.oAuthTransaction.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.stageOAuthCallback('google', 'tx-123', 'wrong-binding', 'state-xyz', 'code-123'),
      ).rejects.toThrow();
    });
  });

  describe('completeOAuth', () => {
    it('verifies original session, exchanges code, verifies scopes, and saves account', async () => {
      const flowId = 'tx-123';
      const codeCiphertext = sealIntegrationSecret('raw-code-789', `${flowId}|code`);

      db.oAuthTransaction.findFirst.mockResolvedValueOnce({
        id: flowId,
        ownerId,
        sessionId,
        provider: 'google',
        status: 'STAGED',
        codeCiphertext,
        redirectUri: 'http://localhost:3000/api/integrations/google/callback',
      });
      db.oAuthTransaction.update.mockResolvedValueOnce({});

      // Mock Google provider methods
      const googleProvider = service.getGoogleProvider();
      vi.spyOn(googleProvider, 'exchangeCode').mockResolvedValueOnce({
        accessToken: 'access-token-111',
        refreshToken: 'refresh-token-222',
        expiresIn: 3600,
        scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
      });
      vi.spyOn(googleProvider, 'fetchUserProfile').mockResolvedValueOnce({
        sub: 'google-sub-999',
        email: 'matin@workspace.test',
        name: 'Matin Rusydan',
      });
      vi.spyOn(googleProvider, 'testCalendarAccess').mockResolvedValueOnce({ calendarCount: 3 });

      db.connectedAccount.upsert.mockResolvedValueOnce({
        id: 'acc-google-1',
        displayName: 'Matin Rusydan',
        email: 'matin@workspace.test',
      });

      const res = await service.completeOAuth(ownerId, sessionId, 'google', flowId);
      expect(res.data.success).toBe(true);
      expect(res.data.account.email).toBe('matin@workspace.test');

      expect(db.connectedAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: 'google',
            externalSubject: 'google-sub-999',
            status: 'CONNECTED',
          }),
        }),
      );
    });

    it('rejects if granular calendar scopes were not approved by user', async () => {
      const flowId = 'tx-123';
      const codeCiphertext = sealIntegrationSecret('raw-code-789', `${flowId}|code`);

      db.oAuthTransaction.findFirst.mockResolvedValueOnce({
        id: flowId,
        ownerId,
        sessionId,
        provider: 'google',
        status: 'STAGED',
        codeCiphertext,
        redirectUri: 'http://localhost:3000/api/integrations/google/callback',
      });
      db.oAuthTransaction.update.mockResolvedValueOnce({});

      const googleProvider = service.getGoogleProvider();
      vi.spyOn(googleProvider, 'exchangeCode').mockResolvedValueOnce({
        accessToken: 'access-token-111',
        expiresIn: 3600,
        scope: 'openid email', // Missing calendar scopes!
      });

      await expect(
        service.completeOAuth(ownerId, sessionId, 'google', flowId),
      ).rejects.toThrow(/granular permissions/);
    });
  });

  describe('Telegram Pairing & Testing', () => {
    it('creates pairing challenge with deep link and manual code', async () => {
      const telegramClient = service.getTelegramClient();
      vi.spyOn(telegramClient, 'getMe').mockResolvedValueOnce({
        id: 123456789,
        is_bot: true,
        first_name: 'PAW Bot',
        username: 'PersonalAIBot',
      });
      db.telegramPairingChallenge.create.mockResolvedValueOnce({});

      const res = await service.createTelegramPairingChallenge(ownerId, sessionId);
      expect(res.data.deepLink).toContain('https://t.me/PersonalAIBot?start=pair_');
      expect(res.data.manualCode).toMatch(/^pair_[a-f0-9]{32}$/);
      expect(res.data.botUsername).toBe('PersonalAIBot');
    });

    it('pairs account on /start command from private chat and allowlisted sender', async () => {
      const manualCode = 'pair_testcode123';
      const tokenHash = hashIntegrationToken(manualCode, 'telegram_pair');

      db.telegramPairingChallenge.findUnique.mockResolvedValueOnce({
        id: 'challenge-1',
        ownerId,
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600_000),
      });
      db.telegramPairingChallenge.update.mockResolvedValueOnce({});
      db.connectedAccount.upsert.mockResolvedValueOnce({});

      const reply = await service.handleTelegramStartCommand(
        '123456789',
        99887766, // Matches TELEGRAM_OWNER_USER_ID
        99887766,
        'private',
        manualCode,
      );

      expect(reply).toContain('Berhasil! Akun Telegram Anda telah terpasang');
      expect(db.connectedAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: 'telegram',
            externalSubject: '99887766',
            telegramChatId: '99887766',
            status: 'CONNECTED',
          }),
        }),
      );
    });

    it('rejects pairing from non-allowlisted sender', async () => {
      const reply = await service.handleTelegramStartCommand(
        '123456789',
        11223344, // Intruder ID!
        11223344,
        'private',
        'pair_testcode123',
      );

      expect(reply).toContain('Akses ditolak');
      expect(db.connectedAccount.upsert).not.toHaveBeenCalled();
    });

    it('sends real test message to paired chat and updates lastTestedAt', async () => {
      db.connectedAccount.findFirst.mockResolvedValueOnce({
        id: 'acc-tg-1',
        ownerId,
        provider: 'telegram',
        status: 'CONNECTED',
        telegramChatId: '99887766',
      });
      db.connectedAccount.update.mockResolvedValueOnce({});

      const telegramClient = service.getTelegramClient();
      vi.spyOn(telegramClient, 'sendMessage').mockResolvedValueOnce({
        message_id: 42,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 99887766, type: 'private' },
      });

      const res = await service.testConnection(ownerId, 'telegram');
      expect(res.data.success).toBe(true);
      expect(res.data.message).toContain('ID pesan: 42');
      expect(telegramClient.sendMessage).toHaveBeenCalledWith('99887766', expect.stringContaining('Personal AI Workspace: Uji koneksi'));
      expect(db.connectedAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-tg-1' },
          data: expect.objectContaining({ lastTestedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
