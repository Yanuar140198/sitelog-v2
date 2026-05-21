/**
 * BOQ router — handles scope management + resource overrides + computed totals.
 *
 * Pricing engine resolves unit rate per BOQ item by:
 *   1. Start with AHSP catalog resource lines (koef × HSD per line)
 *   2. Apply per-project resource overrides (boqResourceOverride)
 *   3. Sum lines → subtotal_ABC → add OHP → unit rate
 *   4. Multiply by BOQ item quantity → line subtotal
 *   5. Aggregate → project subtotal → markup/contingency/PPN → grand total
 */
import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import {
  boqItem, boqResourceOverride, ahspItem, ahspResource, project,
} from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { audit } from '../lib/audit.js';

const N = (v: unknown) => Number(v ?? 0);

interface ResolvedResourceLine {
  category: 'tenaga' | 'bahan' | 'peralatan';
  resourceCode: string;
  uraian: string;
  koefisien: number;
  koefisienOrig: number;
  hsd: number;
  hsdOrig: number;
  total: number;
  satuan: string | null;
  isOverridden: boolean;
}

interface ResolvedRate {
  ahspItemId: string;
  kode: string;
  jenis: string;
  satuan: string;
  lines: ResolvedResourceLine[];
  totalTenaga: number;
  totalBahan: number;
  totalPeralatan: number;
  jumlahABC: number;
  ohpPct: number;
  ohpAmt: number;
  unitRate: number;
  hasOverride: boolean;
}

async function resolveRates(
  ctx: any,
  projectId: string,
  ahspItemIds: string[],
): Promise<Map<string, ResolvedRate>> {
  if (ahspItemIds.length === 0) return new Map();
  const items = await ctx.db.select().from(ahspItem).where(/* in() */ eq(ahspItem.id, ahspItemIds[0]!)); // placeholder
  // Use IN for the array
  const itemsAll = await ctx.db.query.ahspItem.findMany({
    where: (a: any, { inArray }: any) => inArray(a.id, ahspItemIds),
  });
  const resources = await ctx.db.query.ahspResource.findMany({
    where: (r: any, { inArray }: any) => inArray(r.ahspItemId, ahspItemIds),
    orderBy: (r: any, { asc }: any) => [asc(r.category), asc(r.ordinal)],
  });
  const overrides = await ctx.db.query.boqResourceOverride.findMany({
    where: (o: any, { and, eq, inArray }: any) =>
      and(eq(o.projectId, projectId), inArray(o.ahspItemId, ahspItemIds)),
  });
  const ovMap = new Map<string, { koef: number | null; hsd: number | null }>();
  for (const ov of overrides) {
    ovMap.set(`${ov.ahspItemId}:${ov.resourceCode}`, {
      koef: ov.koefisien === null ? null : N(ov.koefisien),
      hsd: ov.hsd === null ? null : N(ov.hsd),
    });
  }

  const out = new Map<string, ResolvedRate>();
  for (const it of itemsAll) {
    const itemLines = resources.filter((r: any) => r.ahspItemId === it.id);
    const lines: ResolvedResourceLine[] = itemLines.map((r: any) => {
      const ov = ovMap.get(`${it.id}:${r.resourceCode}`) ?? { koef: null, hsd: null };
      const koefOrig = N(r.koefisien);
      const hsdOrig = N(r.hsd);
      const koef = ov.koef ?? koefOrig;
      const hsd = ov.hsd ?? hsdOrig;
      return {
        category: r.category,
        resourceCode: r.resourceCode,
        uraian: r.uraian,
        koefisien: koef,
        koefisienOrig: koefOrig,
        hsd,
        hsdOrig,
        total: koef * hsd,
        satuan: r.satuan,
        isOverridden: ov.koef !== null || ov.hsd !== null,
      };
    });
    const totalTenaga = lines.filter(l => l.category === 'tenaga').reduce((a, l) => a + l.total, 0);
    const totalBahan = lines.filter(l => l.category === 'bahan').reduce((a, l) => a + l.total, 0);
    const totalPeralatan = lines.filter(l => l.category === 'peralatan').reduce((a, l) => a + l.total, 0);
    const jumlahABC = totalTenaga + totalBahan + totalPeralatan;
    const ohpPct = N(it.ohpPct);
    const ohpAmt = jumlahABC * ohpPct / 100;
    out.set(it.id, {
      ahspItemId: it.id,
      kode: it.kode,
      jenis: it.jenis,
      satuan: it.satuan,
      lines,
      totalTenaga,
      totalBahan,
      totalPeralatan,
      jumlahABC,
      ohpPct,
      ohpAmt,
      unitRate: jumlahABC + ohpAmt,
      hasOverride: lines.some(l => l.isOverridden),
    });
  }
  return out;
}

