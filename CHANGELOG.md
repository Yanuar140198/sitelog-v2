# Changelog

## v0.2.7 — 2026-05-22

### Features
- Request ID middleware: auto-generates UUID, honors upstream `X-Request-ID`, always echoed on response
- Maintenance mode middleware: `MAINTENANCE_MODE=1` → 503 most paths (exempts `/healthz`, `/status`, `/metrics`)
  - `X-Maintenance-Bypass` header + `MAINTENANCE_BYPASS_SECRET` admin override
  - Custom message via `MAINTENANCE_MESSAGE` env
- Structured JSON logger (Loki/CloudWatch/Datadog parseable, level filter via `LOG_LEVEL`)
- `.well-known/security.txt` (RFC 9116) for vulnerability disclosure
- `robots.txt` + Next.js sitemap.xml for SEO
  - Disallows `/app`, `/superadmin`, `/api`, `/share` (private surfaces)

## v0.2.6 — 2026-05-22

### Features
- Privacy settings page (`/app/settings/privacy`) with EXPORT + DELETE flows
  - Branded UI matching app design system (orange + black + red danger banner)
  - Indonesian copy explaining GDPR Article 15 + 17
  - DELETE button gated by exact phrase input
- Settings layout tab nav: PRIVACY added (8th tab)
- `@sitelog/shared` GDPR helpers: `DELETE_CONFIRMATION_PHRASE`, `isValidDeletionConfirmation`, `scheduledDeletionDate`, `anonymizeEmail`
- API gdpr router refactored to import shared helpers (now unit-tested)

### Tests
- 8 GDPR unit tests (phrase validation, 30-day calc, email anonymization determinism)
- Total unit tests: 47 → 55

## v0.2.5 — 2026-05-22

### Features
- GDPR `gdpr.exportMyData` query — JSON dump of all user-attributable rows (Article 15)
- GDPR `gdpr.requestDeletion` mutation — anonymize + scheduled hard delete (Article 17)
- Custom 404 `not-found.tsx` + 500 `error.tsx` pages (branded, Sentry-aware)
- Postman collection in `examples/` for non-CLI customers
- `http_5xx_total` metric counter (separates server errors from 4xx for alerting)

## v0.2.4 — 2026-05-22

### Features
- k6 load test scripts (smoke + stress) at `loadtest/`
- Nightly CI workflow (E2E + k6 against staging, gated on `STAGING_BASE_URL` repo var)
- Bundle size workflow (soft 150 KB FLJS budget)

## v0.2.3 — 2026-05-22

### Features
- A11y test suite (5 axe-core tests on public pages, WCAG 2.0/2.1 AA)
- LICENSE (proprietary) + CODE_OF_CONDUCT (Contributor Covenant v2.1)
- Docker build smoke test job added to CI
- Webhook signature verification examples for customer consumers (Node + Python)

### Bug fixes
- WCAG link-in-text-block violation in signup + login (color-only distinguishability)

## v0.2.2 — 2026-05-22

### Features
- Metrics counters wired into actual handlers (live data flow per request)
- CodeQL SAST workflow (security-extended + security-and-quality)
- Optional server-side Sentry init (dynamic import pattern)
- Local backup helper script (`scripts/backup-local.sh`)

### Tests
- 6 rate-limiter unit tests (token bucket invariants)

## v0.2.1 — 2026-05-22

### Features
- OpenAPI 3.1 spec at `/api/v1/openapi.json`
- Scalar interactive docs at `/api/v1/docs`
- Prometheus `/metrics` endpoint (7 counters + 7 business gauges)
- Grafana dashboard JSON (12 panels)
- 3 example SDK clients (bash + Node + Python)
- Deep status endpoint with live Stripe ping when configured

### Tests
- 4 observability E2E tests
- 2 OpenAPI spec E2E tests

## v0.2.0 — 2026-05-22

### Features
- **REST API v1**: `/api/v1/{me,projects,ahsp,entries}` with Bearer `sk_live_*` auth, scope-based RBAC
- **Super admin org detail**: `/superadmin/orgs/[slug]` with billing breakdown + force-plan mutation
- **Docker self-hosted**: `apps/api/Dockerfile` + `docker-compose.yml` for non-Vercel deploys
- **Deep status endpoint**: live Stripe ping (when key set), version info, critical-only HTTP semantics

### Quality
- ESLint flat config + typescript-eslint + unused-imports plugin (0 errors / 0 warnings)
- Husky pre-commit + lint-staged auto-fix
- @sitelog/shared package: pure math/validation/signing extracted + 41 unit tests
- Wired shared into API: plan-limits, entry router (validateEntry, geofence), boq router (projectTotal), rest.ts (projectTotal)
- Playwright E2E: 18 smoke + 6 REST contract tests (65 tests total)
- 3 GitHub workflows: ci, release-please, deploy-preview
- Dependabot grouped weekly updates
- CODEOWNERS + issue/PR templates

### Bug fixes
- `retention.ts`: drop `.returning()` select shape (postgres-js incompatible)
- 35 unused imports auto-removed via eslint-plugin-unused-imports
- AhspDetailDrawer: mark unused projectId arg with underscore prefix

