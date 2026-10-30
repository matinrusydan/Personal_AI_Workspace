import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getEncryptionKey(): Buffer {
  const hex = (process.env.OAUTH_ENCRYPTION_KEY || process.env.AUTH_ENCRYPTION_KEY || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('Valid 32-byte hex encryption key (OAUTH_ENCRYPTION_KEY or AUTH_ENCRYPTION_KEY) is required');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a sensitive integration token (OAuth access/refresh or temporary code)
 * using AES-256-GCM with record-specific AAD binding.
 */
export function sealIntegrationSecret(plain: string, aadContext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`paw:integration:v1|${aadContext}`, 'utf8'));

  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/**
 * Decrypts and authenticates ciphertext using AES-256-GCM with identical AAD context.
 */
export function openIntegrationSecret(sealed: string, aadContext: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid or unsupported secret envelope format');
  }

  const [, ivStr, tagStr, cipherStr] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivStr!, 'base64url');
  const tag = Buffer.from(tagStr!, 'base64url');
  const ciphertext = Buffer.from(cipherStr!, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(`paw:integration:v1|${aadContext}`, 'utf8'));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashIntegrationToken(token: string, purpose: string): string {
  return `${purpose}:${createHash('sha256').update(token).digest('hex')}`;
}
