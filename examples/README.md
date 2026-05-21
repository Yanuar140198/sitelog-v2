# Sitelog API examples

Reference clients + cookbooks for the Sitelog REST API v1.

## Setup

1. Generate an API key at `https://sitelog.app/app/settings/api-keys` (scope: `read` is enough for these examples).
2. Export it:
   ```bash
   export SITELOG_API_KEY=sk_live_xxx
   export SITELOG_API_BASE=https://api.sitelog.app/api/v1  # or http://localhost:4000/api/v1
   ```

## Files

| File | Language | What it does |
|---|---|---|
| `curl-cookbook.sh` | bash + curl + jq | Walks all 6 endpoints |
| `node-sdk.ts` | TypeScript | Typed client class with usage example |
| `python-sdk.py` | Python 3 + httpx | Equivalent in Python |
| `webhook-verify-node.ts` | TypeScript | HMAC-SHA256 verify for incoming webhooks |
| `webhook-verify-python.py` | Python | HMAC-SHA256 verify for incoming webhooks |

## Running

```bash
bash examples/curl-cookbook.sh
bun examples/node-sdk.ts
python examples/python-sdk.py
```

## Spec

OpenAPI 3.1 spec lives at `/api/v1/openapi.json`. Use any code generator:

```bash
npx openapi-typescript "$SITELOG_API_BASE/openapi.json" -o sitelog.d.ts
```

Interactive docs: `https://api.sitelog.app/api/v1/docs` (Scalar UI).
