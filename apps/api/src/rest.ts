/**
 * REST API surface (/api/v1/*) — customer-facing integration endpoints.
 *
 * Auth: Bearer sk_live_... API keys (sha256 hashed in DB).
 * Scope-based access: read | write | admin
 *
 * Standard error shape: { error: { code: string, message: string } }
 */
import { Hono } from 'hono';
import { db, project, boqItem, ahspItem, ahspResource, dailyEntry, entryActivity, apiKey } from '@sitelog/db';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { projectTotal } from '@sitelog/shared';
import { rateLimit } from './lib/rate-limit.js';

type RestVars = { orgId: string; scope: Scope };
const rest = new Hono<{ Variables: RestVars }>();

export type Scope = 'read' | 'write' | 'admin';

async function resolveKey(authHeader: string | undefined): Promise<{ orgId: string; scope: Scope } | null> {
  if (!authHeader?.startsWith('Bearer sk_live_')) return null;
  const raw = authHeader.slice('Bearer '.length).trim();
  const hashed = createHash('sha256').update(raw).digest('hex');
  const [k] = await db.select().from(apiKey)
    .where(and(eq(apiKey.hashedKey, hashed), isNull(apiKey.revokedAt))).limit(1);
  if (!k) return null;
  if (k.expiresAt && k.expiresAt < new Date()) return null;
  db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, k.id)).catch(() => {});
  return { orgId: k.organizationId, scope: (k.scope ?? 'read') as Scope };
}

function err(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status, headers: { 'content-type': 'application/json' },
  });
}

// REST API rate limit defaults per scope. Override via env:
//   REST_LIMIT_READ_PER_MIN, REST_LIMIT_WRITE_PER_MIN, REST_LIMIT_ADMIN_PER_MIN
const LIMITS_PER_MIN = {
  read:  Number(process.env.REST_LIMIT_READ_PER_MIN  ?? 300),
  write: Number(process.env.REST_LIMIT_WRITE_PER_MIN ?? 120),
  admin: Number(process.env.REST_LIMIT_ADMIN_PER_MIN ?? 60),
} as const;

rest.use('*', async (c, next) => {
  const auth = await resolveKey(c.req.header('authorization'));
  if (!auth) return err('UNAUTHORIZED', 'Missing or invalid API key', 401);

  // Throttle by (apikey-hash, scope) — apikey identity already isolates per-tenant
  const keyHash = createHash('sha256').update(c.req.header('authorization') ?? '').digest('hex').slice(0, 16);
  const limit = LIMITS_PER_MIN[auth.scope] ?? LIMITS_PER_MIN.read;
  const r = rateLimit({ id: `rest:${keyHash}:${auth.scope}`, limit, windowMs: 60_000 });
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(r.remaining));
  if (!r.ok) {
    c.header('Retry-After', String(r.retryAfter));
    return err('RATE_LIMITED', `Rate limit exceeded. Retry in ${r.retryAfter}s.`, 429);
  }

  c.set('orgId', auth.orgId);
  c.set('scope', auth.scope);
  await next();
});

function requireScope(needed: Scope) {
  return async (c: any, next: () => Promise<void>) => {
    const s = c.get('scope') as Scope;
    const rank: Record<Scope, number> = { read: 0, write: 1, admin: 2 };
    if (rank[s] < rank[needed]) return err('FORBIDDEN', `Requires ${needed} scope`, 403);
    await next();
  };
}

// GET /api/v1/projects — list all projects in org
rest.get('/projects', async (c) => {
  const orgId = c.get('orgId');
  const rows = await db.select({
    id: project.id, code: project.code, name: project.name, status: project.status,
    client: project.client, location: project.location, startDate: project.startDate, finishDate: project.finishDate,
    createdAt: project.createdAt, updatedAt: project.updatedAt,
  }).from(project)
    .where(and(eq(project.organizationId, orgId), isNull(project.deletedAt)))
    .orderBy(desc(project.createdAt));
  return c.json({ data: rows, count: rows.length });
});

