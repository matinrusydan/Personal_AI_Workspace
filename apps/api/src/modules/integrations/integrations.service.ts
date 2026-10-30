import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@paw/database';
import { ServerEnvSchema } from '@paw/config';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { ZoomOAuthProvider } from './providers/zoom-oauth.provider';
import { TelegramBotClient } from '../telegram/telegram-bot.client';
import {
  sealIntegrationSecret,
  openIntegrationSecret,
  generateOpaqueToken,
  hashIntegrationToken,
} from './token-crypto';
import { randomBytes, randomUUID } from 'crypto';

export type IntegrationProviderName = 'google' | 'zoom' | 'telegram';

@Injectable()
export class IntegrationsService {
  private readonly config = ServerEnvSchema.parse(process.env);
  private readonly googleProvider: GoogleOAuthProvider;
  private readonly zoomProvider: ZoomOAuthProvider;
  private readonly telegramClient: TelegramBotClient;

  constructor() {
    this.googleProvider = new GoogleOAuthProvider(
      this.config.GOOGLE_CLIENT_ID || '',
      this.config.GOOGLE_CLIENT_SECRET || '',
    );
    this.zoomProvider = new ZoomOAuthProvider(
      this.config.ZOOM_CLIENT_ID || '',
      this.config.ZOOM_CLIENT_SECRET || '',
    );
    this.telegramClient = new TelegramBotClient(this.config.TELEGRAM_BOT_TOKEN);
  }

  // Helper getters for testing
  getGoogleProvider() {
    return this.googleProvider;
  }
  getZoomProvider() {
    return this.zoomProvider;
  }
  getTelegramClient() {
    return this.telegramClient;
  }

