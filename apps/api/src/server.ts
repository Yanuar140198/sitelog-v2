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

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin ?? 'http://localhost:3000',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'Cookie'],
}));

app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

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

  // Opt-in: AI (config check only — don't burn credits)
  checks.ai = { ok: !!process.env.ANTHROPIC_API_KEY, ...(process.env.ANTHROPIC_API_KEY ? {} : { error: 'not configured' }) };

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

/** Auto-tag photos cron — every 10 min. */
app.post('/api/cron/photo-tag', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  const { processUntaggedPhotos } = await import('./lib/photo-tagger.js');
  const limit = Number(c.req.query('limit') ?? 10);
  const result = await processUntaggedPhotos(limit);
  return c.json({ ok: true, ...result });
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
    console.error('[stripe webhook]', event.type, e);
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
