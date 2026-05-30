/**
 * Error-log: report (any org member) + super-admin recent/clear. DB-backed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

const HAS_DB = !!process.env.DATABASE_URL;
let db: any, schema: any, appRouter: any, createContext: any, eq: any;
const ids = { org: randomUUID(), user: randomUUID() };
const ADMIN_EMAIL = `erradmin-${ids.user.slice(0, 8)}@test.local`;

function caller(role: 'owner' | 'viewer' = 'owner') {
  const req = new Request('http://test.local');
  const session = { user: { id: ids.user, email: ADMIN_EMAIL, name: 'T' } as any, organizationId: ids.org, role, sessionId: randomUUID() };
  return appRouter.createCaller(createContext({ req, session }));
}

describe.skipIf(!HAS_DB)('error-log', () => {
  beforeAll(async () => {
    process.env.SITELOG_ADMIN_EMAILS = ADMIN_EMAIL; // make our test user a super-admin
    schema = await import('@sitelog/db');
    ({ db } = schema);
    eq = (await import('drizzle-orm')).eq;
    ({ appRouter } = await import('./index.js'));
    ({ createContext } = await import('../context.js'));
    const { organization, user, membership } = schema;
    await db.insert(user).values({ id: ids.user, email: ADMIN_EMAIL, name: 'T' });
    await db.insert(organization).values({ id: ids.org, slug: `err-${ids.org.slice(0, 8)}`, name: 'Err' });
    await db.insert(membership).values({ userId: ids.user, organizationId: ids.org, role: 'owner', acceptedAt: new Date() });
  });

  afterAll(async () => {
    if (!db) return;
    const { organization, user, errorLog } = schema;
    await db.delete(errorLog).where(eq(errorLog.organizationId, ids.org));
    await db.delete(organization).where(eq(organization.id, ids.org));
    await db.delete(user).where(eq(user.id, ids.user));
  });

  it('report() persists a client error', async () => {
    const res = await caller().errorLog.report({ message: 'boom in test', stack: 'at x', url: '/app/test', level: 'error' });
    expect(res.ok).toBe(true);
  });

  it('recent() returns the logged error for a super-admin', async () => {
    const rows = await caller().errorLog.recent({ limit: 50 });
    const mine = rows.find((r: any) => r.message === 'boom in test' && r.organizationId === ids.org);
    expect(mine).toBeTruthy();
    expect(mine.source).toBe('client');
  });

  it('recent() rejects a non-super-admin', async () => {
    process.env.SITELOG_ADMIN_EMAILS = 'someone-else@test.local';
    await expect(caller().errorLog.recent({ limit: 10 })).rejects.toThrow();
    process.env.SITELOG_ADMIN_EMAILS = ADMIN_EMAIL;
  });
});
