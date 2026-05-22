/**
 * Hono server entrypoint. Bun-native.
 *
 * Routes:
 *   /healthz                              — health check
 *   /api/trpc/*                           — tRPC handler
 *   /api/auth/*                           — Better Auth handler (managed by @sitelog/auth)
 *   /api/webhooks/stripe                  — Stripe billing events
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './router/index.js';
import { createContext } from './context.js';
import { resolveAuthSession, auth } from '@sitelog/auth';
import { stripe } from './lib/stripe.js';
import { db, subscription, organization } from '@sitelog/db';
import { eq, sql } from 'drizzle-orm';

const app = new Hono();

// Optional Sentry init (no-op when SENTRY_DSN unset)
import('./lib/sentry.js').then(m => m.initSentry()).catch(() => {});

// Request ID propagation (must come first so all downstream see it)
const { requestIdMiddleware } = await import('./lib/request-id.js');
app.use('*', requestIdMiddleware() as any);

// Security headers on every response
const { securityHeadersMiddleware } = await import('./lib/security-headers.js');
app.use('*', securityHeadersMiddleware());

// Maintenance mode — 503 most paths when MAINTENANCE_MODE=1
const { maintenanceModeMiddleware } = await import('./lib/maintenance-mode.js');
app.use('*', maintenanceModeMiddleware());

app.use('*', logger());

// Metrics middleware — counts http requests + errors (excludes /metrics + /healthz to avoid scrape pollution)
const { metricsMiddleware, bump } = await import('./metrics.js');
app.use('*', async (c, next) => {
  const path = c.req.path;
  if (path === '/metrics' || path === '/healthz') return next();
  await metricsMiddleware()(c, next);
  if (path.startsWith('/api/trpc/')) bump('trpc_calls_total');
  else if (path.startsWith('/api/v1/')) bump('rest_calls_total');
});

app.use('*', cors({
  origin: (origin) => origin ?? 'http://localhost:3000',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'Cookie'],
}));

app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

// Public stats — anonymized platform counts (orgs, projects, entries).
// Cached aggressively so it can be polled by status pages + marketing widgets.
app.get('/stats', async (c) => {
  try {
    const r: any = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM organization)            AS orgs,
        (SELECT COUNT(*)::int FROM project WHERE deleted_at IS NULL) AS projects,
        (SELECT COUNT(*)::int FROM daily_entry)             AS entries
    `);
    const row = (r.rows ?? r)[0] ?? {};
    return c.json({
      orgs: Number(row.orgs ?? 0),
      projects: Number(row.projects ?? 0),
      entries: Number(row.entries ?? 0),
      ts: Date.now(),
    }, 200, { 'cache-control': 'public, max-age=300' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Counter-style badges for shields.io endpoint pattern
app.get('/badge/projects', async (c) => {
  let n = 0;
  try { const r: any = await db.execute(sql`SELECT COUNT(*)::int AS n FROM project WHERE deleted_at IS NULL`); n = Number(((r.rows ?? r)[0] ?? {}).n ?? 0); } catch {}
  return c.json({ schemaVersion: 1, label: 'projects', message: String(n), color: 'blue' }, 200, { 'cache-control': 'public, max-age=300' });
});
app.get('/badge/entries', async (c) => {
  let n = 0;
  try { const r: any = await db.execute(sql`SELECT COUNT(*)::int AS n FROM daily_entry`); n = Number(((r.rows ?? r)[0] ?? {}).n ?? 0); } catch {}
  return c.json({ schemaVersion: 1, label: 'entries', message: String(n), color: 'blue' }, 200, { 'cache-control': 'public, max-age=300' });
});

// Public uptime badge — shields.io compatible JSON for README embeds.
// Returns { schemaVersion, label, message, color } for shields.io endpoint badges.
app.get('/badge/status', async (c) => {
  let dbOk = false;
  try { await db.execute(sql`select 1`); dbOk = true; } catch {}
  return c.json({
    schemaVersion: 1,
    label: 'sitelog',
    message: dbOk ? 'operational' : 'degraded',
    color: dbOk ? 'brightgreen' : 'red',
  }, 200, { 'cache-control': 'public, max-age=60' });
});

// Prometheus metrics — text/plain, optionally token-gated via METRICS_TOKEN env
app.get('/metrics', async (c) => {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const auth = c.req.header('authorization');
    if (auth !== `Bearer ${token}`) return c.text('Unauthorized', 401);
  }
  const { renderMetrics } = await import('./metrics.js');
  const body = await renderMetrics();
  return c.text(body, 200, { 'content-type': 'text/plain; version=0.0.4' });
});

/** Public status — uptime check target. Real probes for DB; config check for opt-in deps. */
app.get('/status', async (c) => {
  const checks: Record<string, { ok: boolean; latency?: number; error?: string }> = {};

  // Always-on: DB
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    checks.db = { ok: true, latency: Date.now() - t0 };
  } catch (e: any) { checks.db = { ok: false, error: e.message }; }

  // Opt-in: Stripe (live ping if key set)
  if (process.env.STRIPE_SECRET_KEY && stripe) {
    try {
      const t0 = Date.now();
      await stripe.balance.retrieve();
      checks.stripe = { ok: true, latency: Date.now() - t0 };
    } catch (e: any) { checks.stripe = { ok: false, error: e.message?.slice(0, 100) }; }
  } else {
    checks.stripe = { ok: false, error: 'not configured' };
  }

  // Opt-in: R2 (config check)
  checks.r2 = { ok: !!process.env.R2_ACCOUNT_ID, ...(process.env.R2_ACCOUNT_ID ? {} : { error: 'not configured' }) };

  // Opt-in: Resend
  checks.email = { ok: !!process.env.RESEND_API_KEY, ...(process.env.RESEND_API_KEY ? {} : { error: 'not configured' }) };

  // Critical-only: only DB failure returns 503. Optional deps "not configured" = 200.
  const criticalOk = checks.db.ok;
  return c.json({
    ok: criticalOk,
    ts: Date.now(),
    version: process.env.npm_package_version ?? '0.2.0',
    checks,
  }, criticalOk ? 200 : 503);
});

