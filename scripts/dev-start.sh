#!/usr/bin/env bash
# Boot local dev stack: Docker Postgres + migrations + API + Web.
set -e

CONTAINER=sitelog-pg
PORT=5434
DB_URL="postgresql://postgres:dev@localhost:${PORT}/sitelog"

echo "[dev-start] Checking Docker..."
if ! docker ps >/dev/null 2>&1; then
  echo "ERROR: Docker daemon not running. Start Docker Desktop first."
  exit 1
fi

if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[dev-start] Creating Postgres container..."
  docker run -d --name ${CONTAINER} -p ${PORT}:5432 \
    -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=sitelog \
    postgres:16-alpine
  sleep 4
elif ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[dev-start] Starting existing Postgres container..."
  docker start ${CONTAINER}
  sleep 3
fi

echo "[dev-start] Applying migrations..."
DATABASE_URL="${DB_URL}" pnpm --filter @sitelog/db migrate

cat <<EOF

✓ DB ready at ${DB_URL}

Next:
  1. API:  cd apps/api && DATABASE_URL="${DB_URL}" BETTER_AUTH_SECRET=dev-secret-32-bytes-long-stub-secret-key bun src/server.ts
  2. Web:  cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm dev
  3. Open: http://localhost:3000

Seed AHSP (optional):
  DATABASE_URL="${DB_URL}" bun packages/db/src/seed/ahsp-from-legacy.ts \\
    --rates path/to/ahsp_rates.json --detail path/to/ahsp_detail.json
EOF
