# Deploy NOW — 15 minute production launch

## 1. Provision Neon Postgres (3 min)

1. https://neon.tech → create project `sitelog-prod` (region: `aws-ap-southeast-1` Singapore)
2. Copy connection string. Format: `postgresql://user:pwd@ep-xxx.neon.tech/sitelog?sslmode=require`
3. ```bash
   export DATABASE_URL='paste-here'
   ```

## 2. Generate secrets (10 sec)

```bash
export BETTER_AUTH_SECRET='REPLACE_WITH_openssl_rand_base64_32_OUTPUT'
export CRON_SECRET='REPLACE_WITH_openssl_rand_base64_32_OUTPUT'
export METRICS_TOKEN='REPLACE_WITH_openssl_rand_base64_32_OUTPUT'
```

Quick: `openssl rand -base64 32` × 3 times. Save to password manager.

## 3. Set URLs + admin email (10 sec)

```bash
export NEXT_PUBLIC_WEB_URL='https://sitelog.app'           # your domain
export NEXT_PUBLIC_API_URL='https://api.sitelog.app'       # your API subdomain
export BETTER_AUTH_URL="$NEXT_PUBLIC_API_URL"
export BETTER_AUTH_TRUSTED_ORIGINS="$NEXT_PUBLIC_WEB_URL,$NEXT_PUBLIC_API_URL"
export SITELOG_ADMIN_EMAILS='you@yourcompany.com'
```

## 4. Vercel login + deploy (10 min)

```bash
npm i -g vercel
vercel login                       # email or GitHub
bash scripts/deploy.sh             # runs migrations + builds + deploys both apps
```

Vercel prompts:
- Link to existing project? **N** (first time)
- Project name: `sitelog-api` / `sitelog-web`
- Framework: auto-detect

## 5. Push secrets to Vercel (2 min)

```bash
cd apps/api
for v in DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL CRON_SECRET METRICS_TOKEN SITELOG_ADMIN_EMAILS; do
  echo "$v"
  vercel env add "$v" production < <(echo "${!v}")
done

cd ../web
for v in NEXT_PUBLIC_API_URL NEXT_PUBLIC_WEB_URL; do
  vercel env add "$v" production < <(echo "${!v}")
done

vercel deploy --prod              # redeploy with env populated
```

## 6. Custom domain (5 min)

Vercel dashboard → both projects → **Domains** → add `sitelog.app` (web) and `api.sitelog.app` (api). Vercel shows DNS records to add to your registrar (CNAME or A records).

## 7. Verify

```bash
curl https://api.sitelog.app/healthz                       # {"ok":true,...}
curl https://api.sitelog.app/status                        # critical: db ok
curl https://api.sitelog.app/badge/status                  # shields.io payload
open https://sitelog.app/signup                            # create first org
```

## 8. Wire optional integrations later

- **Stripe**: dashboard → Webhooks → `https://api.sitelog.app/api/webhooks/stripe` events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`. Copy signing secret → `STRIPE_WEBHOOK_SECRET` Vercel env.
- **Resend**: domain verified → API key → `RESEND_API_KEY` Vercel env.
- **R2**: bucket created → `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_PHOTOS` Vercel env.
- **Anthropic**: API key → `ANTHROPIC_API_KEY` Vercel env. AI Suggest button auto-uses it.
- **Sentry**: project DSN → `SENTRY_DSN` Vercel env. Server-side init wires automatically.

## 9. Seed AHSP catalog (optional)

```bash
DATABASE_URL='paste-prod-url' bun packages/db/src/seed/ahsp-from-legacy.ts \
  --rates path/to/ahsp_rates.json --detail path/to/ahsp_detail.json
```

77 items + 44 resource lines populated. AHSP-1 = Rp 38,102/m³ exact.

## What you get

- https://sitelog.app — landing + signup + onboarding + full app
- https://api.sitelog.app/api/v1/docs — Scalar interactive API reference
- https://api.sitelog.app/metrics — Prometheus scrape target
- https://sitelog.app/changelog — release notes (CHANGELOG.md auto-rendered)
- https://sitelog.app/changelog/rss.xml — RSS feed
- https://sitelog.app/superadmin (with admin email) — ops dashboard, 10 tabs

## Rollback

```bash
vercel rollback --prod            # reverts to previous deployment
```