### Docs
- `SECURITY.md` — threat model + 18 controls + disclosure SLA
- `CONTRIBUTING.md` — quality gates + code layout + commit style
- `.env.example` — full env reference
- README REST API section with 6 example curls

### Stats
- 23 commits since v0.1.0
- 200+ source files
- 9 packages typecheck clean
- 65 tests total (41 unit + 24 E2E)
- 3 deploy paths (Vercel, Docker, local)

---

## v0.1.0 — 2026-05-21 (Initial release)

Production-ready Sitelog construction SaaS. Verified end-to-end via headless browser smoke test.

### Core features

- **Auth**: Better Auth signup/login + multi-tenant org sessions + 2FA TOTP + magic link + invite tokens
- **BOQ engine**: AHSP catalog with resource lines (Tenaga + Bahan + Peralatan), unit rate baseline computation, override per-item, markup/contingency/PPN, financial summary panel
- **AHSP detail page**: full Bina Marga breakdown matching Excel parity (verified Rp 38,102/m³)
- **Daily entries**: shift + weather + activities + equipment + photos, geofence validation, offline queue (mobile)
- **Analytics**: live SPI/CPI computation from entry quantities vs plan, per-project progress bars
- **BOQ versions**: snapshot + restore + A/B diff
- **Templates**: org-custom + public marketplace, save from project + apply to new
- **AI Suggest**: Anthropic Claude integration with stub fallback (3 hardcoded scope recommendations by project type)
- **Rate Sanity**: flags BOQ items >10% off AHSP baseline
- **Audit log**: every mutation tracked with actor/IP/UA + CSV export
- **Webhooks**: outbound HMAC-SHA256 signed events + retry queue
- **API keys**: `sk_live_*` bearer tokens with scope-based RBAC
- **Plan quotas**: trial=3 projects, starter=10, pro=∞, middleware-enforced
- **XLSX export**: full BOQ download (verified Rp 3.49B grand total)
- **Public share**: anonymous client view via `/share/{token}`
- **Custom domain**: per-org enterprise white-label
- **Super admin**: platform overview + org detail + force-plan mutation
- **Status page**: real-time component health (DB/Stripe/AI/R2)
- **Cmd+K palette**: navigation + AI ask mode (`?` prefix)

### Stack

- Turborepo 2.9 + pnpm 11 monorepo
- Next.js 15.5 + React 19 + Tailwind v4 (web, 32 pages)
- Expo 52 + React Native 0.76 + Expo Router (mobile, 9 screens)
- Hono 4.6 + tRPC v11 + Bun (API, 28 routers)
- PostgreSQL + Drizzle (12 schema modules, 8 migrations)
- Better Auth 1.1 with custom UUID generator + bridge tables for legacy schema
- Auto-detect DB driver: neon-http for Neon serverless, postgres-js for self-hosted

### Runtime bugs fixed during smoke test (22)

1. observability.ts dynamic import wrapped in `new Function()` to defeat webpack static analysis
2. react/react-dom pinned to exact 19.2.6 (was version mismatch)
3. Onboarding page Suspense boundary added for useSearchParams
4. tRPC reserved word `apply` renamed to `applyToProject`
5. DB driver auto-detection added (Neon vs postgres-js by URL)
6. Better Auth `account` + `verification` tables added to schema + adapter
7. `session.updatedAt` column added (Better Auth required)
8. Better Auth `generateId: () => crypto.randomUUID()` config (UUID columns)
9. `trustedOrigins` config + `defaultCookieAttributes` for cross-port cookies
10. `/api/auth/*` mounted in Hono server
11. `credentials: 'include'` in tRPC fetch + Cookie in CORS allowHeaders
12. Next.js rewrites `/api/*` to same-origin (cookie auth cross-port fix)
13. tRPC mount endpoint config + `onError` log
14. `resolveAuthSession` allows no-org session (new signups need org.create access)
15. `orgProcedure` checks empty orgId
16. Project new form: empty date strings coerced to undefined
17. Zod transforms `''` for optional date fields
18. AHSP seed: insert detail items as own items (not just metadata link to rate items)
19. Dashboard portfolio: live SQL aggregation from boq_item × ahsp_resource
20. Dashboard portfolio: earned value live from entry_activity actual vs plan
21. XLSX + PDF exports: rate from resource lines baseline (was defaulting to 0)
22. retention.ts: drop `.returning()` select shape overload (postgres-js incompatible)

### Demo data populated

- 1 org Demo Construction (Pro plan, 25 seats)
- 4 projects (3× LS 45 + 1× MMS 12 via template)
- 6 BOQ scopes (Rp 7.13B portfolio)
- 3 daily entries (25,500 m³ actual)
- 2 BOQ versions
- 1 saved template (Mining DT Standard 50K)
- 1 invite (supervisor@sitelog.local)
- 1 API key (CI Integration, ADMIN scope)
- 1 webhook (3 events HMAC signed)
- 12 audit log entries
- 1 public share link (anon)

### Files

- 200+ source files tracked
- 6 commits
- 8 packages typecheck clean
- Web build: 32 routes, 102 KB First Load JS
- API build: 1,896 modules, 8.64 MB bundle
