import { z } from 'zod';
import { and, eq, or, isNull, asc, max, inArray, sql } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { ahspItem, ahspInput, ahspKoefisien, ahspResource, ahspVersion, resourceMaster } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { computeAhspRate, type AhspCategory } from '../lib/ahsp-rate.js';

const N = (v: unknown) => Number(v ?? 0);

// --- xlsx-import helpers (used by importFromXlsxBase64) ---
const T = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const NUM = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const CATEGORY_HEADER_MAP: Record<string, 'tenaga' | 'bahan' | 'peralatan'> = {
  'A. HSD TENAGA KERJA': 'tenaga',
  'B. HSD BAHAN / MATERIAL': 'bahan',
  'C. HSD PERALATAN': 'peralatan',
};
const KODE_BRACKET = /\[([A-Za-z0-9-]+)\]/;
const SATUAN_RE = /Satuan:\s*(.+)$/i;

function colBToKode(b: string): string {
  const s = b.trim();
  const m = s.match(/^AHSP\s*#\s*(\d+)/);
  if (m) return `AHSP-${m[1]}`;
  return s;
}

function deriveLabel(b: string, c: string): { label: string; jenis: string } {
  const bs = b.trim();
  const cs = c.trim();
  if (bs.startsWith('AHSP')) {
    const m = cs.match(KODE_BRACKET);
    if (m) {
      const label = m[1] || bs;
      let after = cs.slice(m.index! + m[0].length).trim();
      after = after.replace(/^Item:\s*/, '').trim();
      return { label, jenis: after || bs };
    }
    return { label: bs, jenis: cs || bs };
  }
  return { label: bs, jenis: cs || bs };
}

// Normalize an exceljs cell to string|number|null (unwrap formula/richtext)
function rowVals(row: any, n: number): any[] {
  const out: any[] = new Array(n).fill(null);
  for (let i = 1; i <= n; i++) {
    let v = row.getCell(i).value;
    if (v && typeof v === 'object') {
      if ('result' in v) v = (v as any).result;
      else if ('richText' in v) v = (v as any).richText.map((r: any) => r.text).join('');
      else if ('text' in v) v = (v as any).text;
    }
    out[i - 1] = v ?? null;
  }
  return out;
}

interface ParsedResource { kode: string; nama: string; category: 'tenaga' | 'bahan' | 'peralatan'; satuan: string; hsd: number; catatan: string; }
interface ParsedInput { ordinal: number; kode: string; variable: string | null; uraian: string; nilai: number | null; satuan: string; sumber: string; }
interface ParsedKoef { ordinal: number; kode: string; variable: string | null; uraian: string; nilai: number | null; satuan: string; formula: string; }
interface ParsedResourceLine { category: 'tenaga' | 'bahan' | 'peralatan'; ordinal: number; resourceCode: string; uraian: string; koefisien: number; satuan: string; hsd: number; }
interface ParsedAhsp { kode: string; sourceKode: string; label: string; jenis: string; satuan: string; ohpPct: number; inputs: ParsedInput[]; koefisien: ParsedKoef[]; resources: ParsedResourceLine[]; }

function parseParameterSheet(ws: any): ParsedResource[] {
  const out: ParsedResource[] = [];
  let currentCat: 'tenaga' | 'bahan' | 'peralatan' | null = null;
  let inTable = false;
  const rowCount: number = ws.rowCount || 0;
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells = rowVals(row, 8);
    const joined = cells.filter(c => c !== null && c !== undefined).map(c => T(c)).join(' ');
    let matchedHeader = false;
    for (const [header, cat] of Object.entries(CATEGORY_HEADER_MAP)) {
      if (joined.includes(header)) { currentCat = cat; inTable = false; matchedHeader = true; break; }
    }
    if (matchedHeader) continue;
    if (currentCat && T(cells[1]) === 'No.' && T(cells[2]) === 'Kode') { inTable = true; continue; }
    if (inTable && currentCat) {
      const kode = T(cells[2]);
      const uraian = T(cells[3]);
      const satuan = T(cells[4]);
      const hsd = NUM(cells[5]);
      const catatan = T(cells[6]);
      if (kode && uraian && hsd !== null) {
        out.push({ kode, nama: uraian, category: currentCat, satuan: satuan || '-', hsd, catatan });
      } else if (!kode && !uraian) {
        inTable = false;
      }
    }
  }
  return out;
}

