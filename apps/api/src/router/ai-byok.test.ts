/**
 * BYO Anthropic key storage tests — set/status/clear + cross-org isolation.
 * No Claude call involved (only key management). Runs when DATABASE_URL is set.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

const HAS_DB = !!process.env.DATABASE_URL;

let db: any, schema: any, appRouter: any, createContext: any, eq: any;
const ids = {
  orgA: randomUUID(), userA: randomUUID(),
  orgB: randomUUID(), userB: randomUUID(),
};

function caller(orgId: string, userId: string, role: 'owner' | 'viewer' = 'owner') {
  const req = new Request('http://test.local');
  const session = { user: { id: userId, email: `${userId}@t.local`, name: 'T' } as any, organizationId: orgId, role, sessionId: randomUUID() };
  return appRouter.createCaller(createContext({ req, session }));
}

describe.skipIf(!HAS_DB)('AI BYO key storage', () => {
  beforeAll(async () => {
    process.env.SECRET_ENCRYPTION_KEY ??= 'test-secret-encryption-key-32-bytes-min';
    schema = await import('@sitelog/db');
    ({ db } = schema);
    eq = (await import('drizzle-orm')).eq;
    ({ appRouter } = await import('./index.js'));
    ({ createContext } = await import('../context.js'));

    const { organization, user, membership } = schema;
    const now = new Date();
    await db.insert(user).values([
      { id: ids.userA, email: `${ids.userA}@t.local`, name: 'A' },
      { id: ids.userB, email: `${ids.userB}@t.local`, name: 'B' },
    ]);
    await db.insert(organization).values([
      { id: ids.orgA, slug: `byok-a-${ids.orgA.slice(0, 8)}`, name: 'BYOK A' },
      { id: ids.orgB, slug: `byok-b-${ids.orgB.slice(0, 8)}`, name: 'BYOK B' },
    ]);
    await db.insert(membership).values([
      { userId: ids.userA, organizationId: ids.orgA, role: 'owner', acceptedAt: now },
      { userId: ids.userB, organizationId: ids.orgB, role: 'owner', acceptedAt: now },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    const { organization, user } = schema;
    await db.delete(organization).where(eq(organization.id, ids.orgA));
    await db.delete(organization).where(eq(organization.id, ids.orgB));
    await db.delete(user).where(eq(user.id, ids.userA));
    await db.delete(user).where(eq(user.id, ids.userB));
  });

  it('rejects a malformed key', async () => {
    await expect(caller(ids.orgA, ids.userA).ai.setApiKey({ key: 'not-a-real-key-000000' })).rejects.toThrow();
  });

  it('stores a valid key and reports configured with a hint', async () => {
    const res = await caller(ids.orgA, ids.userA).ai.setApiKey({ key: 'sk-ant-api03-DEMOKEY-abcd' });
    expect(res.configured).toBe(true);
    expect(res.hint).toBe('…abcd');
    const status = await caller(ids.orgA, ids.userA).ai.status();
    expect(status).toMatchObject({ configured: true, source: 'org', hint: '…abcd' });
  });

  it("org B does not see org A's key", async () => {
    const status = await caller(ids.orgB, ids.userB).ai.status();
    // No server fallback key in test env → org B is unconfigured.
    expect(status.source).not.toBe('org');
    expect(status.hint).toBeNull();
  });

  it('a non-admin cannot set the key', async () => {
    await expect(caller(ids.orgA, ids.userA, 'viewer').ai.setApiKey({ key: 'sk-ant-api03-X-zzzz' })).rejects.toThrow();
  });

  it('clears the key', async () => {
    const res = await caller(ids.orgA, ids.userA).ai.clearApiKey();
    expect(res.configured).toBe(false);
    const status = await caller(ids.orgA, ids.userA).ai.status();
    expect(status.configured).toBe(false);
  });
});