  /**
   * Returns authoritative connection status for all providers.
   * STRICT REQUIREMENT: Performs ZERO external HTTP calls. Reads only DB and config.
   */
  async listStatuses(ownerId: string) {
    const accounts = await prisma.connectedAccount.findMany({
      where: { ownerId },
    });

    const googleAcc = accounts.find((a) => a.provider === 'google');
    const zoomAcc = accounts.find((a) => a.provider === 'zoom');
    const telegramAcc = accounts.find((a) => a.provider === 'telegram');

    const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';

    return {
      data: [
        this.formatStatus('google', this.googleProvider.isConfigured(), googleAcc, 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET diperlukan di .env'),
        this.formatStatus('zoom', this.zoomProvider.isConfigured(), zoomAcc, 'ZOOM_CLIENT_ID dan ZOOM_CLIENT_SECRET diperlukan di .env'),
        this.formatStatus('telegram', this.telegramClient.isConfigured(), telegramAcc, 'TELEGRAM_BOT_TOKEN diperlukan di .env'),
      ],
      meta: { appOrigin },
    };
  }

  private formatStatus(
    provider: IntegrationProviderName,
    configured: boolean,
    account?: any,
    guidance?: string,
  ) {
    if (!configured && !account) {
      return {
        provider,
        status: 'NOT_CONFIGURED',
        account: null,
        configGuidance: guidance,
      };
    }

    if (!account || account.status === 'DISCONNECTED') {
      return {
        provider,
        status: configured ? 'DISCONNECTED' : 'NOT_CONFIGURED',
        account: null,
        configGuidance: configured ? null : guidance,
      };
    }

    return {
      provider,
      status: account.status || 'CONNECTED',
      account: {
        displayName: account.displayName,
        email: account.email,
        username: account.username,
      },
      lastVerifiedAt: account.lastVerifiedAt?.toISOString() || null,
      lastTestedAt: account.lastTestedAt?.toISOString() || null,
      error: account.lastErrorCode ? { code: account.lastErrorCode, message: 'Perlu verifikasi ulang' } : null,
    };
  }

  /**
   * Initiates OAuth flow: creates transaction with single-use state & Lax binding token.
   */
  async startOAuth(ownerId: string, sessionId: string, provider: 'google' | 'zoom') {
    const isGoogle = provider === 'google';
    const providerInstance = isGoogle ? this.googleProvider : this.zoomProvider;

    if (!providerInstance.isConfigured()) {
      throw new BadRequestException(`Kredensial untuk ${provider} belum dikonfigurasi di server`);
    }

    const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
    const redirectUri = `${appOrigin}/api/integrations/${provider}/callback`;

    const state = generateOpaqueToken(32);
    const bindingToken = generateOpaqueToken(32);
    const stateHash = hashIntegrationToken(state, 'oauth_state');
    const bindingHash = hashIntegrationToken(bindingToken, 'oauth_binding');
    const transactionId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.oAuthTransaction.create({
      data: {
        id: transactionId,
        ownerId,
        sessionId,
        provider,
        stateHash,
        bindingHash,
        redirectUri,
        expiresAt,
        status: 'PENDING',
      },
    });

    const authorizationUrl = providerInstance.buildAuthorizationUrl(redirectUri, state);

    return {
      data: {
        authorizationUrl,
        bindingToken,
        transactionId,
      },
    };
  }

  /**
   * Called by the Next.js callback handler. Validates state and Lax binding, stages the code.
   * NEVER attaches the account at this point.
   */
  async stageOAuthCallback(
    provider: string,
    transactionId: string,
    bindingToken: string,
    state: string,
    code: string,
  ) {
    if (!['google', 'zoom'].includes(provider)) {
      throw new BadRequestException('Provider tidak didukung');
    }

    const stateHash = hashIntegrationToken(state, 'oauth_state');
    const bindingHash = hashIntegrationToken(bindingToken, 'oauth_binding');

    const tx = await prisma.oAuthTransaction.findFirst({
      where: {
        id: transactionId,
        provider,
        stateHash,
        bindingHash,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: { session: true },
    });

    if (!tx || !tx.session || tx.session.revokedAt !== null || tx.session.expiresAt <= new Date()) {
      throw new BadRequestException('Sesi otorisasi OAuth tidak valid, kedaluwarsa, atau dibatalkan');
    }

    // Encrypt the code before staging
    const codeCiphertext = sealIntegrationSecret(code, `${tx.id}|code`);

    const updated = await prisma.oAuthTransaction.updateMany({
      where: { id: tx.id, status: 'PENDING' },
      data: {
        status: 'STAGED',
        codeCiphertext,
        consumedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new BadRequestException('Transaksi OAuth telah digunakan');
    }

    return {
      data: { flowId: tx.id },
    };
  }

  /**
   * Called by same-origin continuation document carrying the original SameSite=Strict session!
   * Redeems staged code, verifies scopes and identity, encrypts and stores account.
   */
  async completeOAuth(ownerId: string, sessionId: string, provider: 'google' | 'zoom', flowId: string) {
    const tx = await prisma.oAuthTransaction.findFirst({
      where: {
        id: flowId,
        ownerId,
        sessionId,
        provider,
        status: 'STAGED',
        expiresAt: { gt: new Date() },
      },
    });

    if (!tx || !tx.codeCiphertext) {
      throw new ForbiddenException('Transaksi OAuth tidak sah atau tidak ditemukan untuk sesi ini');
    }

    // Mark completed atomically before network operations to prevent replay
    await prisma.oAuthTransaction.update({
      where: { id: tx.id },
      data: { status: 'COMPLETED' },
    });

    const code = openIntegrationSecret(tx.codeCiphertext, `${tx.id}|code`);
    const isGoogle = provider === 'google';

    if (isGoogle) {
      const tokens = await this.googleProvider.exchangeCode(code, tx.redirectUri);
      if (!this.googleProvider.validateScopes(tokens.scope)) {
        throw new BadRequestException('Izin kalender yang diperlukan tidak disetujui (granular permissions)');
      }

      const profile = await this.googleProvider.fetchUserProfile(tokens.accessToken);
      await this.googleProvider.testCalendarAccess(tokens.accessToken);

      const accessTokenCiphertext = sealIntegrationSecret(tokens.accessToken, `${ownerId}|google|${profile.sub}|access`);
      const refreshTokenCiphertext = tokens.refreshToken
        ? sealIntegrationSecret(tokens.refreshToken, `${ownerId}|google|${profile.sub}|refresh`)
        : undefined;

      const account = await prisma.connectedAccount.upsert({
        where: {
          ownerId_provider_externalSubject: {
            ownerId,
            provider: 'google',
            externalSubject: profile.sub,
          },
        },
        create: {
          ownerId,
          provider: 'google',
          externalSubject: profile.sub,
          displayName: profile.name || profile.email,
          email: profile.email,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
          accessTokenCiphertext,
          refreshTokenCiphertext,
          scopes: tokens.scope.split(/\s+/),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
        update: {
          displayName: profile.name || profile.email,
          email: profile.email,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
          accessTokenCiphertext,
          ...(refreshTokenCiphertext ? { refreshTokenCiphertext } : {}),
          scopes: tokens.scope.split(/\s+/),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          lastErrorCode: null,
        },
      });

      return {
        data: {
          success: true,
          provider: 'google',
          account: { displayName: account.displayName, email: account.email },
        },
      };
    } else {
      const tokens = await this.zoomProvider.exchangeCode(code, tx.redirectUri);
      const profile = await this.zoomProvider.fetchUserProfile(tokens.accessToken);

      const accessTokenCiphertext = sealIntegrationSecret(tokens.accessToken, `${ownerId}|zoom|${profile.id}|access`);
      const refreshTokenCiphertext = tokens.refreshToken
        ? sealIntegrationSecret(tokens.refreshToken, `${ownerId}|zoom|${profile.id}|refresh`)
        : undefined;

      const account = await prisma.connectedAccount.upsert({
        where: {
          ownerId_provider_externalSubject: {
            ownerId,
            provider: 'zoom',
            externalSubject: profile.id,
          },
        },
        create: {
          ownerId,
          provider: 'zoom',
          externalSubject: profile.id,
          displayName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
          email: profile.email,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
          accessTokenCiphertext,
          refreshTokenCiphertext,
          scopes: tokens.scope.split(/\s+/),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
        update: {
          displayName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
          email: profile.email,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
          accessTokenCiphertext,
          ...(refreshTokenCiphertext ? { refreshTokenCiphertext } : {}),
          scopes: tokens.scope.split(/\s+/),
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          lastErrorCode: null,
        },
      });

      return {
        data: {
          success: true,
          provider: 'zoom',
          account: { displayName: account.displayName, email: account.email },
        },
      };
    }
  }

  /**
   * Tests connection with live provider API and updates lastTestedAt.
   */
  async testConnection(ownerId: string, provider: IntegrationProviderName) {
    const account = await prisma.connectedAccount.findFirst({
      where: { ownerId, provider, status: 'CONNECTED' },
    });

    if (!account) {
      throw new BadRequestException(`Akun ${provider} belum terhubung atau belum aktif`);
    }

    let message = 'Koneksi berhasil diverifikasi';
    const now = new Date();

    if (provider === 'google') {
      const accessToken = await this.getValidAccessToken(account);
      const res = await this.googleProvider.testCalendarAccess(accessToken);
      message = `Berhasil terhubung. Ditemukan ${res.calendarCount} kalender.`;
    } else if (provider === 'zoom') {
      const accessToken = await this.getValidAccessToken(account);
      const profile = await this.zoomProvider.fetchUserProfile(accessToken);
      message = `Berhasil terhubung ke akun Zoom (${profile.email}).`;
    } else if (provider === 'telegram') {
      if (!account.telegramChatId) {
        throw new BadRequestException('Bot Telegram belum dipasangkan dengan chat pribadi pemilik');
      }
      const text = `Personal AI Workspace: Uji koneksi bot berhasil terverifikasi pada ${now.toLocaleTimeString('id-ID')} WIB.`;
      const sent = await this.telegramClient.sendMessage(account.telegramChatId, text);
      message = `Pesan uji coba terkirim ke Telegram (ID pesan: ${sent.message_id}).`;
    }

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { lastTestedAt: now, lastErrorCode: null },
    });

    return {
      data: {
        success: true,
        message,
        verifiedAt: now.toISOString(),
      },
    };
  }

  /**
   * Helper to resolve access token and refresh automatically if expired
   */
  private async getValidAccessToken(account: any): Promise<string> {
    const aad = `${account.ownerId}|${account.provider}|${account.externalSubject}|access`;
    let accessToken: string | null = null;

    if (account.accessTokenCiphertext) {
      try {
        accessToken = openIntegrationSecret(account.accessTokenCiphertext, aad);
      } catch {
        accessToken = null;
      }
    }

    const isExpired = !account.expiresAt || account.expiresAt.getTime() - Date.now() < 60_000;
    if (accessToken && !isExpired) {
      return accessToken;
    }

    // Attempt refresh if refresh token is present
    if (!account.refreshTokenCiphertext) {
      throw new UnauthorizedException('Token kedaluwarsa dan tidak ada refresh token. Silakan sambungkan ulang.');
    }

    const refreshAad = `${account.ownerId}|${account.provider}|${account.externalSubject}|refresh`;
    const refreshToken = openIntegrationSecret(account.refreshTokenCiphertext, refreshAad);

    if (account.provider === 'google') {
      const refreshed = await this.googleProvider.refreshAccessToken(refreshToken);
      const newAccessCipher = sealIntegrationSecret(refreshed.accessToken, aad);

      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessTokenCiphertext: newAccessCipher,
          expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          lastErrorCode: null,
        },
      });

      return refreshed.accessToken;
    } else if (account.provider === 'zoom') {
      const refreshed = await this.zoomProvider.refreshAccessToken(refreshToken);
      const newAccessCipher = sealIntegrationSecret(refreshed.accessToken, aad);
      const newRefreshCipher = refreshed.refreshToken
        ? sealIntegrationSecret(refreshed.refreshToken, refreshAad)
        : undefined;

      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessTokenCiphertext: newAccessCipher,
          ...(newRefreshCipher ? { refreshTokenCiphertext: newRefreshCipher } : {}),
          expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          lastErrorCode: null,
        },
      });

