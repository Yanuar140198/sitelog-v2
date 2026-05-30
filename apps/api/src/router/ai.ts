/**
 * AI assistant router — Claude-powered helpers.
 *   - status:           is the server configured with an API key?
 *   - draftDailyReport: narrative daily report from a daily entry's data
 *   - explainRate:      plain-language explanation of an AHSP unit rate
 *
 * All data is org-scoped before being sent to Claude (tenant isolation).
 */
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc.js';
import {
  dailyEntry, entryActivity, entryEquipmentUtil, unit, project,
  ahspItem, ahspResource,
} from '@sitelog/db';
import { aiConfigured, runClaude } from '../lib/anthropic.js';
import { computeAhspRate, type AhspCategory } from '../lib/ahsp-rate.js';
import {
  DAILY_REPORT_SYSTEM, buildDailyReportUser,
  EXPLAIN_RATE_SYSTEM, buildExplainRateUser, type ExplainRateRow,
} from '../lib/ai-prompts.js';

const N = (v: unknown) => Number(v ?? 0);

export const aiRouter = router({
  status: orgProcedure.query(() => ({ configured: aiConfigured() })),

  draftDailyReport: orgProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Org-scope the entry via its project.
      const [row] = await ctx.db
        .select({ entry: dailyEntry, projectName: project.name })
        .from(dailyEntry)
        .innerJoin(project, eq(dailyEntry.projectId, project.id))
        .where(and(eq(dailyEntry.id, input.entryId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [activities, equipRows] = await Promise.all([
        ctx.db.select().from(entryActivity).where(eq(entryActivity.dailyEntryId, input.entryId)),
        ctx.db
          .select({ e: entryEquipmentUtil, nomor: unit.nomor, jenis: unit.jenisAlat })
          .from(entryEquipmentUtil)
          .leftJoin(unit, eq(entryEquipmentUtil.unitId, unit.id))
          .where(eq(entryEquipmentUtil.dailyEntryId, input.entryId)),
      ]);

      const e = row.entry;
      const user = buildDailyReportUser({
        projectName: row.projectName,
        entryDate: e.entryDate,
        shift: e.shift,
        weather: e.weather,
        effectiveHours: e.effectiveHours,
        workforce: e.workforce,
        notes: e.notes,
        activities: activities.map((a) => ({
          description: a.description, quantity: a.quantity, satuan: a.satuan, station: a.station,
        })),
        equipment: equipRows.map((r) => ({
          unitLabel: r.nomor ? `${r.nomor}${r.jenis ? ` (${r.jenis})` : ''}` : null,
          hmWork: r.e.hmWork, hmIdle: r.e.hmIdle, hmBreakdown: r.e.hmBreakdown,
          fuelLiters: r.e.fuelLiters, trips: r.e.trips, status: r.e.status,
        })),
      });

      return runClaude(DAILY_REPORT_SYSTEM, user);
    }),

  explainRate: orgProcedure
    .input(z.object({ ahspItemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Readable if org-owned OR a global catalog item (organizationId null).
      const [item] = await ctx.db.select().from(ahspItem)
        .where(eq(ahspItem.id, input.ahspItemId)).limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      if (item.organizationId && item.organizationId !== ctx.session.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const resources = await ctx.db.select().from(ahspResource)
        .where(eq(ahspResource.ahspItemId, item.id));

      const cat = (c: string) => resources
        .filter((r) => r.category === c)
        .map((r): ExplainRateRow => ({
          uraian: r.uraian,
          koefisien: N(r.koefisien),
          hsd: N(r.hsd),
          subtotal: N(r.koefisien) * N(r.hsd),
        }));
      const sub = (rows: ExplainRateRow[]) => rows.reduce((s, r) => s + N(r.subtotal), 0);
      const tenaga = cat('tenaga'), bahan = cat('bahan'), peralatan = cat('peralatan');

      const totals = computeAhspRate(
        resources.map((r) => ({ category: r.category as AhspCategory, koefisien: N(r.koefisien), hsd: N(r.hsd) })),
        N(item.ohpPct),
      );

      const user = buildExplainRateUser({
        kode: item.kode,
        jenis: item.jenis,
        satuan: item.satuan,
        ohpPct: N(item.ohpPct),
        sections: {
          tenaga: { rows: tenaga, total: sub(tenaga) },
          bahan: { rows: bahan, total: sub(bahan) },
          peralatan: { rows: peralatan, total: sub(peralatan) },
        },
        totals: { abcSubtotal: totals.jumlahABC, ohpAmount: totals.ohpAmt, unitRate: totals.unitRate },
      });

      return runClaude(EXPLAIN_RATE_SYSTEM, user, 1500);
    }),
});
