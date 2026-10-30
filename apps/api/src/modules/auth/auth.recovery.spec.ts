import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real database package is never imported or connected by this suite.
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  session: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  authenticator: { count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  auditLog: { count: vi.fn(), create: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock('@paw/database', () => ({ prisma: db }));
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { findActiveSession, newToken, openSecret, passwordHash, sealSecret, tokenHash } from '../../common/session-security';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { ExecutionContext } from '@nestjs/common';

const totp = new TotpService();
const service = new AuthService(totp);
const email = 'owner@private.workspace';
const userId = 'e1000000-0000-0000-0000-000000000001';
const secret = 'JBSWY3DPEHPK3PXP';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('OWNER_EMAIL', email);
  vi.stubEnv('AUTH_ENCRYPTION_KEY', '12'.repeat(32));
  vi.stubEnv('AUTH_BOOTSTRAP_ENABLED', 'false');
  vi.stubEnv('AUTH_SETUP_TOKEN', 'test-only-setup-value-not-a-real-secret-123');
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.$executeRaw.mockResolvedValue(1);
  db.auditLog.create.mockResolvedValue({});
  db.authenticator.count.mockResolvedValue(0);
  db.user.findUnique.mockResolvedValue(null);
  db.session.create.mockImplementation(async ({ data }: { data: object }) => ({ id: newToken(), ...data }));
});

