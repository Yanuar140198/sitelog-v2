/**
 * Symmetric envelope encryption for at-rest secrets (e.g. per-org BYO API keys).
 * AES-256-GCM with a key derived from a server master secret. Stores ciphertext
 * + iv + auth tag; the plaintext never touches the DB or the client.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string;         // hex (16 bytes → 32 chars)
  authTag: string;    // hex (16 bytes → 32 chars)
}

function masterKey(): Buffer {
  const src = process.env.SECRET_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!src) {
    throw new Error('No encryption secret configured (set SECRET_ENCRYPTION_KEY or BETTER_AUTH_SECRET).');
  }
  return createHash('sha256').update(src).digest(); // 32 bytes
}

export function seal(plaintext: string): SealedSecret {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

export function open(s: SealedSecret): string {
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(s.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(s.authTag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(s.ciphertext, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}
