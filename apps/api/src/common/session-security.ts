import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { prisma } from '@paw/database';

const derive = promisify(scrypt);
export const OWNER_MARKER = 'owner-bootstrap-v1';
export const SESSION_SECONDS = 3600;
export const CHALLENGE_SECONDS = 300;
export type TokenPurpose = 'session' | 'mfa' | 'enroll';

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string, purpose: TokenPurpose): string {
  return `${purpose}:${createHash('sha256').update(token).digest('hex')}`;
}

export function safeEqual(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export async function passwordHash(password: string, salt: string): Promise<string> {
  return ((await derive(password, salt, 64)) as Buffer).toString('hex');
}

export function ownerEmail(): string | null {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  // Configuration placeholders must never become an owner identity.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /@(example\.(com|org|net)|test\.com)$/.test(email)) return null;
  return email;
}

function encryptionKey(): Buffer {
  const value = process.env.AUTH_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('Authentication encryption is not configured');
  return Buffer.from(value, 'hex');
}

export function sealSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from('paw:totp:v1'));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid authentication secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from('paw:totp:v1'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

// All callers, including native bearer clients, consult PostgreSQL on every request.
// Legacy JWTs and MFA/enrollment tickets deliberately cannot authenticate here.
export async function findActiveSession(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const email = ownerEmail();
  if (!email) return null;
  return prisma.session.findFirst({
    where: {
      tokenHash: tokenHash(token, 'session'), revokedAt: null, expiresAt: { gt: new Date() },
      user: { email, totpSecret: { not: null }, authenticators: { some: { type: OWNER_MARKER, verifiedAt: { not: null } } } },
    },
    include: { user: { select: { id: true, email: true } } },
  });
}
