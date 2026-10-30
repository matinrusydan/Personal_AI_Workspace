import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class TotpService {
  private readonly stepSeconds = 30;
  private readonly digits = 6;

  /**
   * Generates a secure random Base32 TOTP secret
   */
  generateSecret(length = 20): string {
    const buffer = randomBytes(length);
    return this.base32Encode(buffer);
  }

  /**
   * Generates 8 single-use recovery codes, each containing 128 random bits.
   * Returns plaintext codes for display to the user, and hashed codes for secure storage.
   */
  generateRecoveryCodes(count = 8): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      // 128 bits of entropy per single-use recovery code.
      const code = randomBytes(16).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
      plainCodes.push(code);
      hashedCodes.push(this.hashRecoveryCode(code));
    }

    return { plainCodes, hashedCodes };
  }

  /**
   * Hashes a recovery code using SHA-256
   */
  hashRecoveryCode(code: string): string {
    const normalized = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Verifies a single-use recovery code against stored hashes
   */
  verifyRecoveryCode(
    code: string,
    storedHashes: string[],
  ): { valid: boolean; matchingHash?: string } {
    const inputHash = this.hashRecoveryCode(code);
    const inputBuffer = Buffer.from(inputHash, 'hex');

    for (const stored of storedHashes) {
      const storedBuffer = Buffer.from(stored, 'hex');
      if (
        storedBuffer.length === inputBuffer.length &&
        timingSafeEqual(storedBuffer, inputBuffer)
      ) {
        return { valid: true, matchingHash: stored };
      }
    }

    return { valid: false };
  }

  /**
   * Generates standard RFC 6238 6-digit TOTP token at given timestamp
   */
  generateToken(secretBase32: string, timestampMs = Date.now()): string {
    const counter = Math.floor(timestampMs / 1000 / this.stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const key = this.base32Decode(secretBase32);
    const hmac = createHmac('sha1', key).update(counterBuffer).digest();

    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);

    const token = binary % Math.pow(10, this.digits);
    return token.toString().padStart(this.digits, '0');
  }

  /**
   * Verifies TOTP token with a drift window of +-1 step (30 seconds)
   */
  verifyToken(secretBase32: string, token: string, timestampMs = Date.now()): boolean {
    return this.matchingStep(secretBase32, token, timestampMs) !== null;
  }

  matchingStep(secret: string, token: string, timestampMs = Date.now()): number | null {
    if (!/^\d{6}$/.test(token)) return null;
    for (let delta = -1; delta <= 1; delta++) {
      const time = timestampMs + delta * this.stepSeconds * 1000;
      const expected = this.generateToken(secret, time);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
        return Math.floor(time / 1000 / this.stepSeconds);
      }
    }
    return null;
  }

  provisioningUri(email: string, secret: string): string {
    return `otpauth://totp/${encodeURIComponent(`Personal AI Workspace:${email}`)}?${new URLSearchParams({ secret, issuer: 'Personal AI Workspace', algorithm: 'SHA1', digits: '6', period: '30' })}`;
  }

  // --- Base32 Encoding/Decoding RFC 4648 ---
  private static readonly RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i]!;
      bits += 8;
      while (bits >= 5) {
        output += TotpService.RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += TotpService.RFC4648_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private base32Decode(base32: string): Buffer {
    const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = TotpService.RFC4648_ALPHABET.indexOf(cleaned[i]!);
      if (idx === -1) {
        continue;
      }
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}
