# Sitelog v2

Enterprise construction SaaS for BOQ estimation, fleet planning, daily reporting, SPI/CPI tracking. AHSP-based (Bina Marga) unit rate engine. Multi-tenant, real-time, mobile-first.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo 2.9 + pnpm 11 |
| Web | Next.js 15.5 + React 19 + Tailwind v4 |
| Mobile | Expo SDK 52 + React Native 0.76 + Expo Router |
| API | Hono 4.6 + tRPC v11 + Bun runtime |
| DB | PostgreSQL + Drizzle ORM (auto-detects Neon vs postgres-js) |
| Auth | Better Auth 1.1 + org plugin + 2FA + magic link |
| Storage | Cloudflare R2 (S3-compatible) |
| Billing | Stripe checkout + portal + webhooks + metered |
| AI | Anthropic Claude (Sonnet 4.6 + Haiku 4.5) |
| Email | Resend + React Email |
| Push | Expo Push (mobile) + Web Push VAPID |
| Observability | Sentry + PostHog (optional via dynamic import) |

## Local dev

```bash
# 1. Install
pnpm install

# 2. Boot Postgres + apply migrations
pnpm dev:db

# 3. Seed AHSP catalog (optional)
DATABASE_URL=postgresql://postgres:dev@localhost:5434/sitelog \
  bun packages/db/src/seed/ahsp-from-legacy.ts \
  --rates path/to/ahsp_rates.json --detail path/to/ahsp_detail.json

# 4. Start API + Web (two terminals)
pnpm api:dev      # → http://localhost:4000
pnpm web:dev      # → http://localhost:3000

# 5. Mobile
pnpm mobile:dev   # → Expo dev server
```

Open http://localhost:3000 → signup → onboarding → dashboard.

## Project structure

```
apps/
  web/        Next.js 15 — 32 pages (marketing, app, superadmin, public share)
  api/        Hono + tRPC — 28 routers, 16 backend libs, edge-compatible
  mobile/     Expo 52 — 9 screens (auth, projects, entry form, fleet, settings)
packages/
  db/         Drizzle schema + migrations + seeds (12 modules, 8 migrations)
  auth/       Better Auth config + session resolver
  api-client/ tRPC + React Query provider
  emails/     React Email templates
  shared/     Utility helpers shared across surfaces
scripts/
  dev-start.sh  One-shot Docker Postgres boot
```

## Features verified end-to-end

- **Auth**: signup → email/password → org onboarding → multi-tenant cookie session
- **BOQ workspace**: AHSP catalog (77 items + 44 resource lines) → click to add scope → live financial summary
- **AHSP detail**: Bina Marga breakdown (Tenaga + Bahan + Peralatan) with koef × HSD
- **Daily entries**: submit with activities → SPI/CPI computed live → analytics dashboard
- **Versions**: snapshot + restore + A/B diff
- **Templates**: save from project → apply to new project
- **AI Suggest**: stubbed scopes by project type (Mining/Road/Bridge); real Claude integration ready (set ANTHROPIC_API_KEY)
- **Rate Sanity**: flags items >10% off AHSP baseline
- **Plan quotas**: trial=3 projects, starter=10, pro=∞, enforced via middleware
- **Audit log**: every mutation logged with actor/IP/UA; CSV export
- **Webhooks**: outbound HMAC-SHA256 signed events, retry queue, signature verify endpoint
- **API keys**: `sk_live_...` bearer for programmatic access, scope-based RBAC (read/write/admin)
- **XLSX export**: full BOQ with computed rates, totals, markup/contingency/PPN
- **Public share**: anonymous client view via `/share/{token}`, no auth
- **Custom domain**: per-org enterprise white-label (`/app/settings/domain`)
- **Super admin**: platform overview (`/superadmin`), org detail, force plan change
- **Status page**: real-time component health (DB/Stripe/AI/R2)
- **Cmd+K palette**: navigation + AI mode (`?` prefix)

## REST API v1

Customer-facing integration surface backed by API keys. Generate one at `/app/settings/api-keys`.

```bash
# Verify auth
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/me

# List projects
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/projects

# Project detail + computed BOQ totals (subtotal/markup/contingency/PPN/grandTotal)
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/projects/{id}

# Daily entries for project
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/projects/{id}/entries

# Entry detail with activities
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/entries/{id}

# AHSP catalog
curl -H "Authorization: Bearer sk_live_xxx" https://api.sitelog.app/api/v1/ahsp
```

Auth: `Bearer sk_live_*`. Scopes: `read` (queries only) | `write` (queries + mutations) | `admin` (full). 401 if missing/expired/revoked.

**Interactive docs**: `/api/v1/docs` (Scalar UI) · **OpenAPI 3.1 spec**: `/api/v1/openapi.json`

## Deploy

See [DEPLOY.md](./DEPLOY.md). Stack = Vercel (web + API) + Neon (DB) + R2 (storage) + Stripe + Resend + Anthropic.

## License

Proprietary. © 2026 Sitelog.