function parseCalculationSheet(ws: any): ParsedAhsp[] {
  const rowCount: number = ws.rowCount || 0;
  const allRows: any[][] = [];
  for (let r = 1; r <= rowCount; r++) allRows.push(rowVals(ws.getRow(r), 9));
  const blockStarts: number[] = [];
  for (let i = 0; i < allRows.length; i++) {
    if (T(allRows[i][7]).startsWith('Satuan:')) blockStarts.push(i);
  }
  const items: ParsedAhsp[] = [];
  const seen: Record<string, number> = {};
  for (let idx = 0; idx < blockStarts.length; idx++) {
    const start = blockStarts[idx];
    const end = idx + 1 < blockStarts.length ? blockStarts[idx + 1] : allRows.length;
    const header = allRows[start];
    const b = T(header[1]);
    const c = T(header[2]);
    const h = T(header[7]);
    const m = h.match(SATUAN_RE);
    const satuan = m ? m[1].trim() : '';
    let kode = colBToKode(b);
    if (seen[kode]) { seen[kode]++; kode = `${kode}-v${seen[kode]}`; } else { seen[kode] = 1; }
    const { label, jenis } = deriveLabel(b, c);
    const item: ParsedAhsp = { kode, sourceKode: b, label, jenis, satuan, ohpPct: 0, inputs: [], koefisien: [], resources: [] };

    let section: 'input' | 'koef' | 'analisa' | null = null;
    let analisaCat: 'tenaga' | 'bahan' | 'peralatan' | null = null;
    let inResTable = false;
    let ordIn = 0, ordK = 0;
    const ordR = { tenaga: 0, bahan: 0, peralatan: 0 };

    for (let r = start + 1; r < end; r++) {
      const row = allRows[r];
      const joined = row.filter(x => x !== null && x !== undefined).map(x => T(x)).join(' ');
      if (joined.includes('I. INPUT')) { section = 'input'; inResTable = false; continue; }
      if (joined.includes('II. PRODUKTIVITAS')) { section = 'koef'; inResTable = false; continue; }
      if (joined.includes('III. ANALISA')) { section = 'analisa'; inResTable = false; continue; }
      if (section === 'analisa') {
        const a = T(row[1]); const cc = T(row[2]); const dc = T(row[3]);
        if (a === 'A.' && (cc.startsWith('TENAGA') || dc.startsWith('TENAGA'))) { analisaCat = 'tenaga'; inResTable = true; continue; }
        if (a === 'B.' && (cc.startsWith('BAHAN') || dc.startsWith('BAHAN'))) { analisaCat = 'bahan'; inResTable = true; continue; }
        if (a === 'C.' && (cc.startsWith('PERALATAN') || dc.startsWith('PERALATAN'))) { analisaCat = 'peralatan'; inResTable = true; continue; }
        if (a === 'D.') { inResTable = false; continue; }
        if (a === 'E.') { const pct = NUM(row[4]); item.ohpPct = pct ?? 0; inResTable = false; continue; }
        if (a === 'F.') { inResTable = false; continue; }
        if (a === 'No.' && cc === 'Kode') continue;
        if (dc.startsWith('JUMLAH HARGA')) continue;
        if (a === '-' || cc.startsWith('Tidak ada') || dc.startsWith('Tidak ada')) continue;
        if (inResTable && analisaCat) {
          const resourceCode = cc; const uraian = dc;
          const koef = NUM(row[4]); const sat = T(row[5]); const hsd = NUM(row[6]);
          if (resourceCode && uraian && koef !== null && hsd !== null) {
            ordR[analisaCat]++;
            item.resources.push({ category: analisaCat, ordinal: ordR[analisaCat], resourceCode, uraian, koefisien: koef, satuan: sat, hsd });
          }
        }
        continue;
      }
      const kcol = T(row[1]); const vcol = T(row[2]); const ucol = T(row[3]);
      const ncol = NUM(row[4]); const scol = T(row[5]); const fcol = T(row[6]);
      if (kcol === 'Kode' && vcol === 'Variable') continue;
      if (joined.includes('⚠') || joined.includes('CHECK REQUIRED')) continue;
      if (!kcol && !ucol) continue;
      if (section === 'input') {
        ordIn++;
        item.inputs.push({ ordinal: ordIn, kode: kcol, variable: vcol && vcol !== '-' ? vcol : null, uraian: ucol, nilai: ncol, satuan: scol, sumber: fcol });
      } else if (section === 'koef') {
        ordK++;
        item.koefisien.push({ ordinal: ordK, kode: kcol, variable: vcol && vcol !== '-' ? vcol : null, uraian: ucol, nilai: ncol, satuan: scol, formula: fcol });
      }
    }
    items.push(item);
  }
  return items;
}

