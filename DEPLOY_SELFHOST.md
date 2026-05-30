# Self-host deploy (alongside an existing app)

Runs Sitelog v2 on your own server (e.g. the LXC box) behind Cloudflare Tunnel,
on its own subdomain — **without touching** any other app (e.g. `spi.k11ops.com`).

Two hostnames: `app.k11ops.com` → **web**, `api.k11ops.com` → **api**. The browser
talks to BOTH — the auth client + status page call the API directly (not only via the
web proxy), so the API must be browser-reachable on its own origin.

```
Browser ─┬─► app.k11ops.com (Tunnel) ──► web:3000 ──► db (Postgres)
         └─► api.k11ops.com (Tunnel) ──► api:4000 ──► db
```
(LAN / no-DNS: reach web at `http://<host>:3000` and api at `http://<host>:4000`.)

## 1. Prereqs on the server
- Docker + Docker Compose plugin.
- `cloudflared` already running (you have it for SPI) — we just add one ingress rule.

## 2. Get the code
```bash
git clone https://github.com/Yanuar140198/sitelog-v2.git
cd sitelog-v2
git checkout feat/ai-assistant   # until merged to master
```

## 3. Configure `.env`
```bash
cp .env.example .env
```
Set at minimum:
```
POSTGRES_PASSWORD=<strong-random>
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)
SITELOG_ADMIN_EMAILS=you@k11ops.com

# Public origins — web + api are SEPARATE browser-reachable hostnames:
NEXT_PUBLIC_WEB_URL=https://app.k11ops.com
NEXT_PUBLIC_API_URL=https://api.k11ops.com
BETTER_AUTH_URL=https://api.k11ops.com
BETTER_AUTH_TRUSTED_ORIGINS=https://app.k11ops.com,https://api.k11ops.com
```
(Stripe/Resend/R2/Anthropic are optional — leave blank to disable those features.
AI keys are normally added per-org in the app at `/app/ai`.)

## 4. Bring it up
```bash
docker compose up -d --build
```
- `db` auto-applies `packages/db/schema.sql` + `seed.sql` on first boot (fresh volume).
- `api` listens on :4000, `web` on :3000 (localhost only on the host).

Check:
```bash
docker compose ps
curl -s localhost:4000/healthz      # {"ok":true,...}
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000   # 200
```

## 5. Cloudflare Tunnel — add the subdomain
Add an ingress rule for the new hostname pointing at the web container, then a DNS route.

`~/.cloudflared/config.yml` (add under `ingress:`, **before** the final `service: http_status:404`):
```yaml
  - hostname: app.k11ops.com
    service: http://localhost:3000
  - hostname: api.k11ops.com
    service: http://localhost:4000
```
Route DNS for both: `cloudflared tunnel route dns <TUNNEL> app.k11ops.com` and
`... api.k11ops.com`.
Then:
```bash
cloudflared tunnel route dns <YOUR_TUNNEL_NAME> app.k11ops.com
sudo systemctl restart cloudflared   # or however your tunnel runs
```
This is additive — your existing `spi.k11ops.com` rule is untouched.

## 6. First use
1. Open `https://app.k11ops.com` → sign up (the email you put in `SITELOG_ADMIN_EMAILS`
   becomes a super-admin).
2. To enable AI: go to `/app/ai`, paste an Anthropic key (`sk-ant-…`) — stored encrypted per org.

## Updating
```bash
git pull
docker compose up -d --build
```
Schema changes: re-apply the dump (idempotent for additive changes is NOT guaranteed —
for a clean re-init drop the volume, or apply a targeted ALTER):
```bash
docker compose exec -T db psql -U sitelog -d sitelog < packages/db/schema.sql
```

## Notes
- Runs fully independent of SPI (different containers, DB, hostname).
- No Vercel/Stripe/Neon needed for the core app — Postgres is in the compose stack.
- Back up the `pgdata` volume for your data.
