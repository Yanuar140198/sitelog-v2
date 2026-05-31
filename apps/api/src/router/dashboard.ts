/**
 * Dashboard router — SPI/CPI computation per project + portfolio rollup.
 *
 * Earned Value (EV) = Σ (BOQ unit rate × actual quantity from daily entries)
 * Planned Value (PV) = Σ (BOQ subtotal × time_elapsed / total_duration)
 * Actual Cost (AC) = approximated from equipment HM × rate + labor estimates (V1 simple)
 *
 * SPI = EV / PV
 * CPI = EV / AC
 */
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { router, orgProcedure } from '../trpc.js';
import {
  project, boqItem, entryActivity, dailyEntry,
} from '@sitelog/db';
import { TRPCError } from '@trpc/server';

const N = (v: unknown) => Number(v ?? 0);

export const dashboardRouter = router({
  projectKpi: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      // Total BOQ value (planned)
      const boqItems = await ctx.db.select().from(boqItem).where(eq(boqItem.projectId, input.projectId));

      // Actual quantities per AHSP item from entries
      const actualRows = await ctx.db
        .select({
          ahspItemId: entryActivity.ahspItemId,
          totalQty: sql<string>`sum(${entryActivity.quantity})`,
        })
        .from(entryActivity)
        .innerJoin(dailyEntry, eq(entryActivity.dailyEntryId, dailyEntry.id))
        .where(and(
          eq(dailyEntry.projectId, input.projectId),
        ))
        .groupBy(entryActivity.ahspItemId);

      const actualMap = new Map(actualRows.map(r => [r.ahspItemId, N(r.totalQty)]));

      // Use cached subtotal (project.cachedGrandTotal updated by BOQ writes — V1 fallback compute on read)
      const subtotal = N(proj.cachedBoqSubtotal) || boqItems.reduce((a, it) =>
        a + N(it.quantity) * N(it.unitRateOverride ?? 0), 0);

      // Earned: percentage of each item completed × that item's planned subtotal
      let earned = 0;
      for (const it of boqItems) {
        const planned = N(it.quantity);
        if (planned <= 0) continue;
        const actual = actualMap.get(it.ahspItemId) ?? 0;
        const pct = Math.min(1, actual / planned);
        earned += pct * N(it.quantity) * N(it.unitRateOverride ?? 0);
      }

      // Planned-to-date (linear time)
      let pv = subtotal;
      if (proj.startDate && proj.finishDate) {
        const start = new Date(proj.startDate).getTime();
        const finish = new Date(proj.finishDate).getTime();
        const now = Date.now();
        if (finish > start) {
          const ratio = Math.max(0, Math.min(1, (now - start) / (finish - start)));
          pv = subtotal * ratio;
        }
      }

      const spi = pv > 0 ? earned / pv : null;
      const progressPct = subtotal > 0 ? (earned / subtotal) * 100 : 0;

      return {
        projectId: proj.id,
        code: proj.code,
        name: proj.name,
        plannedValue: Math.round(pv),
        earnedValue: Math.round(earned),
        boqSubtotal: Math.round(subtotal),
        spi,
        cpi: null,        // V2: needs actual cost from equipment HM + fuel + labor
        progressPct: Math.round(progressPct * 10) / 10,
      };
    }),

  portfolio: orgProcedure.query(async ({ ctx }) => {
    const { boqItem, ahspResource } = await import('@sitelog/db');
    const { sql } = await import('drizzle-orm');
    const projects = await ctx.db.select().from(project)
      .where(eq(project.organizationId, ctx.session.organizationId));
    if (!projects.length) return [];
    const projectIds = projects.map(p => p.id);
    // Parameterized id list (avoid sql.raw string interpolation).
    const idList = sql`(${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`;

    // BOQ subtotal per project (plan value)
    const boqRows = await ctx.db.execute(sql`
      SELECT bi.project_id, bi.ahsp_item_id, bi.quantity::numeric AS qty,
             COALESCE(bi.unit_rate_override::numeric,
               (SELECT SUM(r.koefisien::numeric * r.hsd::numeric)
                FROM ${ahspResource} r WHERE r.ahsp_item_id = bi.ahsp_item_id)
             ) AS rate
      FROM ${boqItem} bi WHERE bi.project_id IN ${idList}
    `);
    const planByProject = new Map<string, number>();
    const planByItem = new Map<string, { qty: number; rate: number }>();
    for (const r of (boqRows as any).rows ?? boqRows) {
      const pid = String((r as any).project_id);
      const qty = Number((r as any).qty ?? 0);
      const rate = Number((r as any).rate ?? 0);
      planByProject.set(pid, (planByProject.get(pid) ?? 0) + qty * rate);
      planByItem.set(`${pid}:${(r as any).ahsp_item_id}`, { qty, rate });
    }

    // Actual quantities sum per (project, ahsp_item) from entry_activity
    const actualRows = await ctx.db.execute(sql`
      SELECT de.project_id, ea.ahsp_item_id, SUM(ea.quantity::numeric) AS actual
      FROM entry_activity ea JOIN daily_entry de ON de.id = ea.daily_entry_id
      WHERE de.project_id IN ${idList} AND ea.ahsp_item_id IS NOT NULL
      GROUP BY de.project_id, ea.ahsp_item_id
    `);
    const earnedByProject = new Map<string, number>();
    for (const r of (actualRows as any).rows ?? actualRows) {
      const pid = String((r as any).project_id);
      const aid = String((r as any).ahsp_item_id);
      const actual = Number((r as any).actual ?? 0);
      const plan = planByItem.get(`${pid}:${aid}`);
      if (!plan || plan.qty <= 0) continue;
      const pct = Math.min(1, actual / plan.qty);
      earnedByProject.set(pid, (earnedByProject.get(pid) ?? 0) + pct * plan.qty * plan.rate);
    }

    return projects.map(p => {
      const subtotal = planByProject.get(p.id) ?? 0;
      const markup = subtotal * N(p.markupPct) / 100;
      const cont = subtotal * N(p.contingencyPct) / 100;
      const pre = subtotal + markup + cont;
      const ppn = pre * N(p.ppnPct) / 100;
      const earned = earnedByProject.get(p.id) ?? 0;
      const progressPct = subtotal > 0 ? (earned / subtotal) * 100 : 0;
      return {
        id: p.id, code: p.code, name: p.name, status: p.status,
        grandTotal: Math.round(pre + ppn),
        earnedValue: Math.round(earned),
        spi: subtotal > 0 ? Math.round((earned / subtotal) * 100) / 100 : 0,
        cpi: 0,
        progressPct: Math.round(progressPct * 10) / 10,
      };
    });
  }),
});
