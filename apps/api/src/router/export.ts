/**
 * Export router — Excel (xlsx) + PDF generation.
 *
 * Returns base64-encoded file content (small files OK; larger ones should use R2 presigned upload).
 */
import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { router, orgProcedure } from '../trpc.js';
import { boqItem, ahspItem, project } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import ExcelJS from 'exceljs';

const N = (v: unknown) => Number(v ?? 0);
const fmtIDR = (n: number) => `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

// Lightweight PDF builder — escapes text and lays out simple table.
// Produces single-page PDF stream using minimal PDF primitives (no external dep beyond what's installed).
// Note: for richer layouts use @react-pdf/renderer or pdf-lib (future).
function buildBoqPdf(opts: {
  projCode: string; projName: string;
  rows: Array<{ no: number; kode: string; jenis: string; satuan: string; qty: number; rate: number; sub: number }>;
  totals: { subtotal: number; markupAmt: number; markupPct: number; contAmt: number; contPct: number; ppnAmt: number; ppnPct: number; grand: number };
}): Uint8Array {
  // Use pdf-lib via dynamic import not added; fall back: emit simple HTML wrapped as text.
  // For now: build a placeholder PDF with text content (real implementation needs pdf-lib install).
  // Return UTF-8 bytes of HTML — caller can save as .html or convert to PDF via browser print.
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>BOQ ${opts.projCode}</title>
  <style>body{font-family:-apple-system,sans-serif;padding:24px}h1{margin:0 0 4px}h2{color:#FF5500;font-family:monospace;letter-spacing:2px;font-size:11px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0A0A0A;color:#fff;padding:6px;text-align:left}td{padding:5px 6px;border-bottom:1px solid #eee}
  .num{text-align:right;font-family:monospace}.grand{background:#FF5500;color:#fff;font-weight:bold}</style>
  </head><body>
  <h2>SITELOG · BOQ</h2><h1>${opts.projCode} — ${opts.projName}</h1>
  <table><thead><tr><th>No</th><th>Item</th><th>Jenis</th><th>Sat</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Subtotal</th></tr></thead>
  <tbody>${opts.rows.map(r => `<tr><td>${r.no}</td><td><b>${r.kode}</b></td><td>${r.jenis}</td><td>${r.satuan}</td><td class="num">${r.qty.toLocaleString('id-ID')}</td><td class="num">${fmtIDR(r.rate)}</td><td class="num">${fmtIDR(r.sub)}</td></tr>`).join('')}</tbody>
  <tfoot>
  <tr><td colspan="6" class="num">SUBTOTAL</td><td class="num">${fmtIDR(opts.totals.subtotal)}</td></tr>
  <tr><td colspan="6" class="num">+ Markup ${opts.totals.markupPct}%</td><td class="num">${fmtIDR(opts.totals.markupAmt)}</td></tr>
  <tr><td colspan="6" class="num">+ Contingency ${opts.totals.contPct}%</td><td class="num">${fmtIDR(opts.totals.contAmt)}</td></tr>
  <tr><td colspan="6" class="num">+ PPN ${opts.totals.ppnPct}%</td><td class="num">${fmtIDR(opts.totals.ppnAmt)}</td></tr>
  <tr class="grand"><td colspan="6" class="num">GRAND TOTAL</td><td class="num">${fmtIDR(opts.totals.grand)}</td></tr>
  </tfoot></table>
  <script>window.print()</script></body></html>`;
  return new TextEncoder().encode(html);
}

