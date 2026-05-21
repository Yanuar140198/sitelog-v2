/**
 * In-memory token-bucket rate limiter.
 *
 * For multi-instance: swap to Redis (Upstash) backed Map. Single-instance dev OK.
 *
 * Usage:
 *   const lim = rateLimit({ id: `org:${orgId}`, limit: 100, windowMs: 60_000 });
 *   if (!lim.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: `Retry in ${lim.retryAfter}s` });
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodic cleanup
let lastCleanup = Date.now();
function cleanup() {
  if (Date.now() - lastCleanup < 60_000) return;
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  lastCleanup = now;
}

export interface RateLimitOpts {
  id: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;     // seconds until reset
}

export function rateLimit(opts: RateLimitOpts): RateLimitResult {
  cleanup();
  const now = Date.now();
  let b = buckets.get(opts.id);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(opts.id, b);
  }
  b.count++;
  const ok = b.count <= opts.limit;
  return { ok, remaining: Math.max(0, opts.limit - b.count), retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

/** tRPC middleware factory: per-user limit. */
import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc.js';

export function rateLimitMiddleware(opts: { limit: number; windowMs: number; scope?: 'user' | 'org' | 'ip' }) {
  const scope = opts.scope ?? 'user';
  return middleware(({ ctx, next, path }) => {
    let id: string;
    if (scope === 'user') id = ctx.session?.user.id ?? ctx.headers.get('x-real-ip') ?? 'anon';
    else if (scope === 'org') id = ctx.session?.organizationId ?? 'anon';
    else id = ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ctx.headers.get('x-real-ip') ?? 'anon';
    const r = rateLimit({ id: `${scope}:${id}:${path}`, limit: opts.limit, windowMs: opts.windowMs });
    if (!r.ok) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limited. Retry in ${r.retryAfter}s.`,
      });
    }
    return next();
  });
}
