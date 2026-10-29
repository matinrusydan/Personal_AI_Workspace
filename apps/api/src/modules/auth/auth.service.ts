import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ServerEnvSchema } from '@paw/config';
import { prisma } from '@paw/database';
import { TotpService } from './totp.service';
import { AuditService } from '../audit/audit.service';

export interface UserEntity {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  totpSecret: string;
  recoveryCodeHashes: string[];
  defaultTimezone: string;
}

export interface SessionEntity {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

interface MfaTicket {
  ticket: string;
  userId: string;
  expiresAtMs: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly config = ServerEnvSchema.parse(process.env);
  private readonly sessions = new Map<string, SessionEntity>();
  private readonly mfaTickets = new Map<string, MfaTicket>();

  // In-memory owner entity for development/P1-02 (will migrate to DB in P1-03)
  private owner: UserEntity;

  constructor(
    private readonly totpService: TotpService,
    private readonly auditService: AuditService,
  ) {
    // Initialize default owner credentials for dev
    const salt = 'default-dev-salt-12345';
    const hash = this.hashPassword('admin12345', salt);
    const totpSecret = this.totpService.generateSecret();
    const { plainCodes, hashedCodes } = this.totpService.generateRecoveryCodes();

    this.owner = {
      id: 'e1000000-0000-0000-0000-000000000001',
      email: this.config.OWNER_EMAIL,
      passwordSalt: salt,
      passwordHash: hash,
      totpSecret,
      recoveryCodeHashes: hashedCodes,
      defaultTimezone: 'Asia/Jakarta',
    };

    // Log initialization notice (without exposing secret)
    this.auditService.record({
      actorType: 'system',
      actorId: 'system',
      action: 'owner.initialized',
      metadata: {
        email: this.owner.email,
        recoveryCodesCount: plainCodes.length,
      },
    });
  }

  async onModuleInit() {
    try {
      const existing = await prisma.user.findFirst({
        where: { email: this.config.OWNER_EMAIL },
      });
      if (existing) {
        this.owner.id = existing.id;
      } else {
        const created = await prisma.user.create({
          data: {
            id: this.owner.id,
            email: this.owner.email,
            passwordHash: this.owner.passwordHash,
            passwordSalt: this.owner.passwordSalt,
            defaultTimezone: this.owner.defaultTimezone,
          },
        });
        this.owner.id = created.id;
      }
    } catch {
      // Ignored if DB not reachable in unit tests
    }
  }

  async getOrCreateDevSession() {
    let user = await prisma.user.findFirst({
      where: { email: this.config.OWNER_EMAIL },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: this.owner.id,
          email: this.owner.email,
          passwordHash: this.owner.passwordHash,
          passwordSalt: this.owner.passwordSalt,
          defaultTimezone: this.owner.defaultTimezone,
        },
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        sessionId: 'dev-session-local',
      },
      this.config.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return {
      data: {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          timezone: user.defaultTimezone,
        },
      },
    };
  }

  // Helper method for testing or administrative retrieval of current TOTP secret
  getOwnerTotpSecret(): string {
    return this.owner.totpSecret;
  }

  // Helper method to set custom credentials for tests
  setOwnerCredentials(
    email: string,
    passwordPlain: string,
    totpSecret?: string,
    recoveryHashes?: string[],
  ) {
    const salt = randomUUID();
    const hash = this.hashPassword(passwordPlain, salt);
    this.owner.email = email;
    this.owner.passwordSalt = salt;
    this.owner.passwordHash = hash;
    if (totpSecret) this.owner.totpSecret = totpSecret;
    if (recoveryHashes) this.owner.recoveryCodeHashes = recoveryHashes;
  }

