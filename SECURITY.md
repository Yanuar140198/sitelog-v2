# Security policy

## Reporting vulnerabilities

Email **security@sitelog.app**. Do not file public GitHub issues for security bugs.

Include:
- Affected component (web, API, mobile)
- Steps to reproduce
- Impact assessment
- Suggested remediation (if any)

Response timeline:
- Acknowledgement within 24h
- Triage within 72h
- Fix released within 14 days for critical, 30 days for high, 60 days for medium

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ Current |
| < 0.1 | ❌ No |

## Threat model

### In-scope
- Auth bypass (Better Auth session forge, cookie tampering, CSRF)
- Multi-tenant data leakage (cross-org read/write)
- Plan quota bypass (free→pro feature access without payment)
- API key escalation (read scope → write scope)
- Webhook signature forgery
- File upload abuse (R2 path traversal, malicious payload)
- SQL injection via tRPC inputs
- XSS in user-controlled fields (project name, BOQ notes, etc.)
- Rate limit bypass / DoS via expensive AI endpoints
- Super-admin role takeover

### Out-of-scope
- DoS via volumetric attack (handled at Cloudflare layer)
- Social engineering of customer staff
- Physical access to customer devices
- Brute-force against strong passwords (Better Auth handles rate limit)

## Security controls

| Control | Implementation |
|---|---|
| Auth | Better Auth 1.1 + bcrypt password + JWT session cookie |
| Session | HTTPOnly + SameSite=Lax + 30-day expiry + database-backed |
| RBAC | 5 roles (owner/admin/estimator/supervisor/viewer) per-org membership |
| Multi-tenant | All queries scoped by `organizationId` in `orgProcedure` middleware |
| Plan limits | `assertProjectQuota` + `assertMemberQuota` in middleware |
| API keys | `sk_live_*` bearer, SHA-256 hashed at rest, scope-based (read/write/admin) |
| Webhook signing | HMAC-SHA256 with timestamp + 5min replay tolerance |
| CSRF | Better Auth `trustedOrigins` allowlist |
| CORS | Strict origin allowlist via `cors()` middleware in Hono |
| Input validation | Zod schemas on every tRPC procedure input |
| SQL injection | Drizzle parameterized queries, no string concat |
| Secret storage | Env vars only, never committed (gitignore enforced) |
| Audit log | Every mutation logged with actor + IP + UA for forensic trail |
| Retention | Audit pruned at 365 days (configurable) |
| Encryption in transit | TLS 1.2+ via Vercel/Cloudflare |
| Encryption at rest | Postgres (Neon native) + R2 (server-side AES-256) |
| Backup | Daily `pg_dump` to R2 via `scripts/backup.ts` |
| Super-admin | Email allowlist via `SITELOG_ADMIN_EMAILS` env, separate from org RBAC |

## Disclosure

After fix:
- CVE filed if applicable
- Notification email to affected customers within 7 days
- Public advisory in CHANGELOG.md
- Credit to reporter (if requested)