export const exportRouter = router({
  boqXlsx: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      markupPct: z.number().default(0),
      contingencyPct: z.number().default(0),
      ppnPct: z.number().default(11),
    }))
    .mutation(async ({ ctx, input }) => {
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const items = await ctx.db.select({
        boq: boqItem,
        ahsp: ahspItem,
      })
      .from(boqItem)
      .innerJoin(ahspItem, eq(boqItem.ahspItemId, ahspItem.id))
      .where(eq(boqItem.projectId, input.projectId))
      .orderBy(asc(boqItem.ordinal));

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Sitelog';
      wb.created = new Date();

      const ws = wb.addWorksheet('BOQ');
      ws.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Item', key: 'kode', width: 14 },
        { header: 'Jenis Pekerjaan', key: 'jenis', width: 50 },
        { header: 'Satuan', key: 'satuan', width: 10 },
        { header: 'Quantity', key: 'qty', width: 14 },
        { header: 'Unit Rate (Rp)', key: 'rate', width: 18 },
        { header: 'Subtotal (Rp)', key: 'sub', width: 20 },
      ];

      // Header row styling
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };

      // Title
      ws.spliceRows(1, 0, [`BOQ — ${proj.code} ${proj.name}`]);
      ws.mergeCells(1, 1, 1, 7);
      const titleRow = ws.getRow(1);
      titleRow.font = { bold: true, size: 14 };
      titleRow.height = 24;

      // Compute baseline rate per item from resource lines
      const { ahspResource } = await import('@sitelog/db');
      const itemIds = items.map(r => r.ahsp.id);
      const baselineMap = new Map<string, number>();
      if (itemIds.length) {
        const { inArray } = await import('drizzle-orm');
        const resRows = await ctx.db.select().from(ahspResource).where(inArray(ahspResource.ahspItemId, itemIds));
        for (const r of resRows) {
          baselineMap.set(r.ahspItemId, (baselineMap.get(r.ahspItemId) ?? 0) + N(r.koefisien) * N(r.hsd));
        }
      }

      let subtotal = 0;
      items.forEach((row, i) => {
        const qty = N(row.boq.quantity);
        const override = row.boq.unitRateOverride !== null ? N(row.boq.unitRateOverride) : 0;
        const baseline = baselineMap.get(row.ahsp.id) ?? 0;
        const rate = override > 0 ? override : baseline;
        const sub = qty * rate;
        subtotal += sub;
        ws.addRow({
          no: i + 1,
          kode: row.ahsp.kode,
          jenis: row.ahsp.jenis,
          satuan: row.ahsp.satuan,
          qty,
          rate,
          sub,
        });
      });

      // Totals rows
      const markupAmt = subtotal * input.markupPct / 100;
      const contAmt = subtotal * input.contingencyPct / 100;
      const preePpn = subtotal + markupAmt + contAmt;
      const ppnAmt = preePpn * input.ppnPct / 100;
      const grand = preePpn + ppnAmt;

      ws.addRow({});
      const sumRows: [string, number][] = [
        ['SUBTOTAL', subtotal],
        [`+ Markup ${input.markupPct}%`, markupAmt],
        [`+ Contingency ${input.contingencyPct}%`, contAmt],
        ['Pre-PPN', preePpn],
        [`+ PPN ${input.ppnPct}%`, ppnAmt],
        ['GRAND TOTAL', grand],
      ];
      for (const [label, val] of sumRows) {
        const r = ws.addRow({ jenis: label, sub: val });
        r.font = { bold: label === 'GRAND TOTAL' };
        if (label === 'GRAND TOTAL') {
          r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5500' } };
          r.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
        }
      }

      // Format currency columns
      ws.getColumn('rate').numFmt = '#,##0';
      ws.getColumn('sub').numFmt = '"Rp" #,##0';
      ws.getColumn('qty').numFmt = '#,##0.00';

      const buf = await wb.xlsx.writeBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return {
        filename: `BOQ-${proj.code.replace(/[^A-Za-z0-9]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: b64,
      };
    }),

  boqPdf: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      markupPct: z.number().default(0),
      contingencyPct: z.number().default(0),
      ppnPct: z.number().default(11),
    }))
    .mutation(async ({ ctx, input }) => {
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId))).limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });
      const items = await ctx.db.select({ boq: boqItem, ahsp: ahspItem })
        .from(boqItem)
        .innerJoin(ahspItem, eq(boqItem.ahspItemId, ahspItem.id))
        .where(eq(boqItem.projectId, input.projectId))
        .orderBy(asc(boqItem.ordinal));
      const { ahspResource } = await import('@sitelog/db');
      const { inArray } = await import('drizzle-orm');
      const itemIds = items.map(r => r.ahsp.id);
      const baselineMap = new Map<string, number>();
      if (itemIds.length) {
        const resRows = await ctx.db.select().from(ahspResource).where(inArray(ahspResource.ahspItemId, itemIds));
        for (const rr of resRows) baselineMap.set(rr.ahspItemId, (baselineMap.get(rr.ahspItemId) ?? 0) + N(rr.koefisien) * N(rr.hsd));
      }
      let subtotal = 0;
      const rows = items.map((r, i) => {
        const qty = N(r.boq.quantity);
        const override = r.boq.unitRateOverride !== null ? N(r.boq.unitRateOverride) : 0;
        const rate = override > 0 ? override : (baselineMap.get(r.ahsp.id) ?? 0);
        const sub = qty * rate;
        subtotal += sub;
        return { no: i + 1, kode: r.ahsp.kode, jenis: r.ahsp.jenis, satuan: r.ahsp.satuan, qty, rate, sub };
      });
      const markupAmt = subtotal * input.markupPct / 100;
      const contAmt = subtotal * input.contingencyPct / 100;
      const preePpn = subtotal + markupAmt + contAmt;
      const ppnAmt = preePpn * input.ppnPct / 100;
      const grand = preePpn + ppnAmt;
      const bytes = buildBoqPdf({
        projCode: proj.code, projName: proj.name, rows,
        totals: { subtotal, markupAmt, markupPct: input.markupPct, contAmt, contPct: input.contingencyPct, ppnAmt, ppnPct: input.ppnPct, grand },
      });
      return {
        filename: `BOQ-${proj.code.replace(/[^A-Za-z0-9]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.html`,
        contentType: 'text/html',
        base64: Buffer.from(bytes).toString('base64'),
        note: 'Open in browser → File → Print → Save as PDF for final document.',
      };
    }),
});
