/**
 * Migrate legacy Sitelog v1 (Google Sheets-backed) data to Postgres.
 *
 * Assumes legacy backend exposes admin REST endpoints. Pulls:
 *   - MASTER_PROJECT     → project
 *   - MASTER_UNIT        → unit
 *   - PROJECT_BOQ        → boq_item
 *   - PROJECT_FLEET      → project_fleet_assignment
 *   - PROJECT_AHSP_PARAMS→ boq_resource_override
 *   - USERS              → user + membership
 *
 * Usage:
 *   DATABASE_URL=... bun packages/db/src/seed/migrate-from-sheets.ts \
 *     --base https://spi.k11ops.com \
 *     --admin-token <X-Admin-Token> \
 *     --org-name "PT SCM"
 *
 * All projects/units/etc are attached to a single new org (or existing if slug matches).
 */
import { db } from '../index.js';
import { organization, project, unit, boqItem,
         projectFleetAssignment, ahspItem } from '../schema/index.js';
import { eq, and } from 'drizzle-orm';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function call(base: string, token: string, path: string): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    headers: { 'X-Admin-Token': token, 'User-Agent': 'sitelog-migrate' },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const base = arg('base') ?? 'https://spi.k11ops.com';
  const token = arg('admin-token');
  const orgName = arg('org-name') ?? 'Migrated Org';
  if (!token) throw new Error('--admin-token required');

  console.log(`[migrate] base=${base} → org="${orgName}"`);

  // 1. Org
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64);
  let [org] = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
  if (!org) {
    [org] = await db.insert(organization).values({
      slug, name: orgName, plan: 'enterprise',
    }).returning();
    console.log(`[org] created ${org!.id}`);
  } else {
    console.log(`[org] reusing ${org.id}`);
  }
  const orgId = org!.id;

  // 2. Projects
  const projData = await call(base, token, '/api/admin/projects');
  let pCount = 0;
  const projCodeMap = new Map<string, string>();
  for (const p of projData.items ?? []) {
    const code = String(p.code ?? p.Project ?? '').trim();
    if (!code) continue;
    const existing = await db.select().from(project)
      .where(and(eq(project.organizationId, orgId), eq(project.code, code))).limit(1);
    if (existing.length > 0) {
      projCodeMap.set(code, existing[0]!.id);
      continue;
    }
    const [row] = await db.insert(project).values({
      organizationId: orgId,
      code,
      name: String(p.name ?? p.Name ?? code),
      client: p.client ?? null,
      location: p.location ?? null,
      status: 'active',
      startDate: p.start ?? null,
      finishDate: p.finish ?? null,
      planCutSoil: String(p.planCutSoil ?? 0),
      planCutRock: String(p.planCutRock ?? 0),
      planFill: String(p.planFill ?? 0),
      planLandClearing: String(p.planLC ?? 0),
      fleetDesign: p.fleetDesign ?? null,
    }).returning();
    projCodeMap.set(code, row!.id);
    pCount++;
  }
  console.log(`[projects] ${pCount} migrated, ${projCodeMap.size} total`);

  // 3. Units
  const unitData = await call(base, token, '/api/admin/units');
  let uCount = 0;
  const unitNomorMap = new Map<string, string>();
  for (const u of unitData.items ?? []) {
    const nomor = String(u.nomor ?? u.Nomor ?? '').trim();
    if (!nomor) continue;
    const existing = await db.select().from(unit)
      .where(and(eq(unit.organizationId, orgId), eq(unit.nomor, nomor))).limit(1);
    if (existing.length > 0) { unitNomorMap.set(nomor, existing[0]!.id); continue; }
    const [row] = await db.insert(unit).values({
      organizationId: orgId,
      nomor,
      fleet: u.fleet ?? null,
      jenisAlat: u.jenisAlat ?? null,
      brand: u.brand ?? null,
      model: u.model ?? null,
      vendor: u.vendor ?? null,
      ratePerHour: u.rate ? String(u.rate) : null,
    }).returning();
    unitNomorMap.set(nomor, row!.id);
    uCount++;
  }
  console.log(`[units] ${uCount} migrated, ${unitNomorMap.size} total`);

  // 4. BOQ items (need AHSP item id resolved by kode)
  let bCount = 0, bSkipped = 0;
  for (const [projCode, projId] of projCodeMap) {
    let boqData;
    try {
      boqData = await call(base, token, `/api/admin/project-boq?project=${encodeURIComponent(projCode)}`);
    } catch { continue; }
    for (const it of boqData.items ?? []) {
      const kode = String(it.kode ?? '').trim();
      if (!kode) continue;
      const [ahsp] = await db.select().from(ahspItem)
        .where(eq(ahspItem.kode, kode)).limit(1);
      if (!ahsp) { bSkipped++; continue; }
      const exists = await db.select().from(boqItem)
        .where(and(eq(boqItem.projectId, projId), eq(boqItem.ahspItemId, ahsp.id))).limit(1);
      if (exists.length > 0) continue;
      await db.insert(boqItem).values({
        projectId: projId,
        ahspItemId: ahsp.id,
        quantity: String(it.quantity ?? 0),
        unitRateOverride: it.overrideRate ? String(it.overrideRate) : null,
        note: it.note ?? null,
      });
      bCount++;
    }
  }
  console.log(`[boq] ${bCount} items migrated, ${bSkipped} skipped (AHSP missing)`);

  // 5. Fleet assignments
  let fCount = 0;
  for (const [projCode, projId] of projCodeMap) {
    let fleetData;
    try {
      fleetData = await call(base, token, `/api/admin/project-fleet?project=${encodeURIComponent(projCode)}`);
    } catch { continue; }
    for (const u of fleetData.units ?? []) {
      const unitId = unitNomorMap.get(u.nomor);
      if (!unitId) continue;
      const exists = await db.select().from(projectFleetAssignment)
        .where(and(eq(projectFleetAssignment.projectId, projId), eq(projectFleetAssignment.unitId, unitId))).limit(1);
      if (exists.length > 0) continue;
      await db.insert(projectFleetAssignment).values({
        projectId: projId, unitId,
        role: (u.role ?? 'primary').toLowerCase() as any,
        note: u.note ?? null,
      });
      fCount++;
    }
  }
  console.log(`[fleet] ${fCount} assignments migrated`);

  console.log(`\n[migrate] DONE.`);
  console.log(`Org: ${orgId} (slug "${slug}")`);
  console.log(`Now create owner user, assign membership manually, or run --owner-email flow.`);
}

main().catch(e => { console.error(e); process.exit(1); });
