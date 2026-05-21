import { describe, it, expect } from 'vitest';

/**
 * Pure token-bucket rate limiter (replicated from apps/api for testing).
 * Verifies algorithm correctness independent of API runtime.
 */

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

interface Opts { id: string; limit: number; windowMs: number; now?: number }
interface Result { ok: boolean; remaining: number; retryAfter: number }

function rateLimit(opts: Opts): Result {
  const now = opts.now ?? Date.now();
  let b = buckets.get(opts.id);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(opts.id, b);
  }
  b.count++;
  return {
    ok: b.count <= opts.limit,
    remaining: Math.max(0, opts.limit - b.count),
    retryAfter: Math.ceil((b.resetAt - now) / 1000),
  };
}

function reset() { buckets.clear(); }

describe('Rate limiter (token bucket)', () => {
  it('allows requests up to limit', () => {
    reset();
    for (let i = 1; i <= 5; i++) {
      expect(rateLimit({ id: 'a', limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
  });

  it('blocks requests over limit', () => {
    reset();
    for (let i = 1; i <= 3; i++) rateLimit({ id: 'b', limit: 3, windowMs: 60_000 });
    expect(rateLimit({ id: 'b', limit: 3, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit({ id: 'b', limit: 3, windowMs: 60_000 }).ok).toBe(false);
  });

  it('remaining counts down per request', () => {
    reset();
    const r1 = rateLimit({ id: 'c', limit: 3, windowMs: 60_000 });
    expect(r1.remaining).toBe(2);
    const r2 = rateLimit({ id: 'c', limit: 3, windowMs: 60_000 });
    expect(r2.remaining).toBe(1);
    const r3 = rateLimit({ id: 'c', limit: 3, windowMs: 60_000 });
    expect(r3.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    reset();
    const t0 = 1700000000000;
    for (let i = 0; i < 5; i++) rateLimit({ id: 'd', limit: 5, windowMs: 60_000, now: t0 });
    expect(rateLimit({ id: 'd', limit: 5, windowMs: 60_000, now: t0 + 1000 }).ok).toBe(false);
    // 60s + 1ms later → reset
    expect(rateLimit({ id: 'd', limit: 5, windowMs: 60_000, now: t0 + 60_001 }).ok).toBe(true);
  });

  it('isolates buckets by id', () => {
    reset();
    for (let i = 0; i < 5; i++) rateLimit({ id: 'org-a', limit: 5, windowMs: 60_000 });
    // org-a exhausted, org-b unaffected
    expect(rateLimit({ id: 'org-a', limit: 5, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit({ id: 'org-b', limit: 5, windowMs: 60_000 }).ok).toBe(true);
  });

  it('retryAfter shrinks as window approaches reset', () => {
    reset();
    const t0 = 1700000000000;
    const r1 = rateLimit({ id: 'e', limit: 1, windowMs: 60_000, now: t0 });
    expect(r1.retryAfter).toBe(60);
    rateLimit({ id: 'e', limit: 1, windowMs: 60_000, now: t0 + 30_000 });
    const r3 = rateLimit({ id: 'e', limit: 1, windowMs: 60_000, now: t0 + 50_000 });
    expect(r3.retryAfter).toBe(10);
  });
});
