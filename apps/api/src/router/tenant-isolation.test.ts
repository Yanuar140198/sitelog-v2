/**
 * Cross-tenant (IDOR) regression tests for the tenant-isolation fixes.
 *
 * Builds two orgs and drives the tRPC routers via createCaller with an org-A
 * session attempting to touch org-B rows — each must be rejected. Runs only when
 * DATABASE_URL is set (skipped in the no-DB `ci` lint/typecheck/unit job; exercised
 * locally and in the e2e CI job which has Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

const HAS_DB = !!process.env.DATABASE_URL;

// Lazily-loaded (only when DB present) to keep the no-DB job from importing the DB graph.
let db: any, schema: any, appRouter: any, createContext: any, eq: any;
const ids = {
  orgA: randomUUID(), userA: randomUUID(),
  orgB: randomUUID(), userB: randomUUID(),
  projectB: randomUUID(), itemB: randomUUID(), resourceB: randomUUID(),
  boqItemB: randomUUID(), unitB: randomUUID(),
};

function caller(orgId: string, userId: string) {
  const req = new Request('http://test.local');
  const session = {
    user: { id: userId, email: `${userId}@test.local`, name: 'T' } as any,
    organizationId: orgId,
    role: 'owner' as const,
    sessionId: randomUUID(),
  };
  return appRouter.createCaller(createContext({ req, session }));
}

describe.skipIf(!HAS_DB)('tenant isolation (IDOR)', () => {
  beforeAll(async () => {
    schema = await import('@sitelog/db');
    ({ db, eq } = { db: schema.db, eq: (await import('drizzle-orm')).eq });
    ({ appRouter } = await import('./index.js'));
    ({ createContext } = await import('../context.js'));

    const { organization, user, membership, project, ahspItem, ahspResource, boqItem, unit } = schema;
    const now = new Date();
    await db.insert(user).values([
      { id: ids.userA, email: `${ids.userA}@test.local`, name: 'A' },
      { id: ids.userB, email: `${ids.userB}@test.local`, name: 'B' },
    ]);
    await db.insert(organization).values([
      { id: ids.orgA, slug: `iso-a-${ids.orgA.slice(0, 8)}`, name: 'Iso A' },
      { id: ids.orgB, slug: `iso-b-${ids.orgB.slice(0, 8)}`, name: 'Iso B' },
    ]);
    await db.insert(membership).values([
      { userId: ids.userA, organizationId: ids.orgA, role: 'owner', acceptedAt: now },
      { userId: ids.userB, organizationId: ids.orgB, role: 'owner', acceptedAt: now },
    ]);
    await db.insert(project).values({ id: ids.projectB, organizationId: ids.orgB, code: 'ISO-B', name: 'Iso B Project' });
    await db.insert(ahspItem).values({ id: ids.itemB, organizationId: ids.orgB, kode: `ISO.B.${ids.itemB.slice(0, 6)}`, jenis: 'Iso B Item', satuan: 'm3' });
    await db.insert(ahspResource).values({ id: ids.resourceB, ahspItemId: ids.itemB, category: 'bahan', ordinal: 0, resourceCode: 'R1', uraian: 'x', koefisien: '1', hsd: '1000' });
    await db.insert(boqItem).values({ id: ids.boqItemB, projectId: ids.projectB, ahspItemId: ids.itemB, quantity: '1' });
    await db.insert(unit).values({ id: ids.unitB, organizationId: ids.orgB, nomor: 'ISO-B-UNIT' });
  });

  afterAll(async () => {
    if (!db) return;
    const { organization, user } = schema;
    // Cascades clean project/ahsp/boq/unit/membership via FKs.
    await db.delete(organization).where(eq(organization.id, ids.orgA));
    await db.delete(organization).where(eq(organization.id, ids.orgB));
    await db.delete(user).where(eq(user.id, ids.userA));
    await db.delete(user).where(eq(user.id, ids.userB));
  });

  it('org A cannot delete org B BOQ item', async () => {
    await expect(caller(ids.orgA, ids.userA).boq.remove({ id: ids.boqItemB })).rejects.toThrow();
  });

  it('org A cannot set a resource override on org B project', async () => {
    await expect(caller(ids.orgA, ids.userA).boq.setResourceOverride({
      projectId: ids.projectB, ahspItemId: ids.itemB, resourceCode: 'R1', koefisien: 2, hsd: 2,
    })).rejects.toThrow();
  });

  it('org A cannot assign fleet to org B project', async () => {
    await expect(caller(ids.orgA, ids.userA).fleet.assign({
      projectId: ids.projectB, unitId: ids.unitB, role: 'primary',
    })).rejects.toThrow();
  });

  it('org A cannot delete org B AHSP resource', async () => {
    await expect(caller(ids.orgA, ids.userA).ahsp.resourceDelete({ id: ids.resourceB })).rejects.toThrow();
  });

  it('org B owner CAN delete its own BOQ item (positive control)', async () => {
    await expect(caller(ids.orgB, ids.userB).boq.remove({ id: ids.boqItemB })).resolves.toBeTruthy();
  });
});