export const boqRouter = router({
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      markupPct: z.number().min(0).max(100).optional(),
      contingencyPct: z.number().min(0).max(100).optional(),
      ppnPct: z.number().min(0).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify project ownership
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const items = await ctx.db.select().from(boqItem)
        .where(eq(boqItem.projectId, input.projectId))
        .orderBy(asc(boqItem.ordinal));

      const rates = await resolveRates(ctx, input.projectId, items.map(i => i.ahspItemId));

      const markupPct = input.markupPct ?? N(proj.markupPct);
      const contingencyPct = input.contingencyPct ?? N(proj.contingencyPct);
      const ppnPct = input.ppnPct ?? N(proj.ppnPct);

      let subtotal = 0, sumT = 0, sumB = 0, sumA = 0;
      const enriched = items.map(it => {
        const r = rates.get(it.ahspItemId);
        const qty = N(it.quantity);
        const defaultRate = r?.unitRate ?? 0;
        const override = it.unitRateOverride !== null ? N(it.unitRateOverride) : null;
        const appliedRate = override !== null && override > 0 ? override : defaultRate;
        const ratio = defaultRate > 0 ? appliedRate / defaultRate : 0;
        const lineSub = qty * appliedRate;
        const t = (r?.totalTenaga ?? 0) * ratio * qty;
        const b = (r?.totalBahan ?? 0) * ratio * qty;
        const a = (r?.totalPeralatan ?? 0) * ratio * qty;
        subtotal += lineSub; sumT += t; sumB += b; sumA += a;
        return {
          id: it.id,
          ahspItemId: it.ahspItemId,
          kode: r?.kode ?? '',
          jenis: r?.jenis ?? '',
          satuan: r?.satuan ?? '',
          quantity: qty,
          defaultRate,
          unitRateOverride: override,
          appliedRate,
          subtotal: Math.round(lineSub),
          tenaga: Math.round(t),
          bahan: Math.round(b),
          peralatan: Math.round(a),
          hasResourceOverride: r?.hasOverride ?? false,
          note: it.note,
          ordinal: it.ordinal,
        };
      });

      const markupAmt = subtotal * markupPct / 100;
      const contingencyAmt = subtotal * contingencyPct / 100;
      const subtotalBeforePpn = subtotal + markupAmt + contingencyAmt;
      const ppnAmt = subtotalBeforePpn * ppnPct / 100;
      const grandTotal = subtotalBeforePpn + ppnAmt;

      return {
        projectId: input.projectId,
        items: enriched,
        totals: {
          subtotal: Math.round(subtotal),
          tenaga: Math.round(sumT),
          bahan: Math.round(sumB),
          peralatan: Math.round(sumA),
          markupPct, markupAmt: Math.round(markupAmt),
          contingencyPct, contingencyAmt: Math.round(contingencyAmt),
          subtotalBeforePpn: Math.round(subtotalBeforePpn),
          ppnPct, ppnAmt: Math.round(ppnAmt),
          grandTotal: Math.round(grandTotal),
        },
      };
    }),

  upsert: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      ahspItemId: z.string().uuid(),
      quantity: z.number().nonnegative(),
      unitRateOverride: z.number().nonnegative().nullable().optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.select().from(boqItem)
        .where(and(eq(boqItem.projectId, input.projectId), eq(boqItem.ahspItemId, input.ahspItemId)))
        .limit(1);
      if (existing.length > 0) {
        const [row] = await ctx.db.update(boqItem).set({
          quantity: String(input.quantity),
          unitRateOverride: input.unitRateOverride === null || input.unitRateOverride === undefined
            ? null : String(input.unitRateOverride),
          note: input.note ?? null,
          updatedAt: new Date(),
        }).where(eq(boqItem.id, existing[0]!.id)).returning();
        if (row) await audit(ctx, { action: 'boq.update', resource: 'boq_item', resourceId: row.id, after: { quantity: input.quantity, unitRateOverride: input.unitRateOverride } });
        return row;
      }
      const [row] = await ctx.db.insert(boqItem).values({
        projectId: input.projectId,
        ahspItemId: input.ahspItemId,
        quantity: String(input.quantity),
        unitRateOverride: input.unitRateOverride === null || input.unitRateOverride === undefined
          ? null : String(input.unitRateOverride),
        note: input.note ?? null,
        createdById: ctx.session.user.id,
      }).returning();
      if (row) await audit(ctx, { action: 'boq.create', resource: 'boq_item', resourceId: row.id, after: { quantity: input.quantity } });
      return row;
    }),

  remove: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(boqItem).where(eq(boqItem.id, input.id));
      await audit(ctx, { action: 'boq.delete', resource: 'boq_item', resourceId: input.id });
      return { ok: true };
    }),

  /** Import BOQ items from XLSX upload (base64-encoded).
   *  Expected columns: kode, quantity, unit_rate_override (optional), note (optional). */
  importXlsx: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      base64: z.string(),
      replaceExisting: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const buf = Buffer.from(input.base64, 'base64');
      await wb.xlsx.load(buf as any);
      const ws = wb.worksheets[0];
      if (!ws) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty workbook' });

      // Detect header row (find row containing 'kode')
      let headerRow = 1;
      let kodeCol = -1, qtyCol = -1, rateCol = -1, noteCol = -1;
      for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
        const row = ws.getRow(r);
        row.eachCell((cell, col) => {
          const v = String(cell.value ?? '').toLowerCase().trim();
          if (v === 'kode' || v === 'code' || v === 'ahsp') { headerRow = r; kodeCol = col; }
          if (v.includes('qty') || v.includes('quantity')) qtyCol = col;
          if (v.includes('rate') || v.includes('harga')) rateCol = col;
          if (v === 'note' || v === 'catatan') noteCol = col;
        });
        if (kodeCol > 0 && qtyCol > 0) break;
      }
      if (kodeCol < 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not find kode column' });
      if (qtyCol < 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not find quantity column' });

      if (input.replaceExisting) {
        await ctx.db.delete(boqItem).where(eq(boqItem.projectId, input.projectId));
      }

      let imported = 0, skipped = 0, missing = 0;
      for (let r = headerRow + 1; r <= ws.rowCount; r++) {
        const kode = String(ws.getRow(r).getCell(kodeCol).value ?? '').trim();
        if (!kode) continue;
        const qty = Number(ws.getRow(r).getCell(qtyCol).value ?? 0);
        if (!qty) { skipped++; continue; }
        const rateVal = rateCol > 0 ? ws.getRow(r).getCell(rateCol).value : null;
        const rate = rateVal ? Number(rateVal) : null;
        const note = noteCol > 0 ? String(ws.getRow(r).getCell(noteCol).value ?? '') : undefined;

        const [a] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem).where(eq(ahspItem.kode, kode)).limit(1);
        if (!a) { missing++; continue; }
        await ctx.db.insert(boqItem).values({
          projectId: input.projectId,
          ahspItemId: a.id,
          quantity: String(qty),
          unitRateOverride: rate ? String(rate) : null,
          note,
          createdById: ctx.session.user.id,
        }).onConflictDoUpdate({
          target: [boqItem.projectId, boqItem.ahspItemId],
          set: { quantity: String(qty), unitRateOverride: rate ? String(rate) : null, note, updatedAt: new Date() },
        }).catch(() => {});
        imported++;
      }
      return { imported, skipped, missing };
    }),

  setResourceOverride: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      ahspItemId: z.string().uuid(),
      resourceCode: z.string().min(1),
      koefisien: z.number().nullable(),
      hsd: z.number().nullable(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.select().from(boqResourceOverride)
        .where(and(
          eq(boqResourceOverride.projectId, input.projectId),
          eq(boqResourceOverride.ahspItemId, input.ahspItemId),
          eq(boqResourceOverride.resourceCode, input.resourceCode),
        )).limit(1);
      const values = {
        koefisien: input.koefisien === null ? null : String(input.koefisien),
        hsd: input.hsd === null ? null : String(input.hsd),
        note: input.note,
        updatedById: ctx.session.user.id,
        updatedAt: new Date(),
      };
      if (existing.length > 0) {
        const [row] = await ctx.db.update(boqResourceOverride).set(values)
          .where(eq(boqResourceOverride.id, existing[0]!.id)).returning();
        return row;
      }
      const [row] = await ctx.db.insert(boqResourceOverride).values({
        projectId: input.projectId,
        ahspItemId: input.ahspItemId,
        resourceCode: input.resourceCode,
        ...values,
      }).returning();
      return row;
    }),

  clearResourceOverride: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      ahspItemId: z.string().uuid(),
      resourceCode: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(boqResourceOverride).where(and(
        eq(boqResourceOverride.projectId, input.projectId),
        eq(boqResourceOverride.ahspItemId, input.ahspItemId),
        eq(boqResourceOverride.resourceCode, input.resourceCode),
      ));
      return { ok: true };
    }),
});
