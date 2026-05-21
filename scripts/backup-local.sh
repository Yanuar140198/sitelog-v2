#!/usr/bin/env bash
# Local backup helper — dumps Docker Postgres to file (no R2 needed).
# Useful for dev snapshots before destructive migrations.

set -e
CONTAINER="${1:-sitelog-pg}"
OUT_DIR="${2:-./backups}"
mkdir -p "$OUT_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$OUT_DIR/sitelog-$STAMP.sql.gz"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '$CONTAINER' not running" >&2
  exit 1
fi

echo "[backup] dumping from container '$CONTAINER' → $OUT"
docker exec "$CONTAINER" pg_dump -U postgres -d sitelog | gzip > "$OUT"

SIZE=$(wc -c < "$OUT")
echo "[backup] done — ${SIZE} bytes"
echo "[backup] restore: gunzip -c $OUT | docker exec -i $CONTAINER psql -U postgres -d sitelog"
