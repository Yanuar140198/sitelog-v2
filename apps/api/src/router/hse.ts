/**
 * HSE (Health, Safety, Environment) incident log.
 *
 * Per-project operational compliance tracking:
 *   - list/get/create/update for org members
 *   - close gated to owner/admin (closure triggers root-cause + corrective action)
 *   - summary returns severity/status breakdowns + DAYS-SINCE-LAST-INCIDENT counter
 */
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { db, hseIncident, project } from '@sitelog/db';

const severitySchema = z.enum([
  'near_miss',
  'first_aid',
  'medical',
  'lost_time',
  'fatality',
  'property_damage',
  'environmental',
]);
const statusSchema = z.enum(['open', 'investigating', 'corrective_action', 'closed']);

/** Verify the project belongs to caller's org, else throw NOT_FOUND. */
async function assertProjectInOrg(projectId: string, organizationId: string) {
  const [p] = await db.select({ id: project.id }).from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)))
    .limit(1);
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found in this org' });
}

export const hseRouter = router({
  /** List incidents for a project. Filters: severity, status, date range. */
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      severity: severitySchema.optional(),
      status: statusSchema.optional(),
      from: z.string().optional(),  // YYYY-MM-DD
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);
      const where = [eq(hseIncident.projectId, input.projectId)];
      if (input.severity) where.push(eq(hseIncident.severity, input.severity));
      if (input.status) where.push(eq(hseIncident.status, input.status));
      if (input.from) where.push(gte(hseIncident.incidentDate, input.from));
      if (input.to) where.push(lte(hseIncident.incidentDate, input.to));
      return db.select().from(hseIncident)
        .where(and(...where))
        .orderBy(desc(hseIncident.incidentDate), desc(hseIncident.createdAt))
        .limit(500);
    }),

  /** Single incident detail (verified via project→org join). */
  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows: any = await db.execute(sql`
        SELECT h.* FROM hse_incident h
        JOIN project p ON p.id = h.project_id
        WHERE h.id = ${input.id} AND p.organization_id = ${ctx.session.organizationId}
        LIMIT 1
      `);
      const row = ((rows.rows ?? rows) as any[])[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  /** Create new incident (defaults status=open, reported_by=session.user). */
  create: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      incidentDate: z.string(),
      incidentTime: z.string().nullable().optional(),
      severity: severitySchema,
      incidentType: z.string().min(1).max(80),
      location: z.string().min(1),
      description: z.string().min(1),
      involvedPersons: z.string().nullable().optional(),
      immediateAction: z.string().nullable().optional(),
      photoKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);
      const [row] = await db.insert(hseIncident).values({
        projectId: input.projectId,
        incidentDate: input.incidentDate,
        incidentTime: input.incidentTime ?? null,
        severity: input.severity,
        incidentType: input.incidentType,
        location: input.location,
        description: input.description,
        involvedPersons: input.involvedPersons ?? null,
        immediateAction: input.immediateAction ?? null,
        photoKeys: input.photoKeys ?? [],
        reportedById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  /** Partial update. project_id immutable; close uses dedicated mutation. */
  update: orgProcedure
    .input(z.object({
      id: z.string().uuid(),
      incidentDate: z.string().optional(),
      incidentTime: z.string().nullable().optional(),
      severity: severitySchema.optional(),
      incidentType: z.string().min(1).max(80).optional(),
      location: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      involvedPersons: z.string().nullable().optional(),
      immediateAction: z.string().nullable().optional(),
      rootCause: z.string().nullable().optional(),
      correctiveAction: z.string().nullable().optional(),
      status: statusSchema.optional(),
      photoKeys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via join
      const rows: any = await db.execute(sql`
        SELECT h.id FROM hse_incident h
        JOIN project p ON p.id = h.project_id
        WHERE h.id = ${input.id} AND p.organization_id = ${ctx.session.organizationId}
        LIMIT 1
      `);
      if (!((rows.rows ?? rows) as any[])[0]) throw new TRPCError({ code: 'NOT_FOUND' });

      const { id, ...rest } = input;
      const updates: any = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) updates[k] = v;
      }
      const [row] = await db.update(hseIncident).set(updates)
        .where(eq(hseIncident.id, id))
        .returning();
      return row;
    }),

  /** Close incident — gated to owner/admin. Requires root cause + corrective action. */
  close: requireRole('owner', 'admin')
    .input(z.object({
      id: z.string().uuid(),
      rootCause: z.string().min(1),
      correctiveAction: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows: any = await db.execute(sql`
        SELECT h.id FROM hse_incident h
        JOIN project p ON p.id = h.project_id
        WHERE h.id = ${input.id} AND p.organization_id = ${ctx.session.organizationId}
        LIMIT 1
      `);
      if (!((rows.rows ?? rows) as any[])[0]) throw new TRPCError({ code: 'NOT_FOUND' });

      const [row] = await db.update(hseIncident).set({
        status: 'closed',
        rootCause: input.rootCause,
        correctiveAction: input.correctiveAction,
        closedAt: new Date(),
        closedById: ctx.session.user.id,
        updatedAt: new Date(),
      }).where(eq(hseIncident.id, input.id)).returning();
      return row;
    }),

  /** KPI summary: counts by severity + status, days since last incident. */
  summary: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(input.projectId, ctx.session.organizationId);

      const sevRows: any = await db.execute(sql`
        SELECT severity, COUNT(*)::int AS n FROM hse_incident
        WHERE project_id = ${input.projectId}
        GROUP BY severity
      `);
      const statRows: any = await db.execute(sql`
        SELECT status, COUNT(*)::int AS n FROM hse_incident
        WHERE project_id = ${input.projectId}
        GROUP BY status
      `);
      const lastRows: any = await db.execute(sql`
        SELECT MAX(incident_date)::date AS last_date,
               COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM incident_date) = EXTRACT(YEAR FROM CURRENT_DATE))::int AS this_year
        FROM hse_incident
        WHERE project_id = ${input.projectId}
      `);

      const bySeverity: Record<string, number> = {};
      for (const r of (sevRows.rows ?? sevRows) as any[]) bySeverity[r.severity] = Number(r.n);
      const byStatus: Record<string, number> = {};
      for (const r of (statRows.rows ?? statRows) as any[]) byStatus[r.status] = Number(r.n);
      const meta = ((lastRows.rows ?? lastRows) as any[])[0] ?? {};
      const lastDate: string | null = meta.last_date ? new Date(meta.last_date).toISOString().slice(0, 10) : null;
      const daysSinceLastIncident = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400_000)
        : null;

      return {
        bySeverity,
        byStatus,
        daysSinceLastIncident,
        lastIncidentDate: lastDate,
        thisYearCount: Number(meta.this_year ?? 0),
        openCount: (byStatus.open ?? 0) + (byStatus.investigating ?? 0) + (byStatus.corrective_action ?? 0),
      };
    }),
});

export type HseRouter = typeof hseRouter;
