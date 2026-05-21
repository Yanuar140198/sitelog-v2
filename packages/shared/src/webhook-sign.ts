/**
 * Webhook signature verification — HMAC-SHA256, compatible with Stripe-style headers.
 *
 * Header format: `t=<timestamp>,v1=<hex_signature>`
 * Signature input: `<timestamp>.<raw_body>`
 *
 * Tolerance: rejects timestamps >5 minutes off to prevent replay.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = `${timestamp}.${body}`;
  const sig = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

export function parseHeader(header: string): { t: number; v1: string } | null {
  const parts = header.split(',').reduce<Record<string, string>>((acc, kv) => {
    const [k, v] = kv.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return null;
  return { t: Number(parts.t), v1: parts.v1 };
}

export interface VerifyOptions {
  toleranceSeconds?: number;
  /** override "now" for testing */
  now?: number;
}

export function verifyWebhook(secret: string, body: string, header: string, opts: VerifyOptions = {}): boolean {
  const parsed = parseHeader(header);
  if (!parsed) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const tol = opts.toleranceSeconds ?? TOLERANCE_SECONDS;
  if (Math.abs(now - parsed.t) > tol) return false;
  const expected = createHmac('sha256', secret).update(`${parsed.t}.${body}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parsed.v1, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