describe('explicit bootstrap and durable authentication', () => {
  it('does not initialize users or sessions on construction', () => {
    new AuthService(totp);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
    expect('getOrCreateDevSession' in service).toBe(false);
    expect('setOwnerCredentials' in service).toBe(false);
  });

  it('requires server opt-in, setup token, and a real configured identity', async () => {
    await expect(service.bootstrap({ email, password: 'long-test-passphrase', setupToken: process.env.AUTH_SETUP_TOKEN })).rejects.toThrow('Owner setup is unavailable');
    vi.stubEnv('AUTH_BOOTSTRAP_ENABLED', 'true');
    await expect(service.bootstrap({ email, password: 'long-test-passphrase', setupToken: 'incorrect' })).rejects.toThrow('Owner setup is unavailable');
    vi.stubEnv('OWNER_EMAIL', 'owner@example.com');
    await expect(service.bootstrap({ email: 'owner@example.com', password: 'long-test-passphrase', setupToken: process.env.AUTH_SETUP_TOKEN })).rejects.toThrow('Owner setup is unavailable');
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('never adopts an existing email or creates a second owner marker', async () => {
    vi.stubEnv('AUTH_BOOTSTRAP_ENABLED', 'true');
    db.user.findUnique.mockResolvedValue({ id: userId });
    await expect(service.bootstrap({ email, password: 'long-test-passphrase', setupToken: process.env.AUTH_SETUP_TOKEN })).rejects.toThrow('Owner setup is unavailable');
    db.user.findUnique.mockResolvedValue(null);
    db.authenticator.count.mockResolvedValue(1);
    await expect(service.bootstrap({ email, password: 'long-test-passphrase', setupToken: process.env.AUTH_SETUP_TOKEN })).rejects.toThrow('Owner setup is unavailable');
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('creates a new explicit owner with a scoped, encrypted enrollment challenge, not a session', async () => {
    vi.stubEnv('AUTH_BOOTSTRAP_ENABLED', 'true');
    db.user.create.mockResolvedValue({ id: userId, email });
    const result = await service.bootstrap({ email, password: 'long-test-passphrase', setupToken: process.env.AUTH_SETUP_TOKEN });
    expect(result.data.enrollmentRequired).toBe(true);
    expect(result.data.provisioningUri).toContain('otpauth://totp/');
    expect(db.session.create.mock.calls[0]![0].data.tokenHash).toMatch(/^enroll:/);
    const pending = db.authenticator.create.mock.calls[1]![0].data;
    expect(pending.credentialRef).not.toContain(result.data.secret);
    expect(openSecret(pending.credentialRef)).toBe(result.data.secret);
    expect('accessToken' in result.data).toBe(false);
  });

  it('rejects seeded users even when the password matches', async () => {
    const salt = 'isolated-test-salt';
    db.user.findUnique.mockResolvedValue({ id: userId, email, passwordSalt: salt, passwordHash: await passwordHash('test-password', salt), authenticators: [] });
    await expect(service.login(email, 'test-password')).rejects.toThrow('Unable to authenticate');
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('reads credentials from DB and stores a hashed MFA-only ticket', async () => {
    const salt = 'isolated-test-salt';
    db.user.findUnique.mockResolvedValue({ id: userId, email, passwordSalt: salt, passwordHash: await passwordHash('test-password', salt), totpSecret: sealSecret(secret), authenticators: [{ id: 'marker' }] });
    const result = await service.login(email, 'test-password');
    expect(result.data.enrollmentRequired).toBe(false);
    expect(db.session.create.mock.calls[0]![0].data.tokenHash).toBe(tokenHash(result.data.ticket, 'mfa'));
  });

  it('consumes an invalid MFA challenge and creates no session', async () => {
    db.session.findFirst.mockResolvedValue({ id: 'challenge', userId, user: { email, totpSecret: sealSecret(secret), recoveryCodeHashes: [] } });
    db.session.updateMany.mockResolvedValue({ count: 1 });
    db.authenticator.findFirst.mockResolvedValue({ id: 'marker', verifiedAt: new Date() });
    db.user.findUnique.mockResolvedValue({ id: userId, totpSecret: sealSecret(secret), recoveryCodeHashes: [] });
    await expect(service.verifyMfa(newToken(), 'invalid')).rejects.toThrow('Unable to authenticate');
    expect(db.session.updateMany).toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('rejects expired or already consumed challenges', async () => {
    db.session.findFirst.mockResolvedValue(null);
    await expect(service.verifyMfa(newToken(), '123456')).rejects.toThrow('Unable to authenticate');
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('atomically consumes recovery code and issues a one-hour hashed session', async () => {
    const generated = totp.generateRecoveryCodes(1);
    const code = generated.plainCodes[0]!;
    db.session.findFirst.mockResolvedValue({ id: 'challenge', userId, user: { email, totpSecret: sealSecret(secret) } });
    db.session.updateMany.mockResolvedValue({ count: 1 });
    db.authenticator.findFirst.mockResolvedValue({ id: 'marker', verifiedAt: new Date() });
    db.user.findUnique.mockResolvedValue({ id: userId, totpSecret: sealSecret(secret), recoveryCodeHashes: generated.hashedCodes });
    const result = await service.verifyMfa(newToken(), code);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { recoveryCodeHashes: [] } });
    expect(db.session.create.mock.calls[0]![0].data.tokenHash).toBe(tokenHash(result.data.accessToken, 'session'));
    expect(Date.parse(result.data.expiresAt) - Date.now()).toBeGreaterThan(3_590_000);
    expect(db.$executeRaw).toHaveBeenCalled();
  });

  it('rejects reused TOTP steps instead of accepting a fresh password ticket', async () => {
    const step = Math.floor(Date.now() / 30000);
    db.session.findFirst.mockResolvedValue({ id: 'challenge', userId, user: { email, totpSecret: sealSecret(secret) } });
    db.session.updateMany.mockResolvedValue({ count: 1 });
    db.authenticator.findFirst.mockResolvedValue({ id: 'auth', verifiedAt: new Date(), credentialRef: String(step) });
    db.user.findUnique.mockResolvedValue({ id: userId, totpSecret: sealSecret(secret), recoveryCodeHashes: [] });
    await expect(service.verifyMfa(newToken(), totp.generateToken(secret))).rejects.toThrow('Unable to authenticate');
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('rate limits using durable locked counters, not a process Map', async () => {
    db.auditLog.count.mockResolvedValue(25);
    await expect(service.rateLimit('127.0.0.1', email)).rejects.toThrow('Too many attempts');
    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('revokes a session in PostgreSQL', async () => {
    db.session.findUnique.mockResolvedValue({ userId });
    await service.logout('session-id');
    expect(db.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-id', revokedAt: null } }));
  });
});

describe('session guard and cryptographic helpers', () => {
  it('rejects legacy JWT and all non-opaque tokens without a DB fallback', async () => {
    expect(await findActiveSession('legacy.jwt.token')).toBeNull();
    expect(db.session.findFirst).not.toHaveBeenCalled();
  });

  it('requires DB expiry, revocation, owner marker, and session purpose on every request', async () => {
    db.session.findFirst.mockResolvedValue(null);
    expect(await findActiveSession(newToken())).toBeNull();
    const query = db.session.findFirst.mock.calls[0]![0];
    expect(query.where.revokedAt).toBeNull();
    expect(query.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(query.where.tokenHash).toMatch(/^session:/);
    expect(query.where.user.authenticators.some.verifiedAt.not).toBeNull();
  });

  it('fails closed when DB says the session was revoked', async () => {
    db.session.findFirst.mockResolvedValue(null);
    const request = { headers: { authorization: `Bearer ${newToken()}` } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
    await expect(new AuthGuard().canActivate(context)).rejects.toThrow('Authentication required');
  });

  it('encrypts TOTP at rest and authenticates ciphertext', () => {
    const encrypted = sealSecret(secret);
    expect(openSecret(encrypted)).toBe(secret);
    const parts = encrypted.split('.');
    parts[3] = Buffer.from('tamper').toString('base64url');
    expect(() => openSecret(parts.join('.'))).toThrow();
  });

  it('generates 128-bit recovery codes and RFC-compatible provisioning', () => {
    const codes = totp.generateRecoveryCodes();
    expect(codes.plainCodes).toHaveLength(8);
    expect(codes.plainCodes[0]!.replaceAll('-', '')).toHaveLength(32);
    expect(totp.verifyRecoveryCode(codes.plainCodes[0]!, codes.hashedCodes).valid).toBe(true);
    expect(totp.generateToken('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe('287082');
    expect(totp.provisioningUri(email, secret)).toContain('issuer=Personal+AI+Workspace');
  });
});
