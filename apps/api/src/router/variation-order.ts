/**
 * Variation Order (VO) / Change Request workflow.
 *
 * Lifecycle mutations:
 *   draft → submit → submitted → approve/reject (owner|admin gated)
 *   approved → markImplemented → implemented
 * Summary aggregates approved cost/days impact + pending counts for KPI cards.
 */
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { db, variationOrder, project } from '@sitelog/db';

const voTypeSchema = z.enum(['addition', 'deletion', 'substitution', 'time_extension', 'design_change']);
const voStatusSchema = z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented', 'invoiced']);
const refDocSchema = z.array(z.object({ label: z.string(), url: z.string().url() }));

/** Verify project belongs to caller's org. */
async function assertProjectInOrg(projectId: string, organizationId: string) {
  const [p] = await db.select({ id: project.id }).from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)))
    .limit(1);
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found in this org' });
}

/** Verify VO row exists and parent project belongs to caller's org. Returns row. */
async function assertVoInOrg(voId: string, organizationId: string) {
  const rows: any = await db.execute(sql`
    SELECT v.* FROM variation_order v
    JOIN project p ON p.id = v.project_id
    WHERE v.id = ${voId} AND p.organization_id = ${organizationId}
    LIMIT 1
  `);
  const row = ((rows.rows ?? rows) as any[])[0];
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Variation order not found' });
  return row;
}

export const variationOrderRouter = router({
  /** List VOs for a project; optional status filter. */
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      status: voStatusSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);
      const where = [eq(variationOrder.projectId, input.projectId)];
      if (input.status) where.push(eq(variationOrder.status, input.status));
      return db.select().from(variationOrder)
        .where(and(...where))
        .orderBy(desc(variationOrder.createdAt))
        .limit(500);
    }),

  /** Single VO detail (project→org ownership verified). */
  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return assertVoInOrg(input.id, ctx.session.organizationId);
    }),

  /** Create a new VO in draft status. created_by_id from session. */
  create: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      voNumber: z.string().min(1).max(40),
      title: z.string().min(1).max(200),
      voType: voTypeSchema,
      description: z.string().min(1),
      justification: z.string().nullable().optional(),
      costImpact: z.number().default(0),
      timeImpactDays: z.number().int().default(0),
      requestedBy: z.string().max(160).nullable().optional(),
      requestedDate: z.string().nullable().optional(),
      referenceDocuments: refDocSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);
      const [row] = await db.insert(variationOrder).values({
        projectId: input.projectId,
        voNumber: input.voNumber,
        title: input.title,
        voType: input.voType,
        description: input.description,
        justification: input.justification ?? null,
        costImpact: input.costImpact.toString(),
        timeImpactDays: input.timeImpactDays,
        requestedBy: input.requestedBy ?? null,
        requestedDate: input.requestedDate ?? null,
        referenceDocuments: input.referenceDocuments ?? [],
        createdById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  /** Partial update. project_id, vo_number, status are immutable here. */
  update: orgProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      voType: voTypeSchema.optional(),
      description: z.string().min(1).optional(),
      justification: z.string().nullable().optional(),
      costImpact: z.number().optional(),
      timeImpactDays: z.number().int().optional(),
      requestedBy: z.string().max(160).nullable().optional(),
      requestedDate: z.string().nullable().optional(),
      referenceDocuments: refDocSchema.optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertVoInOrg(input.id, ctx.session.organizationId);
      const { id, costImpact, ...rest } = input;
      const updates: any = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) updates[k] = v;
      }
      if (costImpact !== undefined) updates.costImpact = costImpact.toString();
      const [row] = await db.update(variationOrder).set(updates)
        .where(eq(variationOrder.id, id))
        .returning();
      return row;
    }),

  /** Submit a draft VO for review. */
  submit: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertVoInOrg(input.id, ctx.session.organizationId);
      const [row] = await db.update(variationOrder).set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(variationOrder.id, input.id)).returning();
      return row;
    }),

  /** Approve a VO — owner|admin only. */
  approve: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertVoInOrg(input.id, ctx.session.organizationId);
      const updates: any = {
        status: 'approved',
        approvedAt: new Date(),
        approvedById: ctx.session.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      };
      if (input.notes) updates.notes = input.notes;
      const [row] = await db.update(variationOrder).set(updates)
        .where(eq(variationOrder.id, input.id)).returning();
      return row;
    }),

  /** Reject a VO — owner|admin only. Requires rejection_reason. */
  reject: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid(), rejectionReason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertVoInOrg(input.id, ctx.session.organizationId);
      const [row] = await db.update(variationOrder).set({
        status: 'rejected',
        rejectionReason: input.rejectionReason,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(variationOrder.id, input.id)).returning();
      return row;
    }),

  /** Mark an approved VO as implemented on site. */
  markImplemented: orgProcedure
    .input(z.object({ id: z.string().uuid(), implementedAt: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertVoInOrg(input.id, ctx.session.organizationId);
      const [row] = await db.update(variationOrder).set({
        status: 'implemented',
        implementedAt: input.implementedAt,
        updatedAt: new Date(),
      }).where(eq(variationOrder.id, input.id)).returning();
      return row;
    }),

  /** KPI summary: approved $/days totals, pending count, status breakdown. */
  summary: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);

      const totals: any = await db.execute(sql`
        SELECT
          COALESCE(SUM(cost_impact) FILTER (WHERE status IN ('approved','implemented','invoiced')), 0)::numeric AS approved_cost,
          COALESCE(SUM(time_impact_days) FILTER (WHERE status IN ('approved','implemented','invoiced')), 0)::int AS approved_days,
          COUNT(*) FILTER (WHERE status IN ('draft','submitted','under_review'))::int AS pending_count
        FROM variation_order
        WHERE project_id = ${input.projectId}
      `);
      const statusRows: any = await db.execute(sql`
        SELECT status, COUNT(*)::int AS n FROM variation_order
        WHERE project_id = ${input.projectId}
        GROUP BY status
      `);
      const totalRow = ((totals.rows ?? totals) as any[])[0] ?? {};
      const countByStatus: Record<string, number> = {};
      for (const r of (statusRows.rows ?? statusRows) as any[]) countByStatus[r.status] = Number(r.n);

      return {
        totalApprovedCost: Number(totalRow.approved_cost ?? 0),
        totalApprovedDays: Number(totalRow.approved_days ?? 0),
        totalPending: Number(totalRow.pending_count ?? 0),
        countByStatus,
      };
    }),
});

export type VariationOrderRouter = typeof variationOrderRouter;
