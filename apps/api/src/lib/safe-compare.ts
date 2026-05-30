import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison for secrets (tokens, cron/bypass secrets).
 * Returns false on length mismatch. Use instead of `===`/`!==` on any value an
 * attacker can probe by timing (avoids byte-by-byte brute force).
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
