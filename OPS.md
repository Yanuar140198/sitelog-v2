# Operations Runbook

## Backup + Restore

Daily backup via cron or manual:
```bash
DATABASE_URL=... bun scripts/backup.ts backup
# → uploads to r2://sitelog-backups/backups/sitelog-2026-05-21-1234.sql.gz
```

Restore (DANGEROUS — overwrites current DB):
```bash
DATABASE_URL=... bun scripts/backup.ts restore backups/sitelog-2026-05-21-1234.sql.gz
```

Automate via GitHub Action / Vercel Cron with R2 lifecycle for retention (30/90 days).

## Database migrations

Generate migration after schema change:
```bash
pnpm db:generate --name=description
```

Apply to live DB:
```bash
pnpm db:migrate
```

Migration files in `packages/db/drizzle/`. Each is idempotent and tracked via `_journal.json`.

## Monitoring

- **Sentry**: errors auto-captured if `NEXT_PUBLIC_SENTRY_DSN` set
- **PostHog**: page views + custom events via `trackEvent()` helper
- **Stripe Dashboard**: subscription state, MRR, churn
- **Neon Console**: query performance, connection pool, storage
- **Cloudflare**: R2 storage usage, bandwidth
- **Anthropic Console**: AI token usage

## Customer support

Super-admin panel `/superadmin`:
- View all organizations with member + project counts
- Subscription plan breakdown
- Identify churning accounts

Per-org investigation:
- Audit log (`/app/audit` while impersonating, or query DB directly)
- Usage stats per metric (`usage_record` table)
- Webhook delivery history (`webhook_delivery`)

## Common incidents

### Stripe webhook failing
1. Check Stripe Dashboard → Webhooks → recent deliveries
2. Verify `STRIPE_WEBHOOK_SECRET` env matches
3. Check API logs for signature verification errors

### R2 upload failing
1. Verify `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` valid
2. Check bucket CORS allows PUT from web origin
3. Test presigned URL: `curl -X PUT -d @photo.jpg <presigned-url>`

### AI rate limited
1. User hits 20/min limit → block returns TOO_MANY_REQUESTS
2. Org hits plan quota → check `usage_record` aggregation
3. Anthropic billing → check `ANTHROPIC_API_KEY` not throttled

### Org locked out (lost owner)
Direct DB action only:
```sql
INSERT INTO membership (user_id, organization_id, role, accepted_at)
VALUES ('<new-owner-user-id>', '<org-id>', 'owner', NOW());
```

## Scaling notes

- **Rate limiter**: in-memory single-instance. For multi-instance, swap `lib/rate-limit.ts` Map → Upstash Redis.
- **Webhook dispatch**: synchronous in mutation handler. For high-throughput, move to queue (Inngest, BullMQ).
- **Photo storage**: R2 is cheap egress-free. Consider Cloudflare Images for transforms.
- **Database**: Neon scales reads via branching. For writes, monitor compute units.

## Compliance

- **Audit log**: 365-day default retention, pruned by weekly cron
- **GDPR/PDP**: hard delete user via cascade FK on `user.id`
- **Data residency**: Neon regions (US East/West/EU/Asia)
- **Backup retention**: R2 lifecycle policy recommended (30d hot, 90d cold)

## On-call checklist

- Status page green? https://status.sitelog.app
- Sentry errors trending? Check past 1h
- Stripe webhooks all 2xx?
- DB latency p95 < 100ms?
- AI call success rate > 99%?
