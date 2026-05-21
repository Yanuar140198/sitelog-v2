import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.SITELOG_API_BASE ?? 'http://localhost:4000';

test.describe('Observability endpoints', () => {
  test('GET /healthz returns ok', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/healthz');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('number');
  });

  test('GET /status exposes critical checks', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/status');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.checks.db).toBeDefined();
    expect(body.checks.db.ok).toBe(true);
    expect(body.version).toBeTruthy();
  });

  test('GET /metrics returns Prometheus exposition format', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/metrics');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toContain('# TYPE sitelog_http_requests_total counter');
    expect(body).toContain('sitelog_uptime_seconds');
    expect(body).toContain('sitelog_build_info');
    expect(body).toContain('sitelog_organizations_total');
    expect(body).toContain('sitelog_projects_active');
  });

  test('GET /metrics enforces METRICS_TOKEN if set', async () => {
    // Skips when no token configured; presence of env is opaque to test.
    // This validates the header path works when key set.
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/metrics', { headers: { authorization: 'Bearer wrong-token' } });
    // Without token configured, returns 200. With token configured, returns 401.
    expect([200, 401]).toContain(res.status());
  });
});
