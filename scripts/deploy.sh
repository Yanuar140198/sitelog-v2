#!/usr/bin/env bash
# One-shot Sitelog v2 production deploy.
# Prereqs: vercel CLI logged in, Neon DATABASE_URL set in env, npm/pnpm installed.

set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

REQUIRED_VARS=(
  DATABASE_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_WEB_URL
  SITELOG_ADMIN_EMAILS
)
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!v}" ]; then
    echo "ERROR: missing env $v"
    exit 1
  fi
done

echo "[1/5] Install workspace deps"
pnpm install --frozen-lockfile

echo "[2/5] Run DB migrations against $DATABASE_URL"
pnpm db:migrate

echo "[3/5] Build all packages"
pnpm build

echo "[4/5] Deploy API to Vercel"
cd apps/api
vercel deploy --prod --yes
cd "$ROOT"

echo "[5/5] Deploy Web to Vercel"
cd apps/web
vercel deploy --prod --yes
cd "$ROOT"

echo ""
echo "✓ Deploy complete."
echo "  Web: $NEXT_PUBLIC_WEB_URL"
echo "  API: $NEXT_PUBLIC_API_URL/healthz"
echo "  Docs: $NEXT_PUBLIC_API_URL/api/v1/docs"
echo "  Status: $NEXT_PUBLIC_WEB_URL/status"
echo ""
echo "Next steps:"
echo "  1. Visit $NEXT_PUBLIC_WEB_URL/signup → create first org"
echo "  2. Add your email to SITELOG_ADMIN_EMAILS env var for super-admin"
echo "  3. Configure Stripe webhook → $NEXT_PUBLIC_API_URL/api/webhooks/stripe"
echo "  4. (Optional) Seed AHSP catalog:"
echo "       DATABASE_URL=\$DATABASE_URL bun packages/db/src/seed/ahsp-from-legacy.ts \\"
echo "         --rates path/to/ahsp_rates.json --detail path/to/ahsp_detail.json"