  /**
   * Step 1: Login with email and password
   */
  async login(email: string, passwordPlain: string, traceId?: string) {
    if (email.toLowerCase() !== this.owner.email.toLowerCase()) {
      this.auditService.record({
        actorType: 'user',
        actorId: 'unknown',
        action: 'auth.login.failed',
        traceId,
        metadata: { reason: 'email_not_authorized', email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const computedHash = this.hashPassword(passwordPlain, this.owner.passwordSalt);
    if (!timingSafeEqual(Buffer.from(computedHash), Buffer.from(this.owner.passwordHash))) {
      this.auditService.record({
        actorType: 'user',
        actorId: this.owner.id,
        action: 'auth.login.failed',
        traceId,
        metadata: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Password verified -> issue short-lived MFA ticket (valid for 5 minutes)
    const ticket = randomUUID();
    this.mfaTickets.set(ticket, {
      ticket,
      userId: this.owner.id,
      expiresAtMs: Date.now() + 5 * 60 * 1000,
    });

    this.auditService.record({
      actorType: 'user',
      actorId: this.owner.id,
      action: 'auth.login.step1_success',
      traceId,
      metadata: { mfaRequired: true },
    });

    return {
      data: {
        mfaRequired: true,
        ticket,
      },
    };
  }

  /**
   * Step 2: Finalize MFA authentication with 6-digit TOTP or recovery code
   */
  async verifyMfa(ticketId: string, code: string, traceId?: string) {
    const ticket = this.mfaTickets.get(ticketId);
    if (!ticket || ticket.expiresAtMs < Date.now()) {
      this.mfaTickets.delete(ticketId);
      this.auditService.record({
        actorType: 'user',
        actorId: this.owner.id,
        action: 'auth.mfa.failed',
        traceId,
        metadata: { reason: 'invalid_or_expired_ticket' },
      });
      throw new UnauthorizedException('Invalid or expired MFA ticket');
    }

    let authenticated = false;
    let authMethod = 'totp';

    // 1. Try TOTP token (6 digits)
    if (/^\d{6}$/.test(code.trim())) {
      authenticated = this.totpService.verifyToken(this.owner.totpSecret, code);
    }

    // 2. Try single-use recovery code if TOTP not matched
    if (!authenticated && code.includes('-')) {
      const recResult = this.totpService.verifyRecoveryCode(code, this.owner.recoveryCodeHashes);
      if (recResult.valid && recResult.matchingHash) {
        authenticated = true;
        authMethod = 'recovery_code';
        // Remove consumed recovery code hash
        this.owner.recoveryCodeHashes = this.owner.recoveryCodeHashes.filter(
          (h) => h !== recResult.matchingHash,
        );
      }
    }

    if (!authenticated) {
      this.auditService.record({
        actorType: 'user',
        actorId: this.owner.id,
        action: 'auth.mfa.failed',
        traceId,
        metadata: { reason: 'invalid_mfa_code' },
      });
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    // Consume ticket
    this.mfaTickets.delete(ticketId);

    // Create session
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session: SessionEntity = {
      id: sessionId,
      userId: this.owner.id,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    this.sessions.set(sessionId, session);

    // Sign JWT access token
    const accessToken = jwt.sign(
      {
        userId: this.owner.id,
        email: this.owner.email,
        sessionId,
      },
      this.config.JWT_SECRET,
      { expiresIn: '7d' },
    );

    this.auditService.record({
      actorType: 'user',
      actorId: this.owner.id,
      action: 'auth.session.created',
      traceId,
      metadata: { sessionId, authMethod, expiresAt },
    });

    return {
      data: {
        accessToken,
        expiresAt,
      },
    };
  }

  /**
   * Revoke active session
   */
  async logout(sessionId: string, traceId?: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revokedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);
    }

    this.auditService.record({
      actorType: 'user',
      actorId: this.owner.id,
      action: 'auth.session.revoked',
      traceId,
      metadata: { sessionId },
    });

    return { success: true };
  }

  /**
   * Return owner profile
   */
  async getMe(userId: string) {
    if (userId !== this.owner.id) {
      throw new BadRequestException('User not found');
    }

    return {
      data: {
        id: this.owner.id,
        email: this.owner.email,
        timezone: this.owner.defaultTimezone,
      },
    };
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }
}
