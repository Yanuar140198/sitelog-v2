/**
 * Quality Control test results — per-project material/work testing register.
 *
 * Inspectors record each lab/field test (sand cone, slump, concrete cube,
 * CBR, asphalt extraction, gradation) with spec target + actual value + verdict.
 *
 * Procedures:
 *   - list/get/create/update for org members (project ownership verified)
 *   - delete restricted to owner/admin (irreversible — QA audit-sensitive)
 *   - summary returns result counts, by-type breakdown, and pass-rate %
 *   - requestRetest flips the original row to retest_required and returns it
 *     so the frontend can seed a new create form with retest_of_id pre-filled
 */
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { qcTest, project } from '@sitelog/db';

const resultSchema = z.enum(['pass', 'fail', 'pending', 'retest_required']);

/** Verify the project belongs to caller's org, else throw NOT_FOUND. */
async function assertProjectInOrg(ctx: any, projectId: string) {
  const [row] = await ctx.db.select({ id: project.id }).from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, ctx.session.organizationId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found in this org' });
}

/** Verify a qc_test row belongs to a project in caller's org. Returns the row. */
async function assertQcInOrg(ctx: any, id: string) {
  const rows: any = await ctx.db.execute(sql`
    SELECT q.* FROM qc_test q
    JOIN project p ON p.id = q.project_id
    WHERE q.id = ${id} AND p.organization_id = ${ctx.session.organizationId}
    LIMIT 1
  `);
  const row = ((rows.rows ?? rows) as any[])[0];
  if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
  return row;
}

