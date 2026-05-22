/**
 * Schedule + S-curve + baseline rebase. Primavera-style ops for construction PM.
 *
 * Key concepts:
 * - planned dates: as-built schedule (live, editable)
 * - baseline dates: frozen reference for variance tracking
 * - actual dates: derived from daily_entry submissions
 * - S-curve: cumulative % progress over time, planned vs actual vs baseline
 * - Gantt: scope rows with date bars, sorted by sortOrder
 * - Rebase: snapshot current planned dates → baseline columns + history table
 */
import { z } from 'zod';
import { router, orgProcedure } from '../trpc.js';
import { db, boqItem, scheduleBaseline, project } from '@sitelog/db';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const scheduleRouter = router({
  /** Get Gantt bars for a project: scope rows with planned/actual/baseline dates + computed % */
  gantt: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [proj] = await db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const rows: any = await db.execute(sql`
        SELECT
          bi.id, bi.ordinal, bi.quantity, bi.unit_rate_override,
          bi.planned_start, bi.planned_finish,
          bi.actual_start, bi.actual_finish,
          bi.baseline_start, bi.baseline_finish,
          bi.sort_order,
          ai.kode, ai.deskripsi, ai.satuan,
          (SELECT COALESCE(SUM(ea.quantity), 0)::numeric FROM entry_activity ea
            JOIN daily_entry de ON de.id = ea.daily_entry_id
            WHERE ea.ahsp_item_id = bi.ahsp_item_id AND de.project_id = ${input.projectId}) AS actual_qty,
          (SELECT MIN(de.entry_date) FROM entry_activity ea
            JOIN daily_entry de ON de.id = ea.daily_entry_id
            WHERE ea.ahsp_item_id = bi.ahsp_item_id AND de.project_id = ${input.projectId}) AS first_entry,
          (SELECT MAX(de.entry_date) FROM entry_activity ea
            JOIN daily_entry de ON de.id = ea.daily_entry_id
            WHERE ea.ahsp_item_id = bi.ahsp_item_id AND de.project_id = ${input.projectId}) AS last_entry
        FROM boq_item bi
        JOIN ahsp_item ai ON ai.id = bi.ahsp_item_id
        WHERE bi.project_id = ${input.projectId}
        ORDER BY bi.sort_order, bi.ordinal
      `);

      return {
        project: {
          id: proj.id, code: proj.code, name: proj.name,
          startDate: proj.startDate, finishDate: proj.finishDate,
          dataDate: proj.dataDate, baselineSetAt: proj.baselineSetAt,
        },
        scopes: ((rows.rows ?? rows) as any[]).map(r => {
          const planned = Number(r.quantity);
          const actual = Number(r.actual_qty ?? 0);
          const value = planned * Number(r.unit_rate_override ?? 0);
          return {
            id: r.id,
            kode: r.kode,
            description: r.description,
            satuan: r.satuan,
            sortOrder: r.sort_order,
            qtyPlanned: planned,
            qtyActual: actual,
            pctComplete: planned > 0 ? Math.min(100, (actual / planned) * 100) : 0,
            value,
            planned: { start: r.planned_start, finish: r.planned_finish },
            actual: { start: r.actual_start ?? r.first_entry, finish: r.actual_finish ?? r.last_entry },
            baseline: { start: r.baseline_start, finish: r.baseline_finish },
          };
        }),
      };
    }),

  /** S-curve: cumulative planned vs actual vs baseline % over time. */
  sCurve: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [proj] = await db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const rows: any = await db.execute(sql`
        SELECT
          bi.id,
          bi.quantity::float AS qty,
          COALESCE(bi.unit_rate_override::float, 0) AS rate,
          bi.planned_start, bi.planned_finish,
          bi.baseline_start, bi.baseline_finish
        FROM boq_item bi
        WHERE bi.project_id = ${input.projectId}
      `);
      const scopes = (rows.rows ?? rows) as any[];
      const totalValue = scopes.reduce((s, r) => s + r.qty * r.rate, 0);

      // Determine timeline bounds
      const projStart = proj.startDate ? new Date(proj.startDate) : new Date();
      const projFinish = proj.finishDate ? new Date(proj.finishDate) : new Date(projStart.getTime() + 90 * 86400_000);
      const today = proj.dataDate ? new Date(proj.dataDate) : new Date();

      // Generate weekly buckets
      const weekMs = 7 * 86400_000;
      const buckets: Array<{ date: string; planned: number; actual: number; baseline: number }> = [];
      for (let t = projStart.getTime(); t <= projFinish.getTime() + weekMs; t += weekMs) {
        const d = new Date(t);
        buckets.push({ date: d.toISOString().slice(0, 10), planned: 0, actual: 0, baseline: 0 });
      }

      // Spread each scope value linearly across its date range, accumulate
      for (const s of scopes) {
        const value = s.qty * s.rate;
        if (value === 0) continue;
        for (const range of [
          { start: s.planned_start, finish: s.planned_finish, key: 'planned' as const },
          { start: s.baseline_start, finish: s.baseline_finish, key: 'baseline' as const },
        ]) {
          if (!range.start || !range.finish) continue;
          const start = new Date(range.start).getTime();
          const finish = new Date(range.finish).getTime();
          const span = Math.max(1, finish - start);
          for (const b of buckets) {
            const bt = new Date(b.date).getTime();
            if (bt < start) continue;
            const fraction = Math.min(1, (bt - start) / span);
            b[range.key] += fraction * value;
          }
        }
      }

      // Actual cumulative from daily_entry
      const actualRows: any = await db.execute(sql`
        SELECT de.entry_date::date AS d, SUM(ea.quantity::float * COALESCE(bi.unit_rate_override::float, 0)) AS earned
        FROM entry_activity ea
        JOIN daily_entry de ON de.id = ea.daily_entry_id
        JOIN boq_item bi ON bi.ahsp_item_id = ea.ahsp_item_id AND bi.project_id = de.project_id
        WHERE de.project_id = ${input.projectId}
        GROUP BY de.entry_date
        ORDER BY de.entry_date
      `);
      let cumActual = 0;
      const actualByDate = new Map<string, number>();
      for (const r of (actualRows.rows ?? actualRows) as any[]) {
        cumActual += Number(r.earned);
        actualByDate.set(new Date(r.d).toISOString().slice(0, 10), cumActual);
      }
      // Fill actual into buckets — carry forward latest cumulative <= bucket date
      let runningActual = 0;
      for (const b of buckets) {
        // Find max actual date <= bucket date
        for (const [d, v] of actualByDate) {
          if (d <= b.date && v > runningActual) runningActual = v;
        }
        // Only show actual up to data date
        if (new Date(b.date) <= today) b.actual = runningActual;
      }

      // Convert to %
      return {
        totalValue,
        dataDate: today.toISOString().slice(0, 10),
        points: buckets.map(b => ({
          date: b.date,
          plannedPct: totalValue > 0 ? (b.planned / totalValue) * 100 : 0,
          actualPct: totalValue > 0 ? (b.actual / totalValue) * 100 : 0,
          baselinePct: totalValue > 0 ? (b.baseline / totalValue) * 100 : 0,
        })),
      };
    }),

  /** Update planned dates for one scope. */
  updateDates: orgProcedure
    .input(z.object({
      boqItemId: z.string().uuid(),
      plannedStart: z.string().nullable().optional(),
      plannedFinish: z.string().nullable().optional(),
      actualStart: z.string().nullable().optional(),
      actualFinish: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify scope belongs to org's project
      const [row]: any = await db.execute(sql`
        SELECT bi.id FROM boq_item bi
        JOIN project p ON p.id = bi.project_id
        WHERE bi.id = ${input.boqItemId} AND p.organization_id = ${ctx.session.organizationId}
        LIMIT 1
      `).then((r: any) => r.rows ?? r);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const updates: any = {};
      if (input.plannedStart !== undefined) updates.plannedStart = input.plannedStart;
      if (input.plannedFinish !== undefined) updates.plannedFinish = input.plannedFinish;
      if (input.actualStart !== undefined) updates.actualStart = input.actualStart;
      if (input.actualFinish !== undefined) updates.actualFinish = input.actualFinish;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
      if (Object.keys(updates).length) {
        await db.update(boqItem).set(updates).where(eq(boqItem.id, input.boqItemId));
      }
      return { ok: true };
    }),

  /** Snapshot current planned dates → baseline columns + history record. */
  rebaseline: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(120),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [proj] = await db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      // Snapshot
      const items = await db.select({
        id: boqItem.id,
        plannedStart: boqItem.plannedStart,
        plannedFinish: boqItem.plannedFinish,
        quantity: boqItem.quantity,
        unitRateOverride: boqItem.unitRateOverride,
      }).from(boqItem).where(eq(boqItem.projectId, input.projectId));

      // Copy planned → baseline columns
      await db.execute(sql`
        UPDATE boq_item
        SET baseline_start = planned_start, baseline_finish = planned_finish
        WHERE project_id = ${input.projectId}
      `);

      // Update project baseline_set_at
      await db.update(project).set({ baselineSetAt: new Date() }).where(eq(project.id, input.projectId));

      // History record
      await db.insert(scheduleBaseline).values({
        projectId: input.projectId,
        name: input.name,
        notes: input.notes,
        setById: ctx.session.user.id,
        snapshot: { items } as any,
      });

      const { log } = await import('../lib/logger.js');
      log.info('schedule.rebaseline', { projectId: input.projectId, userId: ctx.session.user.id, name: input.name, itemCount: items.length });

      return { ok: true, itemCount: items.length };
    }),

  /** List baseline history. */
  baselines: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify project ownership
      const [proj] = await db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const { desc: descFn } = await import('drizzle-orm');
      return db.select({
        id: scheduleBaseline.id,
        name: scheduleBaseline.name,
        notes: scheduleBaseline.notes,
        setAt: scheduleBaseline.setAt,
        setById: scheduleBaseline.setById,
      }).from(scheduleBaseline)
        .where(eq(scheduleBaseline.projectId, input.projectId))
        .orderBy(descFn(scheduleBaseline.setAt))
        .limit(50);
    }),
});