// GET /api/v1/projects/:id — detail with computed BOQ totals
rest.get('/projects/:id', async (c) => {
  const orgId = c.get('orgId');
  const id = c.req.param('id');
  const [proj] = await db.select().from(project)
    .where(and(eq(project.id, id), eq(project.organizationId, orgId))).limit(1);
  if (!proj) return err('NOT_FOUND', 'Project not found', 404);

  const items = await db.select({ boq: boqItem, ahsp: ahspItem })
    .from(boqItem).innerJoin(ahspItem, eq(boqItem.ahspItemId, ahspItem.id))
    .where(eq(boqItem.projectId, id));

  const ids = items.map(r => r.ahsp.id);
  const baseline = new Map<string, number>();
  if (ids.length) {
    const res = await db.select().from(ahspResource).where(inArray(ahspResource.ahspItemId, ids));
    for (const r of res) baseline.set(r.ahspItemId, (baseline.get(r.ahspItemId) ?? 0) + Number(r.koefisien) * Number(r.hsd));
  }

  const lineItems = items.map(r => ({
    quantity: Number(r.boq.quantity),
    unitRateOverride: r.boq.unitRateOverride !== null
      ? Number(r.boq.unitRateOverride)
      : (baseline.get(r.ahsp.id) ?? 0),
  }));
  const totals = projectTotal(lineItems, {
    markupPct: Number(proj.markupPct ?? 0),
    contingencyPct: Number(proj.contingencyPct ?? 0),
    ppnPct: Number(proj.ppnPct ?? 11),
  });

  return c.json({
    data: {
      ...proj,
      boqItemCount: items.length,
      totals: {
        subtotal: Math.round(totals.subtotal),
        markup: Math.round(totals.markup),
        contingency: Math.round(totals.contingency),
        prePpn: Math.round(totals.prePpn),
        ppn: Math.round(totals.ppn),
        grandTotal: Math.round(totals.grand),
      },
    },
  });
});

// GET /api/v1/projects/:id/entries — daily entries for project
rest.get('/projects/:id/entries', async (c) => {
  const orgId = c.get('orgId');
  const id = c.req.param('id');
  const [proj] = await db.select().from(project)
    .where(and(eq(project.id, id), eq(project.organizationId, orgId))).limit(1);
  if (!proj) return err('NOT_FOUND', 'Project not found', 404);

  const entries = await db.select().from(dailyEntry)
    .where(eq(dailyEntry.projectId, id)).orderBy(desc(dailyEntry.entryDate)).limit(100);
  return c.json({ data: entries, count: entries.length });
});

// GET /api/v1/entries/:id — entry detail with activities
rest.get('/entries/:id', async (c) => {
  const orgId = c.get('orgId');
  const id = c.req.param('id');
  const [entry] = await db.select({ e: dailyEntry, p: project }).from(dailyEntry)
    .innerJoin(project, eq(project.id, dailyEntry.projectId))
    .where(and(eq(dailyEntry.id, id), eq(project.organizationId, orgId))).limit(1);
  if (!entry) return err('NOT_FOUND', 'Entry not found', 404);
  const activities = await db.select().from(entryActivity).where(eq(entryActivity.dailyEntryId, id));
  return c.json({ data: { ...entry.e, project: { id: entry.p.id, code: entry.p.code }, activities } });
});

function csvEscape(s: any): string {
  if (s == null) return '';
  const str = String(s);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows: Array<Record<string, any>>, columns: string[]): string {
  const header = columns.join(',');
  const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(','));
  return [header, ...lines].join('\n');
}

