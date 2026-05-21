#!/usr/bin/env bash
# Sitelog REST API v1 — curl cookbook.
# Requires: SITELOG_API_KEY env var. Generate at /app/settings/api-keys.

API="${SITELOG_API_BASE:-https://api.sitelog.app/api/v1}"
KEY="${SITELOG_API_KEY:?Set SITELOG_API_KEY env var}"

# Verify auth
echo "=== GET /me ==="
curl -sf -H "Authorization: Bearer $KEY" "$API/me" | jq

# List projects
echo "=== GET /projects ==="
curl -sf -H "Authorization: Bearer $KEY" "$API/projects" | jq '.data[] | {code, name, status}'

# Get first project ID + detail
echo "=== GET /projects/:id ==="
PROJ_ID=$(curl -sf -H "Authorization: Bearer $KEY" "$API/projects" | jq -r '.data[0].id')
curl -sf -H "Authorization: Bearer $KEY" "$API/projects/$PROJ_ID" | jq '.data.totals'

# Project entries
echo "=== GET /projects/:id/entries ==="
curl -sf -H "Authorization: Bearer $KEY" "$API/projects/$PROJ_ID/entries" | jq '.count'

# AHSP catalog
echo "=== GET /ahsp ==="
curl -sf -H "Authorization: Bearer $KEY" "$API/ahsp" | jq '.count'

# OpenAPI spec (no auth required)
echo "=== GET /openapi.json ==="
curl -sf "$API/openapi.json" | jq '.info, (.paths | keys)'