/**
 * Append a JSONB snapshot of the entire AHSP item (header + inputs + koefisien + resources + computed
 * unit rate) to the ahsp_version log. Called after every mutation so a full audit + restore trail exists.
 * Auto-increments version_number (MAX+1).
 */
async function snapshotAhsp(
  db: any,
  ahspItemId: string,
  changedById: string | null,
  summary: string,
) {
  const [item] = await db.select().from(ahspItem).where(eq(ahspItem.id, ahspItemId)).limit(1);
  if (!item) return null;
  const [inputs, koef, resources] = await Promise.all([
    db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, ahspItemId)).orderBy(asc(ahspInput.ordinal)),
    db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, ahspItemId)).orderBy(asc(ahspKoefisien.ordinal)),
    db.select().from(ahspResource).where(eq(ahspResource.ahspItemId, ahspItemId)).orderBy(asc(ahspResource.category), asc(ahspResource.ordinal)),
  ]);
  const totals = computeAhspRate(
    resources.map((r: any) => ({ category: r.category as AhspCategory, koefisien: N(r.koefisien), hsd: N(r.hsd) })),
    N(item.ohpPct),
  );
  const [maxRow] = await db.select({ m: max(ahspVersion.versionNumber) }).from(ahspVersion)
    .where(eq(ahspVersion.ahspItemId, ahspItemId));
  const nextVer = (maxRow?.m ?? 0) + 1;
  const [row] = await db.insert(ahspVersion).values({
    ahspItemId,
    versionNumber: nextVer,
    snapshot: { item, inputs, koefisien: koef, resources, computedRate: totals.unitRate },
    changedById,
    changeSummary: summary.slice(0, 200),
  }).returning();
  return row;
}

/**
 * Guard: confirm the AHSP item is org-owned (mutable). Throws FORBIDDEN for global catalog items
 * (organization_id IS NULL) or items belonging to other orgs.
 */
async function assertEditable(db: any, ahspItemId: string, orgId: string) {
  const [own] = await db.select().from(ahspItem)
    .where(and(eq(ahspItem.id, ahspItemId), eq(ahspItem.organizationId, orgId)))
    .limit(1);
  if (!own) throw new TRPCError({ code: 'FORBIDDEN', message: 'AHSP item is read-only (global or not in your org).' });
  return own;
}