// GET /api/v1/exports/projects.csv — all org projects as CSV
rest.get('/exports/projects.csv', async (c) => {
  const orgId = c.get('orgId');
  const rows = await db.select({
    id: project.id, code: project.code, name: project.name, status: project.status,
    client: project.client, location: project.location,
    startDate: project.startDate, finishDate: project.finishDate,
    markupPct: project.markupPct, contingencyPct: project.contingencyPct, ppnPct: project.ppnPct,
    createdAt: project.createdAt,
  }).from(project).where(and(eq(project.organizationId, orgId), isNull(project.deletedAt)));
  const csv = toCsv(rows, ['id', 'code', 'name', 'status', 'client', 'location', 'startDate', 'finishDate', 'markupPct', 'contingencyPct', 'ppnPct', 'createdAt']);
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sitelog-projects-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// GET /api/v1/exports/entries.csv?projectId=... — daily entries CSV
rest.get('/exports/entries.csv', async (c) => {
  const orgId = c.get('orgId');
  const projectId = c.req.query('projectId');
  if (projectId) {
    const [proj] = await db.select().from(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, orgId))).limit(1);
    if (!proj) return err('NOT_FOUND', 'Project not found in your org', 404);
  }
  const orgProjectIds = (await db.select({ id: project.id }).from(project)
    .where(eq(project.organizationId, orgId))).map(p => p.id);
  if (orgProjectIds.length === 0) {
    return new Response('id,projectId,entryDate,shift,weather,effectiveHours,workforce,notes,submittedAt\n',
      { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } });
  }
  const filter = projectId
    ? eq(dailyEntry.projectId, projectId)
    : inArray(dailyEntry.projectId, orgProjectIds);
  const rows = await db.select().from(dailyEntry).where(filter).limit(10_000);
  const csv = toCsv(rows as any, ['id', 'projectId', 'entryDate', 'shift', 'weather', 'effectiveHours', 'workforce', 'notes', 'submittedAt']);
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sitelog-entries-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// GET /api/v1/ahsp — catalog list
rest.get('/ahsp', async (c) => {
  const orgId = c.get('orgId');
  // AHSP items can be org-scoped or global (organizationId null)
  const rows = await db.select({
    id: ahspItem.id, kode: ahspItem.kode, section: ahspItem.section,
    jenis: ahspItem.jenis, satuan: ahspItem.satuan, ohpPct: ahspItem.ohpPct,
  }).from(ahspItem).limit(500);
  return c.json({ data: rows, count: rows.length, orgId });
});

// POST /api/v1/entries — submit a daily entry (idempotent via Idempotency-Key header)
rest.post('/entries', requireScope('write'), async (c) => {
  const orgId = c.get('orgId');
  const idempKey = c.req.header('idempotency-key');
  const rawBody = await c.req.text();

  if (idempKey) {
    const { lookupIdempotency } = await import('./lib/idempotency.js');
    const { cached, conflict } = await lookupIdempotency(orgId, idempKey, 'POST', '/api/v1/entries', rawBody);
    if (conflict) return err('IDEMPOTENCY_CONFLICT', 'Idempotency-Key already used with different request body', 409);
    if (cached) {
      c.header('X-Idempotent-Replay', '1');
      return new Response(cached.body, { status: cached.status, headers: { 'content-type': 'application/json' } });
    }
  }

  let parsed: any;
  try { parsed = JSON.parse(rawBody); } catch { return err('INVALID_JSON', 'Body must be valid JSON', 400); }
  if (!parsed.projectId || !parsed.entryDate) return err('VALIDATION', 'projectId + entryDate required', 400);

  // Verify project belongs to org
  const [proj] = await db.select().from(project).where(and(eq(project.id, parsed.projectId), eq(project.organizationId, orgId))).limit(1);
  if (!proj) return err('NOT_FOUND', 'Project not found in your org', 404);

  // Insert entry
  const [entry] = await db.insert(dailyEntry).values({
    projectId: parsed.projectId,
    entryDate: parsed.entryDate,
    shift: parsed.shift ?? 'day',
    weather: parsed.weather ?? null,
    effectiveHours: parsed.effectiveHours != null ? String(parsed.effectiveHours) : null,
    workforce: parsed.workforce ?? null,
    notes: parsed.notes ?? null,
  }).returning();

  const body = JSON.stringify({ data: entry });
  if (idempKey) {
    const { storeIdempotency } = await import('./lib/idempotency.js');
    await storeIdempotency(orgId, idempKey, 'POST', '/api/v1/entries', rawBody, 201, body).catch(() => {});
  }
  return new Response(body, { status: 201, headers: { 'content-type': 'application/json' } });
});

// GET /api/v1/me — verify auth
rest.get('/me', async (c) => {
  return c.json({
    data: {
      orgId: c.get('orgId' as any),
      scope: c.get('scope'),
      apiVersion: 'v1',
    },
  });
});

export { rest };
