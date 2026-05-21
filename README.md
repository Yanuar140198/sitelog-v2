# Sitelog v2

End-to-end construction SaaS — BOQ estimation, fleet planning, daily reporting, SPI/CPI tracking.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15 · React 19 · Tailwind v4 |
| Mobile | Expo SDK 52 · React Native 0.76 (New Arch) · Expo Router |
| API | Hono · tRPC v11 · Bun runtime |
| DB | PostgreSQL (Neon serverless) · Drizzle ORM |
| Auth | Better Auth · 2FA TOTP · org plugin |
| Storage | Cloudflare R2 |
| Billing | Stripe Subscriptions |
| Realtime | (Phase 2) Liveblocks / Convex |
| Email | Resend + React Email |
| Monitoring | Sentry · PostHog |
| Monorepo | Turborepo · pnpm workspaces |

## Workspace layout

```
sitelog-v2/
├── apps/
│   ├── web/          Next.js 15 SaaS dashboard
│   ├── mobile/       Expo SDK 52 field app
│   └── api/          Hono + tRPC backend (Bun)
├── packages/
│   ├── db/           Drizzle schema (tenancy, ahsp, project, boq, fleet, entries, billing, audit)
│   ├── auth/         Better Auth wrapper (multi-tenant aware)
│   ├── api-client/   tRPC client + React provider
│   ├── ui/           Shared UI components (shadcn-based)
│   └── config/       Shared eslint/tsconfig/tailwind
└── turbo.json
```

## Setup

```bash
pnpm install
cp .env.example .env
# fill DATABASE_URL + BETTER_AUTH_SECRET (min 32 chars)
pnpm db:generate
pnpm db:migrate
pnpm dev       # runs web (3000) + api (4000) + mobile (Metro 8081)
```

## Multi-tenant model

```
user ──┐
       ├── membership (role per org) ── organization ──┬── project ──┬── boq_item
       │                                               │             ├── boq_resource_override
       │                                               │             ├── project_fleet_assignment
       │                                               │             └── daily_entry ─┬── entry_activity
       │                                               │                              ├── entry_equipment_util
       │                                               │                              └── entry_photo
       │                                               ├── unit
       │                                               ├── ahsp_item (org-scoped overlay on global catalog)
       │                                               └── subscription (Stripe)
       └── session
```

Roles: `owner · admin · estimator · scheduler · supervisor · viewer`

## BOQ pricing engine

Unit rate per AHSP item resolved as:

```
unit_rate = Σ (resource_line.koefisien × resource_line.hsd) + ohp
  where resource_line = base AHSP resource ⊕ project resource override (per code)
```

Project totals:
```
subtotal       = Σ (boq_item.quantity × unit_rate)
markup_amt     = subtotal × markup_pct
contingency    = subtotal × contingency_pct
pre_ppn        = subtotal + markup_amt + contingency
ppn_amt        = pre_ppn × ppn_pct
grand_total    = pre_ppn + ppn_amt
```

## SPI/CPI

```
earned_value (EV) = Σ (boq_item.quantity_actual × unit_rate)   ← from entry activities
planned_value (PV) = subtotal × (time_elapsed / total_duration)
SPI = EV / PV
CPI = EV / AC   (AC = equipment HM × rate + fuel + labor)
```

## Deployment

- **Web**: Vercel (preview per PR, prod on main)
- **API**: Vercel Edge Functions or Cloudflare Workers (Hono is edge-ready)
- **Mobile**: EAS Build + Update channels (preview, prod)
- **DB**: Neon (branch-per-env, auto preview branches)
- **CI**: GitHub Actions (typecheck + lint + drizzle migrate dry-run)

## Migration from legacy spi.k11ops.com

Existing Google Sheets-backed FastAPI app remains operational for internal SCM ops.
Sitelog v2 is a fresh greenfield rebuild. Migration script (TBD):
```
scripts/migrate-from-legacy.ts
  → reads Sheets (via SA) → seeds Postgres → assigns to default "PT SCM" org
```
