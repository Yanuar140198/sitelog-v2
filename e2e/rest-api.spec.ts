import { test, expect, request } from '@playwright/test';

/**
 * REST API v1 contract tests — runs against live API server with seeded demo data.
 * Skips if SITELOG_API_KEY env not provided.
 */

const API_BASE = process.env.SITELOG_API_BASE ?? 'http://localhost:4000';
const API_KEY = process.env.SITELOG_API_KEY;

test.describe('REST API v1', () => {
  test.skip(!API_KEY, 'SITELOG_API_KEY not set');

  test('GET /me returns scope + orgId', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/me', { headers: { authorization: `Bearer ${API_KEY}` } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.apiVersion).toBe('v1');
    expect(body.data.orgId).toMatch(/^[a-f0-9-]{36}$/);
    expect(['read', 'write', 'admin']).toContain(body.data.scope);
  });

  test('GET /projects returns array', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/projects', { headers: { authorization: `Bearer ${API_KEY}` } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(body.data.length);
  });

  test('GET /ahsp returns catalog', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/ahsp', { headers: { authorization: `Bearer ${API_KEY}` } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty('kode');
    expect(body.data[0]).toHaveProperty('satuan');
  });

  test('401 without auth', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/projects');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('401 with malformed bearer', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/projects', { headers: { authorization: 'Bearer not-a-real-key' } });
    expect(res.status()).toBe(401);
  });

  test('404 for unknown project', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/projects/00000000-0000-0000-0000-000000000000', {
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status()).toBe(404);
  });
});