export const ahspRouter = router({
  // Catalog visible to org: global (orgId NULL) + org-owned items
  catalog: orgProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx }) => {
      return ctx.db.select().from(ahspItem)
        .where(or(
          isNull(ahspItem.organizationId),
          eq(ahspItem.organizationId, ctx.session.organizationId),
        ))
        .orderBy(asc(ahspItem.section), asc(ahspItem.kode));
    }),

  detail: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.id),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      const [inputs, koef, resources] = await Promise.all([
        ctx.db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, item.id)).orderBy(asc(ahspInput.ordinal)),
        ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, item.id)).orderBy(asc(ahspKoefisien.ordinal)),
        ctx.db.select().from(ahspResource).where(eq(ahspResource.ahspItemId, item.id)).orderBy(asc(ahspResource.category), asc(ahspResource.ordinal)),
      ]);
      return { item, inputs, koefisien: koef, resources };
    }),

  /**
   * Full breakdown for the AHSP detail sheet view:
   *   - item header
   *   - sections A (tenaga), B (bahan), C (peralatan) with per-line subtotals
   *   - totals: ABC + OHP + final unit rate
   *   - productivity inputs (read-only params)
   */
  detailBreakdown: orgProcedure
    .input(z.object({ ahspItemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const [resources, inputs] = await Promise.all([
        ctx.db.select().from(ahspResource)
          .where(eq(ahspResource.ahspItemId, item.id))
          .orderBy(asc(ahspResource.category), asc(ahspResource.ordinal)),
        ctx.db.select().from(ahspInput)
          .where(eq(ahspInput.ahspItemId, item.id))
          .orderBy(asc(ahspInput.ordinal)),
      ]);

      const ohpPct = N(item.ohpPct);
      const totals = computeAhspRate(
        resources.map(r => ({
          category: r.category as AhspCategory,
          koefisien: N(r.koefisien),
          hsd: N(r.hsd),
        })),
        ohpPct,
      );

      const buildSection = (cat: AhspCategory) => {
        const rows = resources
          .filter(r => r.category === cat)
          .map(r => {
            const koef = N(r.koefisien);
            const hsd = N(r.hsd);
            return {
              id: r.id,
              code: r.resourceCode,
              uraian: r.uraian,
              satuan: r.satuan,
              koefisien: koef,
              hsd,
              subtotal: koef * hsd,
            };
          });
        const total =
          cat === 'tenaga' ? totals.totalTenaga :
          cat === 'bahan' ? totals.totalBahan :
          totals.totalPeralatan;
        return { rows, total };
      };

      return {
        item: {
          id: item.id,
          kode: item.kode,
          jenis: item.jenis,
          deskripsi: item.deskripsi,
          satuan: item.satuan,
          ohpPct,
        },
        sections: {
          tenaga: buildSection('tenaga'),
          bahan: buildSection('bahan'),
          peralatan: buildSection('peralatan'),
        },
        totals: {
          abcSubtotal: totals.jumlahABC,
          ohpAmount: totals.ohpAmt,
          unitRate: totals.unitRate,
        },
        inputs: inputs.map(i => ({
          kode: i.kode,
          variable: i.variable,
          uraian: i.uraian,
          nilai: i.nilai === null ? null : N(i.nilai),
          satuan: i.satuan,
          sumber: i.sumber,
        })),
      };
    }),

  // Create custom org-scoped AHSP item
  create: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      kode: z.string().min(1).max(32),
      label: z.string().optional(),
      section: z.string().optional(),
      jenis: z.string().min(1),
      satuan: z.string().min(1),
      ohpPct: z.number().min(0).max(100).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(ahspItem).values({
        ...input,
        organizationId: ctx.session.organizationId,
        ohpPct: String(input.ohpPct),
      }).returning();
      return row;
    }),

  update: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        kode: z.string().optional(),
        label: z.string().optional(),
        section: z.string().optional(),
        jenis: z.string().optional(),
        satuan: z.string().optional(),
        ohpPct: z.number().min(0).max(100).optional(),
        deskripsi: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const sets: any = { ...input.data, updatedAt: new Date() };
      if (sets.ohpPct !== undefined) sets.ohpPct = String(sets.ohpPct);
      const [row] = await ctx.db.update(ahspItem).set(sets)
        .where(and(eq(ahspItem.id, input.id), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .returning();
      return row;
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(ahspItem)
        .where(and(eq(ahspItem.id, input.id), eq(ahspItem.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  resourceUpsert: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      id: z.string().uuid().optional(),
      category: z.enum(['tenaga', 'bahan', 'peralatan']),
      ordinal: z.number().int().default(0),
      resourceCode: z.string().min(1),
      uraian: z.string().min(1),
      koefisien: z.number(),
      satuan: z.string().optional(),
      hsd: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ahsp item belongs to org
      const [own] = await ctx.db.select().from(ahspItem)
        .where(and(eq(ahspItem.id, input.ahspItemId), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!own) throw new TRPCError({ code: 'FORBIDDEN', message: 'Can only edit org-owned AHSP items' });
      const values = {
        ahspItemId: input.ahspItemId,
        category: input.category,
        ordinal: input.ordinal,
        resourceCode: input.resourceCode,
        uraian: input.uraian,
        koefisien: String(input.koefisien),
        satuan: input.satuan,
        hsd: String(input.hsd),
      };
      if (input.id) {
        const [row] = await ctx.db.update(ahspResource).set(values).where(eq(ahspResource.id, input.id)).returning();
        return row;
      }
      const [row] = await ctx.db.insert(ahspResource).values(values).returning();
      return row;
    }),

  resourceDelete: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(ahspResource).where(eq(ahspResource.id, input.id));
      return { ok: true };
    }),

  /**
   * Catalog with computed rate (ABC × (1 + OHP%)) and project usage count.
   * Same scope rules as `catalog` (global + org-owned).
   */
  catalogWithRates: orgProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;
      const result = await ctx.db.execute(sql`
        SELECT
          ai.id,
          ai.organization_id,
          ai.kode,
          ai.label,
          ai.source_kode,
          ai.item_no,
          ai.section,
          ai.jenis,
          ai.deskripsi,
          ai.satuan,
          ai.ohp_pct,
          ai.created_at,
          ai.updated_at,
          COALESCE((
            SELECT SUM(ar.koefisien::float8 * ar.hsd::float8)
            FROM ahsp_resource ar WHERE ar.ahsp_item_id = ai.id
          ), 0) * (1 + COALESCE(ai.ohp_pct, 0)::float8 / 100) AS computed_rate,
          (
            SELECT COUNT(DISTINCT p.id)::int
            FROM boq_item bi JOIN project p ON p.id = bi.project_id
            WHERE bi.ahsp_item_id = ai.id AND p.organization_id = ${orgId}
          ) AS used_in_projects
        FROM ahsp_item ai
        WHERE ai.organization_id IS NULL OR ai.organization_id = ${orgId}
        ORDER BY ai.kode
      `);
      const rows = (result as any).rows ?? result;
      return (rows as any[]).map(r => ({
        id: String(r.id),
        organizationId: r.organization_id ? String(r.organization_id) : null,
        kode: r.kode as string,
        label: (r.label as string) ?? null,
        sourceKode: (r.source_kode as string) ?? null,
        itemNo: (r.item_no as string) ?? null,
        section: (r.section as string) ?? null,
        jenis: r.jenis as string,
        deskripsi: (r.deskripsi as string) ?? null,
        satuan: r.satuan as string,
        ohpPct: Number(r.ohp_pct ?? 0),
        computedRate: Number(r.computed_rate ?? 0),
        usedInProjects: Number(r.used_in_projects ?? 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }),

  /**
   * Clone an AHSP item (global or org-owned source) into a new org-owned item.
   * Copies all ahsp_input, ahsp_koefisien, ahsp_resource rows.
   */
  clone: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      newKode: z.string().min(1).max(32),
      newJenis: z.string().min(1).max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Source must be visible to org (global or org-owned)
      const [src] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!src) throw new TRPCError({ code: 'NOT_FOUND', message: 'Source AHSP item not found' });

      // Ensure new kode not already used in org
      const [dup] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem)
        .where(and(eq(ahspItem.kode, input.newKode), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: `Kode "${input.newKode}" already exists` });

      const [created] = await ctx.db.insert(ahspItem).values({
        organizationId: ctx.session.organizationId,
        kode: input.newKode,
        label: src.label,
        sourceKode: src.sourceKode ?? src.kode,
        itemNo: src.itemNo,
        section: src.section,
        jenis: input.newJenis ?? src.jenis,
        deskripsi: src.deskripsi,
        satuan: src.satuan,
        ohpPct: src.ohpPct,
        metadata: src.metadata,
      }).returning();
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create cloned AHSP item' });
      const newId = created.id;

      const [srcInputs, srcKoef, srcResources] = await Promise.all([
        ctx.db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, src.id)),
        ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, src.id)),
        ctx.db.select().from(ahspResource).where(eq(ahspResource.ahspItemId, src.id)),
      ]);

      if (srcInputs.length) {
        await ctx.db.insert(ahspInput).values(srcInputs.map(i => ({
          ahspItemId: newId,
          ordinal: i.ordinal,
          kode: i.kode,
          variable: i.variable,
          uraian: i.uraian,
          nilai: i.nilai,
          satuan: i.satuan,
          sumber: i.sumber,
        })));
      }
      if (srcKoef.length) {
        await ctx.db.insert(ahspKoefisien).values(srcKoef.map(k => ({
          ahspItemId: newId,
          ordinal: k.ordinal,
          kode: k.kode,
          variable: k.variable,
          uraian: k.uraian,
          nilai: k.nilai,
          satuan: k.satuan,
          formula: k.formula,
        })));
      }
      if (srcResources.length) {
        await ctx.db.insert(ahspResource).values(srcResources.map(r => ({
          ahspItemId: newId,
          category: r.category,
          ordinal: r.ordinal,
          resourceCode: r.resourceCode,
          uraian: r.uraian,
          koefisien: r.koefisien,
          satuan: r.satuan,
          hsd: r.hsd,
        })));
      }

      return { id: newId, kode: created.kode };
    }),

  /**
   * Side-by-side comparison of 2-4 AHSP items.
   * Returns per-item: header, section subtotals (tenaga/bahan/peralatan/ohp/grand),
   * and a flat resource list (kode, category, uraian, koefisien, hsd, subtotal).
   */
  compare: orgProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(2).max(4) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const items = await ctx.db.select().from(ahspItem)
        .where(and(
          inArray(ahspItem.id, input.ids),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, orgId)),
        ));
      if (items.length !== input.ids.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more AHSP items not visible to this org' });
      }
      const allRes = await ctx.db.select().from(ahspResource)
        .where(inArray(ahspResource.ahspItemId, input.ids));

      // Preserve caller's order
      const byId = new Map(items.map(it => [it.id, it]));
      return input.ids.map(id => {
        const item = byId.get(id)!;
        const ohpPct = N(item.ohpPct);
        const myResources = allRes.filter(r => r.ahspItemId === id);
        const totals = computeAhspRate(
          myResources.map(r => ({
            category: r.category as AhspCategory,
            koefisien: N(r.koefisien),
            hsd: N(r.hsd),
          })),
          ohpPct,
        );
        return {
          item: {
            id: item.id,
            kode: item.kode,
            jenis: item.jenis,
            satuan: item.satuan,
            section: item.section,
            organizationId: item.organizationId,
            ohpPct,
          },
          sectionTotals: {
            tenaga: totals.totalTenaga,
            bahan: totals.totalBahan,
            peralatan: totals.totalPeralatan,
            ohp: totals.ohpAmt,
            grand: totals.unitRate,
          },
          resources: myResources.map(r => {
            const koef = N(r.koefisien);
            const hsd = N(r.hsd);
            return {
              kode: r.resourceCode,
              category: r.category as AhspCategory,
              uraian: r.uraian,
              satuan: r.satuan,
              koefisien: koef,
              hsd,
              subtotal: koef * hsd,
            };
          }),
        };
      });
    }),

  /**
   * Aggregate usage statistics across org's AHSP catalog:
   *   - topUsed: top 20 items by distinct project count (org-scoped boq usage)
   *   - neverUsed: count of items with 0 boq references in this org
   *   - byCategory: section -> count
   *   - totalItems / totalCustom / totalGlobal
   */
  usageStats: orgProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;

      // Catalog visible to org with usage counts (project-distinct, org-scoped)
      const usageResult = await ctx.db.execute(sql`
        SELECT
          ai.id,
          ai.kode,
          ai.jenis,
          ai.section,
          ai.organization_id,
          (
            SELECT COUNT(DISTINCT p.id)::int
            FROM boq_item bi JOIN project p ON p.id = bi.project_id
            WHERE bi.ahsp_item_id = ai.id AND p.organization_id = ${orgId}
          ) AS used_in_projects
        FROM ahsp_item ai
        WHERE ai.organization_id IS NULL OR ai.organization_id = ${orgId}
      `);
      const rows = ((usageResult as any).rows ?? usageResult) as any[];

      const topUsed = rows
        .map(r => ({
          id: String(r.id),
          kode: r.kode as string,
          jenis: r.jenis as string,
          section: (r.section as string) ?? null,
          usedInProjects: Number(r.used_in_projects ?? 0),
        }))
        .sort((a, b) => b.usedInProjects - a.usedInProjects)
        .slice(0, 20);

      const neverUsed = rows.filter(r => Number(r.used_in_projects ?? 0) === 0).length;

      const byCategoryMap = new Map<string, number>();
      for (const r of rows) {
        const key = (r.section as string) || '(uncategorized)';
        byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + 1);
      }
      const byCategory = Array.from(byCategoryMap.entries())
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count);

      const totalItems = rows.length;
      const totalCustom = rows.filter(r => r.organization_id != null).length;
      const totalGlobal = totalItems - totalCustom;

      return { topUsed, neverUsed, byCategory, totalItems, totalCustom, totalGlobal };
    }),

  /**
   * Detect quality issues across the org's visible AHSP catalog.
   * Issue types:
   *   - zero_rate (critical):                 computed unit rate = 0
   *   - missing_resources (critical):         AHSP has no ahsp_resource rows
   *   - outlier_hsd (warning):                resource hsd > 5x median for same kode
   *   - missing_koefisien_for_input (warning): ahsp_input variable not in ahsp_koefisien
   *   - orphan_resource_in_master (info):     ahsp_resource.resource_code not in resource_master
   *   - duplicate_kode (info):                same kode appears in multiple items in same org/global
   */
  sanityCheck: orgProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;

      const items = await ctx.db.select().from(ahspItem)
        .where(or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, orgId)));
      const ids = items.map(it => it.id);

      const [allResources, allInputs, allKoef, masters] = await Promise.all([
        ids.length
          ? ctx.db.select().from(ahspResource).where(inArray(ahspResource.ahspItemId, ids))
          : Promise.resolve([] as Array<typeof ahspResource.$inferSelect>),
        ids.length
          ? ctx.db.select().from(ahspInput).where(inArray(ahspInput.ahspItemId, ids))
          : Promise.resolve([] as Array<typeof ahspInput.$inferSelect>),
        ids.length
          ? ctx.db.select().from(ahspKoefisien).where(inArray(ahspKoefisien.ahspItemId, ids))
          : Promise.resolve([] as Array<typeof ahspKoefisien.$inferSelect>),
        ctx.db.select({ kode: resourceMaster.kode }).from(resourceMaster)
          .where(or(isNull(resourceMaster.organizationId), eq(resourceMaster.organizationId, orgId))),
      ]);

      const masterKodes = new Set(masters.map(m => m.kode));

      const resByItem = new Map<string, typeof allResources>();
      for (const r of allResources) {
        const list = resByItem.get(r.ahspItemId) ?? [];
        list.push(r);
        resByItem.set(r.ahspItemId, list);
      }

      // Median HSD per resource_code for outlier detection
      const hsdByCode = new Map<string, number[]>();
      for (const r of allResources) {
        const list = hsdByCode.get(r.resourceCode) ?? [];
        list.push(N(r.hsd));
        hsdByCode.set(r.resourceCode, list);
      }
      const medianByCode = new Map<string, number>();
      for (const [code, vals] of hsdByCode) {
        const sorted = [...vals].filter(v => v > 0).sort((a, b) => a - b);
        if (!sorted.length) continue;
        const mid = Math.floor(sorted.length / 2);
        const med = sorted.length % 2 ? sorted[mid]! : ((sorted[mid - 1]! + sorted[mid]!) / 2);
        medianByCode.set(code, med);
      }

      const inputsByItem = new Map<string, typeof allInputs>();
      for (const i of allInputs) {
        const list = inputsByItem.get(i.ahspItemId) ?? [];
        list.push(i);
        inputsByItem.set(i.ahspItemId, list);
      }
      const koefByItem = new Map<string, typeof allKoef>();
      for (const k of allKoef) {
        const list = koefByItem.get(k.ahspItemId) ?? [];
        list.push(k);
        koefByItem.set(k.ahspItemId, list);
      }

      // Duplicate kode within same scope (per org_id; global treated as its own bucket)
      const scopeKey = (it: typeof items[number]) => `${it.organizationId ?? 'GLOBAL'}::${it.kode}`;
      const kodeBuckets = new Map<string, string[]>();
      for (const it of items) {
        const k = scopeKey(it);
        const list = kodeBuckets.get(k) ?? [];
        list.push(it.id);
        kodeBuckets.set(k, list);
      }

      type Issue = {
        ahspItemId: string;
        kode: string;
        jenis: string;
        issueType: string;
        severity: 'critical' | 'warning' | 'info';
        message: string;
        computedValue?: number;
        expectedRange?: string;
      };
      const issues: Issue[] = [];

      for (const it of items) {
        const myRes = resByItem.get(it.id) ?? [];
        const myInputs = inputsByItem.get(it.id) ?? [];
        const myKoef = koefByItem.get(it.id) ?? [];

        // missing_resources
        if (myRes.length === 0) {
          issues.push({
            ahspItemId: it.id, kode: it.kode, jenis: it.jenis,
            issueType: 'missing_resources', severity: 'critical',
            message: 'AHSP has no resource lines (tenaga/bahan/peralatan).',
          });
        } else {
          // zero_rate (only meaningful when resources exist)
          const totals = computeAhspRate(
            myRes.map(r => ({
              category: r.category as AhspCategory,
              koefisien: N(r.koefisien),
              hsd: N(r.hsd),
            })),
            N(it.ohpPct),
          );
          if (totals.unitRate === 0) {
            issues.push({
              ahspItemId: it.id, kode: it.kode, jenis: it.jenis,
              issueType: 'zero_rate', severity: 'critical',
              message: 'Computed unit rate is 0 (koefisien or hsd missing).',
              computedValue: 0,
            });
          }

          // outlier_hsd per resource line
          for (const r of myRes) {
            const med = medianByCode.get(r.resourceCode);
            const hsd = N(r.hsd);
            if (med && hsd > med * 5 && hsd > 0) {
              issues.push({
                ahspItemId: it.id, kode: it.kode, jenis: it.jenis,
                issueType: 'outlier_hsd', severity: 'warning',
                message: `Resource ${r.resourceCode} HSD ${hsd.toLocaleString()} is >5x median (${med.toLocaleString()}).`,
                computedValue: hsd,
                expectedRange: `~${med.toLocaleString()} (5x = ${(med * 5).toLocaleString()})`,
              });
            }
          }

          // orphan_resource_in_master
          for (const r of myRes) {
            if (!masterKodes.has(r.resourceCode)) {
              issues.push({
                ahspItemId: it.id, kode: it.kode, jenis: it.jenis,
                issueType: 'orphan_resource_in_master', severity: 'info',
                message: `Resource code "${r.resourceCode}" (${r.uraian}) not found in resource_master.`,
              });
            }
          }
        }

        // missing_koefisien_for_input: input variables that aren't reflected in koefisien rows
        if (myInputs.length && myKoef.length) {
          const koefVars = new Set(myKoef.map(k => (k.variable ?? k.kode).toLowerCase()).filter(Boolean));
          for (const i of myInputs) {
            const v = (i.variable ?? '').toLowerCase();
            if (!v) continue;
            if (!koefVars.has(v) && !koefVars.has(i.kode.toLowerCase())) {
              issues.push({
                ahspItemId: it.id, kode: it.kode, jenis: it.jenis,
                issueType: 'missing_koefisien_for_input', severity: 'warning',
                message: `Input variable "${i.variable ?? i.kode}" has no matching koefisien row.`,
              });
            }
          }
        }
      }

      // duplicate_kode
      for (const [key, idList] of kodeBuckets) {
        if (idList.length > 1) {
          const parts = key.split('::');
          const kode = parts[1] ?? '';
          for (const id of idList) {
            const it = items.find(x => x.id === id)!;
            issues.push({
              ahspItemId: id, kode, jenis: it.jenis,
              issueType: 'duplicate_kode', severity: 'info',
              message: `Kode "${kode}" appears in ${idList.length} items within the same scope.`,
            });
          }
        }
      }

      return issues;
    }),
});
