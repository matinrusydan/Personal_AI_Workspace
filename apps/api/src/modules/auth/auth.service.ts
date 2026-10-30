import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { prisma } from '@paw/database';
import { TotpService } from './totp.service';
import { CHALLENGE_SECONDS, OWNER_MARKER, SESSION_SECONDS, newToken, openSecret, ownerEmail, passwordHash, safeEqual, sealSecret, tokenHash } from '../../common/session-security';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const INVALID = 'Unable to authenticate';
const PROFILE = { id: true, email: true, locale: true, defaultTimezone: true } as const;

@Injectable()
export class AuthService {
  constructor(private readonly totp: TotpService) {}

  // Durable counters in the existing audit table: no process-local auth state.
  // Advisory locks serialize counters across API replicas without a schema change.
  async rateLimit(ip: string, subject: string): Promise<void> {
    const keys = [
      { key: `ip:${ip}`, max: 25 },
      { key: `subject:${subject}`, max: 8 },
    ].map(({ key, max }) => ({ key: `auth-rate:${createHash('sha256').update(key).digest('hex')}`, max })).sort((a, b) => a.key.localeCompare(b.key));
    const allowed = await prisma.$transaction(async (tx) => {
      for (const { key } of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      for (const { key, max } of keys) {
        const count = await tx.auditLog.count({ where: { actorId: key, action: 'auth.rate.attempt', createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
        if (count >= max) return false;
      }
      for (const { key } of keys) await tx.auditLog.create({ data: { actorType: 'system', actorId: key, action: 'auth.rate.attempt', traceId: randomUUID(), redactedMetadata: {} } });
      return true;
    });
    if (!allowed) throw new HttpException('Too many attempts. Try again later.', 429);
  }

  async bootstrap(body: Record<string, unknown>) {
    const email = this.email(body.email);
    const password = this.password(body.password, true);
    const configuredEmail = ownerEmail();
    const setupToken = process.env.AUTH_SETUP_TOKEN;
    if (process.env.AUTH_BOOTSTRAP_ENABLED !== 'true' || !configuredEmail || !setupToken || setupToken.length < 32 || typeof body.setupToken !== 'string' || !safeEqual(body.setupToken, setupToken) || email !== configuredEmail) {
      throw new ForbiddenException('Owner setup is unavailable');
    }
    // Validate encryption before creating any identity. No default key or credentials.
    sealSecret('configuration-check');
    const salt = randomBytes(32).toString('hex');
    const hash = await passwordHash(password, salt);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724011091)`;
      // Create a NEW explicit owner only; preserve all legacy/fixture rows and
      // refuse to adopt an email already present. A marker locks setup permanently.
      if (await tx.authenticator.count({ where: { type: OWNER_MARKER } }) || await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new ForbiddenException('Owner setup is unavailable');
      const user = await tx.user.create({ data: { email, passwordHash: hash, passwordSalt: salt } });
      await tx.authenticator.create({ data: { userId: user.id, type: OWNER_MARKER, credentialRef: 'explicit-owner-setup', verifiedAt: null } });
      await this.audit(tx, user.id, 'auth.owner.setup_started');
      return this.enrollment(tx, user.id, user.email);
    });
  }

  async login(emailInput: unknown, passwordInput: unknown) {
    const email = this.email(emailInput);
    const password = this.password(passwordInput);
    const user = await prisma.user.findUnique({ where: { email }, include: { authenticators: { where: { type: OWNER_MARKER } } } });
    // Equal-cost derivation even for unknown identities; fixture users are not owner accounts.
    const computed = await passwordHash(password, user?.passwordSalt || 'paw-unknown-account-salt');
    if (!user || email !== ownerEmail() || !user.authenticators.length || !safeEqual(computed, user.passwordHash)) throw new UnauthorizedException(INVALID);
    if (!user.totpSecret) return prisma.$transaction((tx) => this.enrollment(tx, user.id, user.email));
    const ticket = newToken();
    await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(ticket, 'mfa'), expiresAt: new Date(Date.now() + CHALLENGE_SECONDS * 1000) } });
    return { data: { mfaRequired: true, enrollmentRequired: false, ticket, expiresIn: CHALLENGE_SECONDS } };
  }

  private async enrollment(tx: Transaction, userId: string, email: string) {
    const ticket = newToken();
    const secret = this.totp.generateSecret();
    const session = await tx.session.create({ data: { userId, tokenHash: tokenHash(ticket, 'enroll'), expiresAt: new Date(Date.now() + CHALLENGE_SECONDS * 1000) } });
    await tx.authenticator.create({ data: { id: session.id, userId, type: 'totp-pending-v1', credentialRef: sealSecret(secret) } });
    return { data: { mfaRequired: true, enrollmentRequired: true, ticket, secret, provisioningUri: this.totp.provisioningUri(email, secret), expiresIn: CHALLENGE_SECONDS } };
  }

  async verifyMfa(ticketInput: unknown, codeInput: unknown, enrolling = false) {
    if (typeof ticketInput !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticketInput) || typeof codeInput !== 'string' || codeInput.length > 80) throw new UnauthorizedException(INVALID);
    const hash = tokenHash(ticketInput, enrolling ? 'enroll' : 'mfa');
    // Invalid attempts consume the challenge too. Returning null (rather than throwing
    // inside the transaction) commits revocation and prevents brute-force/replay.
    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.session.findFirst({ where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
      if (!challenge || challenge.user.email !== ownerEmail()) return null;
      const claimed = await tx.session.updateMany({ where: { id: challenge.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
      if (claimed.count !== 1) return null;
      const marker = await tx.authenticator.findFirst({ where: { userId: challenge.userId, type: OWNER_MARKER } });
      if (!marker) return null;
      let recoveryCodes: string[] | undefined;
      if (enrolling) {
        const pending = await tx.authenticator.findUnique({ where: { id: challenge.id } });
        if (!pending || pending.type !== 'totp-pending-v1') return null;
        await tx.authenticator.delete({ where: { id: pending.id } });
        // Serialize enrollment completions so two pending tickets cannot replace MFA.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.userId}))`;
        const current = await tx.user.findUnique({ where: { id: challenge.userId } });
        if (!current || current.totpSecret) return null;
        const secret = openSecret(pending.credentialRef);
        const step = this.totp.matchingStep(secret, codeInput);
        if (step === null) return null;
        const generated = this.totp.generateRecoveryCodes();
        recoveryCodes = generated.plainCodes;
        await tx.user.update({ where: { id: current.id }, data: { totpSecret: sealSecret(secret), recoveryCodeHashes: generated.hashedCodes } });
        await tx.authenticator.create({ data: { userId: current.id, type: 'totp-v1', credentialRef: String(step), verifiedAt: new Date() } });
        await tx.authenticator.update({ where: { id: marker.id }, data: { verifiedAt: new Date() } });
        // Completing setup invalidates all other pending challenges for this owner.
        await tx.session.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.authenticator.deleteMany({ where: { userId: current.id, type: 'totp-pending-v1' } });
      } else {
        if (!marker.verifiedAt || !challenge.user.totpSecret) return null;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.userId}))`;
        const current = await tx.user.findUnique({ where: { id: challenge.userId } });
        if (!current?.totpSecret) return null;
        const authenticator = await tx.authenticator.findFirst({ where: { userId: current.id, type: 'totp-v1', verifiedAt: { not: null } } });
        const step = this.totp.matchingStep(openSecret(current.totpSecret), codeInput);
        if (step !== null && authenticator && Number.isSafeInteger(Number(authenticator.credentialRef)) && step > Number(authenticator.credentialRef)) {
          await tx.authenticator.update({ where: { id: authenticator.id }, data: { credentialRef: String(step) } });
        } else {
          const recovery = this.totp.verifyRecoveryCode(codeInput, current.recoveryCodeHashes);
          if (!recovery.valid) return null;
          await tx.user.update({ where: { id: current.id }, data: { recoveryCodeHashes: current.recoveryCodeHashes.filter((h) => h !== recovery.matchingHash) } });
          await this.audit(tx, current.id, 'auth.recovery_code.used');
        }
      }
      const accessToken = newToken();
      const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
      const session = await tx.session.create({ data: { userId: challenge.userId, tokenHash: tokenHash(accessToken, 'session'), expiresAt } });
      await this.audit(tx, challenge.userId, 'auth.session.created', session.id);
      return { data: { accessToken, expiresAt: expiresAt.toISOString(), ...(recoveryCodes ? { recoveryCodes } : {}) } };
    });
    if (!result) throw new UnauthorizedException(INVALID);
    return result;
  }

  async logout(sessionId: string) {
    await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      await tx.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (session) await this.audit(tx, session.userId, 'auth.session.revoked', sessionId);
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE });
    if (!user) throw new UnauthorizedException(INVALID);
    return { data: { ...user, timezone: user.defaultTimezone } };
  }

  async updateProfile(userId: string, body: Record<string, unknown>) {
    if (Object.keys(body).some((key) => !['locale', 'timezone'].includes(key))) throw new BadRequestException('Unsupported profile field');
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string' || body.timezone.length > 100) throw new BadRequestException('Invalid timezone');
      try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { throw new BadRequestException('Invalid timezone'); }
    }
    if (body.locale !== undefined && !['id-ID', 'en-US'].includes(String(body.locale))) throw new BadRequestException('Invalid locale');
    await prisma.user.update({ where: { id: userId }, data: { ...(body.timezone !== undefined ? { defaultTimezone: body.timezone as string } : {}), ...(body.locale !== undefined ? { locale: body.locale as string } : {}) } });
    return this.getMe(userId);
  }

  async settings(userId: string, currentSessionId: string) {
    const [profile, sessions, user, authenticators] = await Promise.all([
      this.getMe(userId),
      prisma.session.findMany({ where: { userId, tokenHash: { startsWith: 'session:' }, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true, deviceId: true }, orderBy: { createdAt: 'desc' } }),
      prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, recoveryCodeHashes: true } }),
      prisma.authenticator.count({ where: { userId, verifiedAt: { not: null }, type: 'totp-v1' } }),
    ]);
    return { data: { profile: profile.data, sessions: sessions.map((s) => ({ ...s, current: s.id === currentSessionId })), activeSessionsCount: sessions.length, mfa: { enabled: !!user?.totpSecret && authenticators > 0, authenticatorsCount: authenticators, recoveryCodesRemaining: user?.recoveryCodeHashes.length || 0 } } };
  }

  async revokeSession(userId: string, sessionId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new BadRequestException('Invalid session');
    await prisma.$transaction(async (tx) => {
      await tx.session.updateMany({ where: { id: sessionId, userId, tokenHash: { startsWith: 'session:' }, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tx, userId, 'auth.session.revoked', sessionId);
    });
    return { success: true };
  }

  private async audit(tx: Transaction, userId: string, action: string, target?: string) {
    await tx.auditLog.create({ data: { actorType: 'user', actorId: userId, action, target, traceId: randomUUID(), redactedMetadata: {} } });
  }

  private email(value: unknown): string {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new UnauthorizedException(INVALID);
    return value.trim().toLowerCase();
  }

  private password(value: unknown, creating = false): string {
    if (typeof value !== 'string' || value.length > 256 || value.length < (creating ? 14 : 1)) throw new BadRequestException(creating ? 'Use a password of 14 to 256 characters' : INVALID);
    return value;
  }
}
