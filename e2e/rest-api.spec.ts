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

test.describe('Idempotency (POST /entries)', () => {
  test.skip(!API_KEY, 'SITELOG_API_KEY not set');

  test('same Idempotency-Key + same body → replay', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    // Find a project to attach to
    const projectsRes = await ctx.get('/api/v1/projects', { headers: { authorization: `Bearer ${API_KEY}` } });
    const projects = (await projectsRes.json()).data;
    if (!projects.length) test.skip();
    const projectId = projects[0].id;
    const idempKey = `e2e-${Date.now()}`;
    const body = { projectId, entryDate: '2026-05-22', shift: 'day', effectiveHours: 8, workforce: 10 };

    const r1 = await ctx.post('/api/v1/entries', {
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json', 'idempotency-key': idempKey },
      data: body,
    });
    expect(r1.status()).toBe(201);
    const id1 = (await r1.json()).data.id;

    const r2 = await ctx.post('/api/v1/entries', {
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json', 'idempotency-key': idempKey },
      data: body,
    });
    expect(r2.status()).toBe(201);
    expect(r2.headers()['x-idempotent-replay']).toBe('1');
    const id2 = (await r2.json()).data.id;
    expect(id2).toBe(id1);  // same entry
  });

  test('same Idempotency-Key + diff body → 409 conflict', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const projectsRes = await ctx.get('/api/v1/projects', { headers: { authorization: `Bearer ${API_KEY}` } });
    const projects = (await projectsRes.json()).data;
    if (!projects.length) test.skip();
    const projectId = projects[0].id;
    const idempKey = `e2e-conflict-${Date.now()}`;

    const r1 = await ctx.post('/api/v1/entries', {
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json', 'idempotency-key': idempKey },
      data: { projectId, entryDate: '2026-05-22', shift: 'day', notes: 'first' },
    });
    expect(r1.status()).toBe(201);

    const r2 = await ctx.post('/api/v1/entries', {
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json', 'idempotency-key': idempKey },
      data: { projectId, entryDate: '2026-05-22', shift: 'day', notes: 'second (different)' },
    });
    expect(r2.status()).toBe(409);
    expect((await r2.json()).error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});

test.describe('OpenAPI spec', () => {
  test('GET /api/v1/openapi.json returns valid 3.1 spec without auth', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/openapi.json');
    expect(res.ok()).toBeTruthy();
    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\.[01]\./);
    expect(spec.info.title).toBe('Sitelog API');
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(6);
    expect(spec.components.securitySchemes.ApiKey).toBeDefined();
  });

  test('GET /api/v1/docs returns HTML reference UI', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/v1/docs');
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Sitelog API');
  });
});