/** Idempotency-key prune cron — every hour, removes keys older than 24h. */
app.post('/api/cron/prune-idempotency', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const r: any = await db.execute(sql`
    DELETE FROM idempotency_key WHERE created_at < NOW() - INTERVAL '24 hours' RETURNING key
  `);
  const pruned = ((r.rows ?? r) as unknown[]).length;
  return c.json({ ok: true, pruned });
});

/** Cron endpoint — call daily via Vercel Cron / external scheduler.
 *  Guard with CRON_SECRET header. */
app.post('/api/cron/meters-report', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const { reportAllOrgMeters } = await import('./lib/meters.js');
  const result = await reportAllOrgMeters();
  return c.json({ ok: true, ...result });
});

/** Audit retention cron — call daily. Prunes audit > 365 days, webhook_delivery > 30 days. */
app.post('/api/cron/prune-audit', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const { pruneAuditLog } = await import('./lib/retention.js');
  const days = Number(c.req.query('days') ?? 365);
  const result = await pruneAuditLog(days);
  return c.json({ ok: true, ...result });
});

/** Webhook delivery retry cron — call every 5min via scheduler. */
app.post('/api/cron/webhook-retry', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const { retryFailedDeliveries } = await import('./lib/webhook-retry.js');
  const result = await retryFailedDeliveries();
  return c.json({ ok: true, ...result });
});

// Stripe webhook — raw body required for signature verification.
app.post('/api/webhooks/stripe', async (c) => {
  if (!stripe) return c.json({ ok: false, error: 'Stripe not configured' }, 503);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return c.json({ ok: false, error: 'STRIPE_WEBHOOK_SECRET missing' }, 503);
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ ok: false }, 400);
  const raw = await c.req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: any) {
    return c.json({ ok: false, error: `Signature: ${e.message}` }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as any;
        const orgId = s.metadata?.organizationId ?? s.client_reference_id;
        const plan = s.metadata?.plan ?? 'starter';
        if (orgId) {
          const existing = await db.select().from(subscription).where(eq(subscription.organizationId, orgId)).limit(1);
          const values = {
            organizationId: orgId,
            stripeCustomerId: s.customer,
            stripeSubscriptionId: s.subscription,
            plan,
            status: 'trialing' as const,
          };
          if (existing.length > 0) {
            await db.update(subscription).set(values).where(eq(subscription.id, existing[0]!.id));
          } else {
            await db.insert(subscription).values(values);
          }
          await db.update(organization).set({ plan }).where(eq(organization.id, orgId));
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const s = event.data.object as any;
        await db.update(subscription).set({
          status: s.status,
          currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000) : null,
          currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
          cancelAtPeriodEnd: String(s.cancel_at_period_end ?? false),
        }).where(eq(subscription.stripeSubscriptionId, s.id));
        break;
      }
    }
  } catch (e: any) {
    const { log } = await import('./lib/logger.js');
    const { captureException } = await import('./lib/sentry.js');
    const reqId = String(c.get('requestId' as never) ?? '');
    log.error('stripe.webhook.failed', { requestId: reqId, eventType: event.type, error: e.message });
    captureException(e, { component: 'stripe-webhook', eventType: event.type, requestId: reqId });
    return c.json({ ok: false, error: e.message }, 500);
  }
  return c.json({ received: true });
});

// Better Auth handler — mounts /api/auth/sign-up, /api/auth/sign-in, /api/auth/session, etc.
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// REST API v1 (Bearer sk_live_*) — customer integrations
const { rest } = await import('./rest.js');
const { openApiSpec } = await import('./openapi.js');
// OpenAPI spec — mounted BEFORE rest router so it's unauthenticated
app.get('/api/v1/openapi.json', (c) => c.json(openApiSpec));
app.get('/api/v1/docs', (c) => c.html(`<!doctype html><html><head><title>Sitelog API</title>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/@scalar/api-reference@latest/dist/style.css"/>
</head><body><div id="app"></div>
<script id="api-reference" type="application/json">${JSON.stringify(openApiSpec)}</script>
<script src="https://unpkg.com/@scalar/api-reference@latest/dist/browser/standalone.js"></script>
</body></html>`));
app.route('/api/v1', rest);

app.use('/api/trpc/*', trpcServer({
  endpoint: '/api/trpc',
  router: appRouter,
  createContext: async (_opts, c) => {
    const session = await resolveAuthSession(c.req.raw);
    return createContext({ req: c.req.raw, session });
  },
  onError: ({ error, path }) => {
    console.error(`[trpc] ${path}: ${error.code} ${error.message}`);
  },
}));

const port = Number(process.env.PORT ?? 4000);
console.log(`[api] listening on http://localhost:${port}`);

export default { port, fetch: app.fetch };
