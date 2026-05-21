# Deployment Guide

End-to-end deploy of Sitelog v2 (web + API + mobile) to production.

## Prerequisites

- Node 20+, pnpm 11+, Bun (for API runtime)
- Vercel account (web + API hosting)
- Neon (Postgres serverless) — sign up at https://neon.tech
- Cloudflare account (R2 storage + optional Workers for API)
- Stripe account (test + live keys)
- Resend account (transactional email)
- Anthropic API key (Claude AI)
- Expo account (mobile OTA + EAS Build)

## Environment variables

Copy `.env.example` → `.env` and fill all keys before deploy.

### Required for prod
```
DATABASE_URL=postgresql://...neon.tech/sitelog?sslmode=require
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://api.sitelog.app

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

RESEND_API_KEY=re_...
EMAIL_FROM=Sitelog <noreply@sitelog.app>

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=sitelog-photos
R2_PUBLIC_URL=https://cdn.sitelog.app

ANTHROPIC_API_KEY=sk-ant-...

CRON_SECRET=<openssl rand -hex 32>
SITELOG_ADMIN_EMAILS=ops@sitelog.app,founder@sitelog.app

NEXT_PUBLIC_API_URL=https://api.sitelog.app
NEXT_PUBLIC_WEB_URL=https://app.sitelog.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...     # for web push
EXPO_PUBLIC_API_URL=https://api.sitelog.app
```

### Optional
```
STRIPE_METER_AI_CALLS=evt_ai_calls
STRIPE_METER_STORAGE_MB=evt_storage
STRIPE_METER_API_CALLS=evt_api

INTELLITRAC_BASE=https://i-app2.intellitrac.com.au
INTELLITRAC_USER=...
INTELLITRAC_PASS=...

NEXT_PUBLIC_SENTRY_DSN=https://...sentry.io/...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Database

```bash
pnpm install
pnpm db:generate    # if schema changed
pnpm db:migrate     # apply migrations to Neon
```

To seed AHSP catalog from legacy:
```bash
bun packages/db/src/seed/ahsp-from-legacy.ts \
  --rates path/to/ahsp_rates.json \
  --detail path/to/ahsp_detail.json
```

## Web (Next.js → Vercel)

```bash
cd apps/web
vercel --prod
```

Or via Git: connect repo to Vercel, set root dir = `apps/web`, framework = Next.js, build cmd = `cd ../.. && pnpm --filter @sitelog/web build`.

## API (Hono Bun → Vercel / Cloudflare Workers)

Vercel Edge Functions:
```bash
cd apps/api
# Adapter for Vercel: use @hono/node-server or @hono/vercel
vercel --prod
```

Or self-host on a VPS:
```bash
bun apps/api/src/server.ts
# Behind nginx/caddy reverse proxy
```

## Mobile (Expo + EAS)

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
npx eas-cli submit --platform android
```

OTA updates:
```bash
npx eas-cli update --branch production
```

## Stripe setup

1. Create Products → Starter ($29/mo), Pro ($99/mo).
2. Add prices, copy IDs to env.
3. Configure webhook endpoint: `https://api.sitelog.app/api/webhooks/stripe`.
4. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`.

## Cron schedule

Use Vercel Cron, or external scheduler (cron-job.org, GitHub Actions). All endpoints require header `X-Cron-Secret: $CRON_SECRET`.

| Path | Schedule | Purpose |
|---|---|---|
| POST `/api/cron/webhook-retry` | `*/5 * * * *` | Retry failed webhook deliveries |
| POST `/api/cron/meters-report` | `0 2 * * *` | Report usage to Stripe meters |
| POST `/api/cron/prune-audit?days=365` | `0 3 * * 0` | Weekly audit log pruning |

## R2 bucket setup

1. Create R2 bucket `sitelog-photos` (private).
2. Generate API token with R/W to bucket.
3. Optionally enable public access via custom domain → set `R2_PUBLIC_URL`.

## VAPID keys (web push)

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (frontend) + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (backend, when wiring web-push send).

## Super admin

Add your email to `SITELOG_ADMIN_EMAILS` env to access `/superadmin` panel.
