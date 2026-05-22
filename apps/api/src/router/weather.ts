/**
 * Daily weather log + rain-delay tracking.
 *
 * Construction contracts (FIDIC, AV1941, RKS) allow time-extension claims
 * when adverse weather halts works. This router lets PMs log conditions
 * morning/afternoon/evening, rainfall, and disrupted hours per day so the
 * org has audit-grade evidence when filing variation orders.
 *
 * Procedures:
 *   - list:       day rows for a project (date range optional)
 *   - upsert:     create/replace today's (or any date's) row by (project, date)
 *   - delete:     remove a row (org members)
 *   - approveRainDelay: gated owner|admin — flips approval bit
 *   - summary:    KPIs over a window (rainy days, total mm, disrupted hrs, claims)
 */
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { weatherLog, project, WEATHER_CONDITIONS } from '@sitelog/db';

const conditionSchema = z.enum(WEATHER_CONDITIONS);

/** Verify project belongs to caller's org. */
async function assertProjectInOrg(ctx: any, projectId: string) {
  const [row] = await ctx.db.select({ id: project.id }).from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, ctx.session.organizationId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
}

/** Verify a weather_log row belongs to caller's org (via project join). */
async function assertLogInOrg(ctx: any, id: string) {
  const rows: any = await ctx.db.execute(sql`
    SELECT w.id, w.project_id FROM weather_log w
    JOIN project p ON p.id = w.project_id
    WHERE w.id = ${id} AND p.organization_id = ${ctx.session.organizationId}
    LIMIT 1
  `);
  const row = ((rows.rows ?? rows) as any[])[0];
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Weather log not found' });
  return row;
}

export const weatherRouter = router({
  /** Day-by-day weather rows, newest first. Optional inclusive date window. */
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      from: z.string().optional(), // YYYY-MM-DD
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const where = [eq(weatherLog.projectId, input.projectId)];
      if (input.from) where.push(gte(weatherLog.logDate, input.from));
      if (input.to) where.push(lte(weatherLog.logDate, input.to));
      return ctx.db.select().from(weatherLog)
        .where(and(...where))
        .orderBy(desc(weatherLog.logDate))
        .limit(500);
    }),

  /** Insert/replace row keyed on (project_id, log_date). recorded_by from session. */
  upsert: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      logDate: z.string().min(1), // YYYY-MM-DD
      morning: conditionSchema.nullable().optional(),
      afternoon: conditionSchema.nullable().optional(),
      evening: conditionSchema.nullable().optional(),
      rainfallMm: z.number().nonnegative().nullable().optional(),
      tempMinC: z.number().nullable().optional(),
      tempMaxC: z.number().nullable().optional(),
      windKmh: z.number().nonnegative().nullable().optional(),
      workDisruptedHours: z.number().nonnegative().default(0),
      rainDelayClaimed: z.boolean().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);

      const toNumStr = (v: number | null | undefined) =>
        v === undefined || v === null ? null : v.toString();

      const [row] = await ctx.db.insert(weatherLog).values({
        projectId: input.projectId,
        logDate: input.logDate,
        morning: input.morning ?? null,
        afternoon: input.afternoon ?? null,
        evening: input.evening ?? null,
        rainfallMm: toNumStr(input.rainfallMm),
        tempMinC: toNumStr(input.tempMinC),
        tempMaxC: toNumStr(input.tempMaxC),
        windKmh: toNumStr(input.windKmh),
        workDisruptedHours: input.workDisruptedHours.toString(),
        rainDelayClaimed: input.rainDelayClaimed ?? false,
        notes: input.notes ?? null,
        recordedById: ctx.session.user.id,
      }).onConflictDoUpdate({
        target: [weatherLog.projectId, weatherLog.logDate],
        set: {
          morning: input.morning ?? null,
          afternoon: input.afternoon ?? null,
          evening: input.evening ?? null,
          rainfallMm: toNumStr(input.rainfallMm),
          tempMinC: toNumStr(input.tempMinC),
          tempMaxC: toNumStr(input.tempMaxC),
          windKmh: toNumStr(input.windKmh),
          workDisruptedHours: input.workDisruptedHours.toString(),
          rainDelayClaimed: input.rainDelayClaimed ?? false,
          notes: input.notes ?? null,
          recordedById: ctx.session.user.id,
          updatedAt: new Date(),
        },
      }).returning();
      return row;
    }),

  /** Remove a single day's row. */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertLogInOrg(ctx, input.id);
      await ctx.db.delete(weatherLog).where(eq(weatherLog.id, input.id));
      return { ok: true };
    }),

  /** Flip rain_delay_approved = true. Owner/admin only — this affects claim value. */
  approveRainDelay: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertLogInOrg(ctx, input.id);
      const [row] = await ctx.db.update(weatherLog).set({
        rainDelayApproved: true,
        updatedAt: new Date(),
      }).where(eq(weatherLog.id, input.id)).returning();
      return row;
    }),

  /** KPI window. Defaults to whole table if from/to not supplied. */
  summary: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);

      const dateClause = input.from && input.to
        ? sql`AND log_date BETWEEN ${input.from} AND ${input.to}`
        : input.from
          ? sql`AND log_date >= ${input.from}`
          : input.to
            ? sql`AND log_date <= ${input.to}`
            : sql``;

      // "rainy" = any of the 3 slots has a hujan_* / gerimis / badai value
      const rows: any = await ctx.db.execute(sql`
        SELECT
          COUNT(*)::int AS total_days,
          COUNT(*) FILTER (
            WHERE morning   IN ('gerimis','hujan_ringan','hujan_sedang','hujan_lebat','badai')
               OR afternoon IN ('gerimis','hujan_ringan','hujan_sedang','hujan_lebat','badai')
               OR evening   IN ('gerimis','hujan_ringan','hujan_sedang','hujan_lebat','badai')
          )::int AS rainy_days,
          COALESCE(SUM(rainfall_mm), 0)::float AS total_rainfall_mm,
          COALESCE(SUM(work_disrupted_hours), 0)::float AS total_disrupted_hours,
          COUNT(*) FILTER (WHERE rain_delay_claimed)::int  AS total_delay_claimed_days,
          COUNT(*) FILTER (WHERE rain_delay_approved)::int AS total_delay_approved_days
        FROM weather_log
        WHERE project_id = ${input.projectId}
        ${dateClause}
      `);
      const r = ((rows.rows ?? rows) as any[])[0] ?? {};
      return {
        totalDays: Number(r.total_days ?? 0),
        rainyDays: Number(r.rainy_days ?? 0),
        totalRainfallMm: Number(r.total_rainfall_mm ?? 0),
        totalDisruptedHours: Number(r.total_disrupted_hours ?? 0),
        totalDelayClaimedDays: Number(r.total_delay_claimed_days ?? 0),
        totalDelayApprovedDays: Number(r.total_delay_approved_days ?? 0),
      };
    }),
});

export type WeatherRouter = typeof weatherRouter;
