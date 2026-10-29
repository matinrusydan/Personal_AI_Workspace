import { describe, it, expect, beforeEach } from 'vitest';
import { TotpService } from '../src/modules/auth/totp.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { DevicesService } from '../src/modules/devices/devices.service';
import { AuditService } from '../src/modules/audit/audit.service';

describe('Auth & Security Modules (Milestone P1-02)', () => {
  let totpService: TotpService;
  let auditService: AuditService;
  let authService: AuthService;
  let devicesService: DevicesService;

  beforeEach(() => {
    totpService = new TotpService();
    auditService = new AuditService();
    authService = new AuthService(totpService, auditService);
    devicesService = new DevicesService(auditService);
  });

  describe('TotpService (RFC 6238 & Recovery Codes)', () => {
    it('generates a 6-digit TOTP token and verifies it correctly', () => {
      const secret = totpService.generateSecret();
      const token = totpService.generateToken(secret);

      expect(token).toMatch(/^\d{6}$/);
      const isValid = totpService.verifyToken(secret, token);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect TOTP token', () => {
      const secret = totpService.generateSecret();
      const actualToken = totpService.generateToken(secret);
      // Generate a wrong token that differs from the actual token
      const wrongToken = actualToken === '000000' ? '999999' : '000000';
      const isValid = totpService.verifyToken(secret, wrongToken);
      expect(isValid).toBe(false);
    });

    it('generates single-use recovery codes and verifies against stored hashes', () => {
      const { plainCodes, hashedCodes } = totpService.generateRecoveryCodes(4);
      expect(plainCodes).toHaveLength(4);
      expect(hashedCodes).toHaveLength(4);

      const firstCode = plainCodes[0]!;
      const result = totpService.verifyRecoveryCode(firstCode, hashedCodes);
      expect(result.valid).toBe(true);
      expect(result.matchingHash).toBe(hashedCodes[0]);

      // Rejects invalid code
      const invalidResult = totpService.verifyRecoveryCode('INVALID-CODE', hashedCodes);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('AuthService (Step 1 Login & Step 2 MFA)', () => {
    it('successfully handles step 1 login for authorized owner and returns MFA ticket', async () => {
      const res = await authService.login('owner@example.com', 'admin12345');

      expect(res.data.mfaRequired).toBe(true);
      expect(res.data.ticket).toBeDefined();
      expect(typeof res.data.ticket).toBe('string');
    });

    it('rejects unauthorized email addresses', async () => {
      await expect(authService.login('intruder@example.com', 'admin12345')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('rejects incorrect password for owner', async () => {
      await expect(authService.login('owner@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('successfully completes MFA verification with valid TOTP code', async () => {
      const loginRes = await authService.login('owner@example.com', 'admin12345');
      const ticket = loginRes.data.ticket;

      const secret = authService.getOwnerTotpSecret();
      const code = totpService.generateToken(secret);

      const verifyRes = await authService.verifyMfa(ticket, code);
      expect(verifyRes.data.accessToken).toBeDefined();
      expect(verifyRes.data.expiresAt).toBeDefined();
      expect(typeof verifyRes.data.accessToken).toBe('string');
    });

    it('successfully completes MFA verification with recovery code and consumes it', async () => {
      // Setup fresh recovery codes for test
      const { plainCodes, hashedCodes } = totpService.generateRecoveryCodes(2);
      const secret = totpService.generateSecret();
      authService.setOwnerCredentials('owner@example.com', 'admin12345', secret, hashedCodes);

      const loginRes = await authService.login('owner@example.com', 'admin12345');
      const ticket = loginRes.data.ticket;

      const recoveryCode = plainCodes[0]!;
      const verifyRes = await authService.verifyMfa(ticket, recoveryCode);
      expect(verifyRes.data.accessToken).toBeDefined();

      // Second login attempting to reuse the same recovery code must fail
      const loginRes2 = await authService.login('owner@example.com', 'admin12345');
      const ticket2 = loginRes2.data.ticket;
      await expect(authService.verifyMfa(ticket2, recoveryCode)).rejects.toThrow(
        'Invalid MFA verification code',
      );
    });

    it('rejects expired or reused MFA ticket', async () => {
      const loginRes = await authService.login('owner@example.com', 'admin12345');
      const ticket = loginRes.data.ticket;

      const secret = authService.getOwnerTotpSecret();
      const code = totpService.generateToken(secret);

      await authService.verifyMfa(ticket, code);

      // Reusing consumed ticket must fail
      await expect(authService.verifyMfa(ticket, code)).rejects.toThrow(
        'Invalid or expired MFA ticket',
      );
    });

    it('successfully logs out and retrieves profile for owner', async () => {
      const loginRes = await authService.login('owner@example.com', 'admin12345');
      const secret = authService.getOwnerTotpSecret();
      const code = totpService.generateToken(secret);
      const session = await authService.verifyMfa(loginRes.data.ticket, code);
      expect(session.data.accessToken).toBeDefined();

      const me = await authService.getMe('e1000000-0000-0000-0000-000000000001');
      expect(me.data.email).toBe('owner@example.com');
      expect(me.data.timezone).toBe('Asia/Jakarta');

      const logoutRes = await authService.logout('test-session-id');
      expect(logoutRes.success).toBe(true);
    });
  });

  describe('DevicesService (iPhone 12 & Desktop Device Enrollment)', () => {
    it('registers new iOS device and updates lastSeenAt on re-registration', () => {
      const ownerId = 'e1000000-0000-0000-0000-000000000001';
      const dev1 = devicesService.registerDevice(ownerId, {
        platform: 'ios',
        installId: 'iphone-12-uuid-12345',
        deviceName: 'Matin iPhone 12',
      });

      expect(dev1.data.id).toBeDefined();
      expect(dev1.data.platform).toBe('ios');
      expect(dev1.data.installId).toBe('iphone-12-uuid-12345');

      // Re-registering same installId must update record, not duplicate
      const dev2 = devicesService.registerDevice(ownerId, {
        platform: 'ios',
        installId: 'iphone-12-uuid-12345',
        deviceName: 'Matin iPhone 12 Updated',
      });

      expect(dev2.data.id).toBe(dev1.data.id);
      expect(dev2.data.deviceName).toBe('Matin iPhone 12 Updated');
    });

    it('returns desired alarm synchronization items', () => {
      const alarms = devicesService.getDesiredAlarms('owner-id');
      expect(Array.isArray(alarms.data)).toBe(true);
    });
  });

  describe('AuditService (Security Logging & Redaction)', () => {
    it('records events and redacts sensitive parameters', () => {
      const record = auditService.record({
        actorType: 'user',
        actorId: 'user-123',
        action: 'auth.test',
        metadata: {
          email: 'test@example.com',
          password: 'supersecretpassword',
          token: 'sensitive-jwt-token',
          safeField: 'visible-value',
        },
      });

      expect(record.metadata['email']).toBe('test@example.com');
      expect(record.metadata['safeField']).toBe('visible-value');
      expect(record.metadata['password']).toBe('[REDACTED]');
      expect(record.metadata['token']).toBe('[REDACTED]');

      const logs = auditService.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]!.action).toBe('auth.test');
    });
  });
});