export const qcRouter = router({
  /** List tests for a project. Filters: test_type, result, date range. */
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      testType: z.string().optional(),
      result: resultSchema.optional(),
      from: z.string().optional(),  // YYYY-MM-DD
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const where = [eq(qcTest.projectId, input.projectId)];
      if (input.testType) where.push(eq(qcTest.testType, input.testType));
      if (input.result) where.push(eq(qcTest.result, input.result));
      if (input.from) where.push(gte(qcTest.testDate, input.from));
      if (input.to) where.push(lte(qcTest.testDate, input.to));
      return ctx.db.select().from(qcTest)
        .where(and(...where))
        .orderBy(desc(qcTest.testDate), desc(qcTest.createdAt))
        .limit(500);
    }),

  /** Single test detail (verified via project→org join). */
  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return assertQcInOrg(ctx, input.id);
    }),

  /** Create new test row. Auto-fills inspector_id from session. */
  create: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      testDate: z.string(),
      testType: z.string().min(1).max(80),
      station: z.string().max(64).nullable().optional(),
      locationDescription: z.string().nullable().optional(),
      sampleCode: z.string().max(80).nullable().optional(),
      specTarget: z.string().nullable().optional(),
      specMin: z.number().nullable().optional(),
      specMax: z.number().nullable().optional(),
      actualValue: z.number().nullable().optional(),
      actualText: z.string().nullable().optional(),
      unit: z.string().max(16).nullable().optional(),
      result: resultSchema.default('pending'),
      notes: z.string().nullable().optional(),
      testedBy: z.string().max(120).nullable().optional(),
      retestOfId: z.string().uuid().nullable().optional(),
      photoKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      // If retestOfId provided, verify it belongs to same project + org
      if (input.retestOfId) {
        const orig = await assertQcInOrg(ctx, input.retestOfId);
        if (orig.project_id !== input.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Retest must be on same project as original' });
        }
      }
      const [row] = await ctx.db.insert(qcTest).values({
        projectId: input.projectId,
        testDate: input.testDate,
        testType: input.testType,
        station: input.station ?? null,
        locationDescription: input.locationDescription ?? null,
        sampleCode: input.sampleCode ?? null,
        specTarget: input.specTarget ?? null,
        specMin: input.specMin != null ? input.specMin.toString() : null,
        specMax: input.specMax != null ? input.specMax.toString() : null,
        actualValue: input.actualValue != null ? input.actualValue.toString() : null,
        actualText: input.actualText ?? null,
        unit: input.unit ?? null,
        result: input.result,
        notes: input.notes ?? null,
        testedBy: input.testedBy ?? null,
        inspectorId: ctx.session.user.id,
        retestOfId: input.retestOfId ?? null,
        photoKeys: input.photoKeys ?? [],
      }).returning();
      return row;
    }),

  /** Partial update. project_id immutable. */
  update: orgProcedure
    .input(z.object({
      id: z.string().uuid(),
      testDate: z.string().optional(),
      testType: z.string().min(1).max(80).optional(),
      station: z.string().max(64).nullable().optional(),
      locationDescription: z.string().nullable().optional(),
      sampleCode: z.string().max(80).nullable().optional(),
      specTarget: z.string().nullable().optional(),
      specMin: z.number().nullable().optional(),
      specMax: z.number().nullable().optional(),
      actualValue: z.number().nullable().optional(),
      actualText: z.string().nullable().optional(),
      unit: z.string().max(16).nullable().optional(),
      result: resultSchema.optional(),
      notes: z.string().nullable().optional(),
      testedBy: z.string().max(120).nullable().optional(),
      photoKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertQcInOrg(ctx, input.id);
      const { id, ...rest } = input;
      const updates: any = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined) continue;
        // Coerce numeric inputs to string for drizzle numeric columns
        if (['specMin', 'specMax', 'actualValue'].includes(k)) {
          updates[k] = v == null ? null : (v as number).toString();
        } else {
          updates[k] = v;
        }
      }
      const [row] = await ctx.db.update(qcTest).set(updates)
        .where(eq(qcTest.id, id))
        .returning();
      return row;
    }),

  /** Delete (owner/admin only — destructive on QA records). */
  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertQcInOrg(ctx, input.id);
      await ctx.db.delete(qcTest).where(eq(qcTest.id, input.id));
      return { ok: true };
    }),

  /** KPI summary: counts by result + by test type + pass rate %. */
  summary: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);

      const resRows: any = await ctx.db.execute(sql`
        SELECT result, COUNT(*)::int AS n FROM qc_test
        WHERE project_id = ${input.projectId}
        GROUP BY result
      `);
      const typeRows: any = await ctx.db.execute(sql`
        SELECT test_type, COUNT(*)::int AS n FROM qc_test
        WHERE project_id = ${input.projectId}
        GROUP BY test_type
        ORDER BY n DESC
      `);

      const byResult: Record<string, number> = { pass: 0, fail: 0, pending: 0, retest_required: 0 };
      for (const r of (resRows.rows ?? resRows) as any[]) byResult[r.result] = Number(r.n);

      const byType: Record<string, number> = {};
      for (const r of (typeRows.rows ?? typeRows) as any[]) byType[r.test_type] = Number(r.n);

      const passN = byResult.pass ?? 0;
      const failN = byResult.fail ?? 0;
      const pendN = byResult.pending ?? 0;
      const retestN = byResult.retest_required ?? 0;
      const total = passN + failN + pendN + retestN;
      const decided = passN + failN;
      const passRate = decided > 0 ? Math.round((passN / decided) * 1000) / 10 : null;

      return {
        total,
        byResult,
        byType,
        passRate,  // % with one decimal, or null when no decided tests yet
        pendingCount: pendN,
        retestCount: retestN,
      };
    }),

  /** Mark an original test as retest_required and return it (so frontend can
   *  pre-fill a new create form with retest_of_id = id). */
  requestRetest: orgProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orig = await assertQcInOrg(ctx, input.id);
      const updates: any = {
        result: 'retest_required',
        updatedAt: new Date(),
      };
      if (input.notes) {
        const existing = orig.notes ?? '';
        updates.notes = existing ? `${existing}\n[RETEST] ${input.notes}` : `[RETEST] ${input.notes}`;
      }
      const [row] = await ctx.db.update(qcTest).set(updates)
        .where(eq(qcTest.id, input.id))
        .returning();
      return row;
    }),
});

export type QcRouter = typeof qcRouter;