      return refreshed.accessToken;
    }

    throw new BadRequestException('Penyegaran token tidak didukung untuk provider ini');
  }

  /**
   * Disconnects integration locally and revokes tokens at provider
   */
  async disconnect(ownerId: string, provider: IntegrationProviderName) {
    const account = await prisma.connectedAccount.findFirst({
      where: { ownerId, provider },
    });

    if (account) {
      // Best-effort remote revocation
      if (account.provider === 'google' && account.accessTokenCiphertext) {
        try {
          const token = openIntegrationSecret(account.accessTokenCiphertext, `${ownerId}|google|${account.externalSubject}|access`);
          await this.googleProvider.revoke(token);
        } catch {}
      } else if (account.provider === 'zoom' && account.accessTokenCiphertext) {
        try {
          const token = openIntegrationSecret(account.accessTokenCiphertext, `${ownerId}|zoom|${account.externalSubject}|access`);
          await this.zoomProvider.revoke(token);
        } catch {}
      }

      await prisma.connectedAccount.delete({
        where: { id: account.id },
      });
    }

    return { success: true };
  }

  // --- Telegram Pairing Lifecycle ---

  async createTelegramPairingChallenge(ownerId: string, sessionId: string) {
    if (!this.telegramClient.isConfigured()) {
      throw new BadRequestException('TELEGRAM_BOT_TOKEN belum dikonfigurasi di file .env server');
    }

    let bot;
    try {
      bot = await this.telegramClient.getMe();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Bot Telegram gagal divalidasi: ${msg}. Periksa TELEGRAM_BOT_TOKEN di .env.`);
    }
    const challengeId = randomUUID();
    const rawToken = randomBytes(16).toString('hex');
    const manualCode = `pair_${rawToken}`;
    const tokenHash = hashIntegrationToken(manualCode, 'telegram_pair');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.telegramPairingChallenge.create({
      data: {
        id: challengeId,
        ownerId,
        sessionId,
        botId: String(bot.id),
        tokenHash,
        manualCode,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      data: {
        challengeId,
        manualCode,
        deepLink: `https://t.me/${bot.username}?start=${manualCode}`,
        botUsername: bot.username || 'PersonalAIWorkspaceBot',
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async getTelegramPairingStatus(ownerId: string, challengeId: string) {
    const challenge = await prisma.telegramPairingChallenge.findFirst({
      where: { id: challengeId, ownerId },
    });

    if (!challenge) {
      throw new NotFoundException('Tantangan pairing tidak ditemukan');
    }

    if (challenge.status === 'PENDING' && challenge.expiresAt <= new Date()) {
      return { data: { status: 'expired' } };
    }

    return { data: { status: challenge.status.toLowerCase() } };
  }

  async cancelTelegramPairing(ownerId: string, challengeId: string) {
    await prisma.telegramPairingChallenge.updateMany({
      where: { id: challengeId, ownerId, status: 'PENDING' },
      data: { status: 'CANCELED', consumedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Called when a user sends `/start pair_...` to the bot in Telegram.
   * Validates private chat, owner allowlist, and links to ConnectedAccount.
   */
  async handleTelegramStartCommand(botId: string, senderId: number, chatId: number, chatType: string, startParam: string) {
    if (chatType !== 'private') {
      return '❌ Pairing hanya dapat dilakukan melalui pesan pribadi (private chat) dengan bot.';
    }

    if (this.config.TELEGRAM_OWNER_USER_ID && String(senderId) !== String(this.config.TELEGRAM_OWNER_USER_ID)) {
      return '⛔ Akses ditolak: ID pengguna Telegram Anda tidak ada dalam daftar izin pemilik (TELEGRAM_OWNER_USER_ID).';
    }

    const tokenHash = hashIntegrationToken(startParam, 'telegram_pair');
    const challenge = await prisma.telegramPairingChallenge.findUnique({
      where: { tokenHash },
    });

    if (!challenge || challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
      return '❌ Kode pairing tidak valid atau telah kedaluwarsa. Silakan buat kode pairing baru di menu Settings.';
    }

    // Atomically claim challenge
    await prisma.telegramPairingChallenge.update({
      where: { id: challenge.id },
      data: { status: 'PAIRED', consumedAt: new Date() },
    });

    // Upsert ConnectedAccount for Telegram
    await prisma.connectedAccount.upsert({
      where: {
        ownerId_provider_externalSubject: {
          ownerId: challenge.ownerId,
          provider: 'telegram',
          externalSubject: String(senderId),
        },
      },
      create: {
        ownerId: challenge.ownerId,
        provider: 'telegram',
        externalSubject: String(senderId),
        telegramBotId: String(botId),
        telegramUserId: String(senderId),
        telegramChatId: String(chatId),
        displayName: `Telegram User (${senderId})`,
        username: String(senderId),
        status: 'CONNECTED',
        lastVerifiedAt: new Date(),
      },
      update: {
        telegramBotId: String(botId),
        telegramUserId: String(senderId),
        telegramChatId: String(chatId),
        status: 'CONNECTED',
        lastVerifiedAt: new Date(),
        lastErrorCode: null,
      },
    });

    return '✅ Berhasil! Akun Telegram Anda telah terpasang resmi dengan Personal AI Workspace.';
  }
}
