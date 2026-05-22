import { z } from 'zod';
import { and, eq, or, isNull, asc, desc, max, inArray, sql } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { ahspItem, ahspInput, ahspKoefisien, ahspResource, ahspVersion, ahspPin, resourceMaster, user } from '@sitelog/db';
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
    if (T((allRows[i] ?? [])[7]).startsWith('Satuan:')) blockStarts.push(i);
  }
  const items: ParsedAhsp[] = [];
  const seen: Record<string, number> = {};
  for (let idx = 0; idx < blockStarts.length; idx++) {
    const start = blockStarts[idx] ?? 0;
    const end = idx + 1 < blockStarts.length ? (blockStarts[idx + 1] ?? allRows.length) : allRows.length;
    const header = allRows[start] ?? [];
    const b = T(header[1]);
    const c = T(header[2]);
    const h = T(header[7]);
    const m = h.match(SATUAN_RE);
    const satuan = m ? (m[1] ?? '').trim() : '';
    let kode = colBToKode(b);
    const seenCount = seen[kode] ?? 0;
    if (seenCount) { seen[kode] = seenCount + 1; kode = `${kode}-v${seenCount + 1}`; } else { seen[kode] = 1; }
    const { label, jenis } = deriveLabel(b, c);
    const item: ParsedAhsp = { kode, sourceKode: b, label, jenis, satuan, ohpPct: 0, inputs: [], koefisien: [], resources: [] };

    let section: 'input' | 'koef' | 'analisa' | null = null;
    let analisaCat: 'tenaga' | 'bahan' | 'peralatan' | null = null;
    let inResTable = false;
    let ordIn = 0, ordK = 0;
    const ordR = { tenaga: 0, bahan: 0, peralatan: 0 };

    for (let r = start + 1; r < end; r++) {
      const row = allRows[r] ?? [];
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
          ai.archived_at,
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
        archivedAt: r.archived_at ?? null,
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

  /**
   * Bulk-import AHSP catalog from a xlsx workbook with sheets COVER/INPUT/PARAMETER/CALCULATION
   * (same structure as D:/FORM/AHSP_NEW_4.xlsx). Owner/admin only.
   *   - PARAMETER -> upserts resource_master entries in the selected scope.
   *   - CALCULATION -> walks AHSP blocks. Each block is identified by a "Satuan:" cell in column I.
   *     For each block: upsert ahsp_item by (org_id, kode), then DELETE+INSERT inputs/koef/resources.
   * dryRun=true: parse + validate only, no writes.
   * orgScope=true: import as org-scoped. false: import as global (organizationId=null) — owner role required.
   */
  importFromXlsxBase64: requireRole('owner', 'admin')
    .input(z.object({
      xlsxBase64: z.string().min(1),
      orgScope: z.boolean().default(true),
      dryRun: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Global imports are reserved for the most senior role (no super_admin role exists today)
      if (!input.orgScope && ctx.session.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Global imports require owner role.' });
      }

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const buf = Buffer.from(input.xlsxBase64, 'base64');
      try {
        await wb.xlsx.load(buf as any);
      } catch (e: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid xlsx: ${e?.message ?? e}` });
      }
      const paramWs = wb.getWorksheet('PARAMETER');
      const calcWs = wb.getWorksheet('CALCULATION');
      if (!paramWs || !calcWs) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workbook must contain PARAMETER and CALCULATION sheets.' });
      }

      const errors: string[] = [];
      let resources: ParsedResource[] = [];
      let items: ParsedAhsp[] = [];
      try { resources = parseParameterSheet(paramWs); } catch (e: any) { errors.push(`PARAMETER parse: ${e?.message ?? e}`); }
      try { items = parseCalculationSheet(calcWs); } catch (e: any) { errors.push(`CALCULATION parse: ${e?.message ?? e}`); }

      for (const it of items) {
        if (!it.kode) errors.push(`AHSP missing kode: ${it.sourceKode}`);
        if (!it.satuan) errors.push(`AHSP "${it.kode}" missing satuan`);
      }

      if (input.dryRun) {
        return { dryRun: true, resourcesImported: resources.length, itemsImported: items.length, errors };
      }
      if (errors.length && items.length === 0) {
        return { dryRun: false, resourcesImported: 0, itemsImported: 0, errors };
      }

      const targetOrgId: string | null = input.orgScope ? ctx.session.organizationId : null;
      let resourcesImported = 0;
      let itemsImported = 0;

      await ctx.db.transaction(async (tx) => {
        // 1) Upsert resource_master entries — emulated upsert by (organization_id, kode) since
        //    no unique constraint is guaranteed at the schema level.
        for (const r of resources) {
          const where = targetOrgId === null
            ? and(isNull(resourceMaster.organizationId), eq(resourceMaster.kode, r.kode))
            : and(eq(resourceMaster.organizationId, targetOrgId), eq(resourceMaster.kode, r.kode));
          const existing = await tx.select({ id: resourceMaster.id }).from(resourceMaster).where(where!).limit(1);
          if (existing.length) {
            await tx.update(resourceMaster).set({
              nama: r.nama, category: r.category, satuan: r.satuan,
              defaultHsd: String(r.hsd), notes: r.catatan || null,
              updatedAt: new Date(),
            }).where(eq(resourceMaster.id, existing[0]!.id));
          } else {
            await tx.insert(resourceMaster).values({
              organizationId: targetOrgId,
              kode: r.kode, nama: r.nama, category: r.category, satuan: r.satuan,
              defaultHsd: String(r.hsd), notes: r.catatan || null,
            });
          }
          resourcesImported++;
        }

        // 2) Upsert each ahsp_item; replace its inputs/koefisien/resources atomically.
        for (const it of items) {
          if (!it.kode || !it.satuan) continue;
          const where = targetOrgId === null
            ? and(isNull(ahspItem.organizationId), eq(ahspItem.kode, it.kode))
            : and(eq(ahspItem.organizationId, targetOrgId), eq(ahspItem.kode, it.kode));
          const existing = await tx.select({ id: ahspItem.id }).from(ahspItem).where(where!).limit(1);
          let ahspId: string;
          if (existing.length) {
            ahspId = existing[0]!.id;
            await tx.update(ahspItem).set({
              label: it.label, sourceKode: it.sourceKode,
              jenis: it.jenis, satuan: it.satuan,
              ohpPct: String(it.ohpPct), updatedAt: new Date(),
            }).where(eq(ahspItem.id, ahspId));
          } else {
            const [row] = await tx.insert(ahspItem).values({
              organizationId: targetOrgId,
              kode: it.kode, label: it.label, sourceKode: it.sourceKode,
              jenis: it.jenis, satuan: it.satuan, ohpPct: String(it.ohpPct),
            }).returning();
            ahspId = row!.id;
          }

          await tx.delete(ahspInput).where(eq(ahspInput.ahspItemId, ahspId));
          await tx.delete(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, ahspId));
          await tx.delete(ahspResource).where(eq(ahspResource.ahspItemId, ahspId));

          if (it.inputs.length) {
            await tx.insert(ahspInput).values(it.inputs.map(i => ({
              ahspItemId: ahspId, ordinal: i.ordinal, kode: i.kode,
              variable: i.variable, uraian: i.uraian,
              nilai: i.nilai === null ? null : String(i.nilai),
              satuan: i.satuan || null, sumber: i.sumber || null,
            })));
          }
          if (it.koefisien.length) {
            await tx.insert(ahspKoefisien).values(it.koefisien.map(k => ({
              ahspItemId: ahspId, ordinal: k.ordinal, kode: k.kode,
              variable: k.variable, uraian: k.uraian || null,
              nilai: k.nilai === null ? null : String(k.nilai),
              satuan: k.satuan || null, formula: k.formula || null,
            })));
          }
          if (it.resources.length) {
            await tx.insert(ahspResource).values(it.resources.map(r => ({
              ahspItemId: ahspId, category: r.category, ordinal: r.ordinal,
              resourceCode: r.resourceCode, uraian: r.uraian,
              koefisien: String(r.koefisien),
              satuan: r.satuan || null, hsd: String(r.hsd),
            })));
          }
          itemsImported++;
        }
      });

      return { dryRun: false, resourcesImported, itemsImported, errors };
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Versioned editing — every mutation snapshots to ahsp_version log.
  // All require org-owned target (assertEditable). Roles: owner/admin/estimator.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update item header (jenis/deskripsi/satuan/ohpPct). Snapshots after change.
   */
  updateMeta: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      jenis: z.string().min(1).optional(),
      deskripsi: z.string().optional(),
      satuan: z.string().min(1).optional(),
      ohpPct: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.db, input.id, ctx.session.organizationId);
      const sets: any = { updatedAt: new Date() };
      if (input.jenis !== undefined) sets.jenis = input.jenis;
      if (input.deskripsi !== undefined) sets.deskripsi = input.deskripsi;
      if (input.satuan !== undefined) sets.satuan = input.satuan;
      if (input.ohpPct !== undefined) sets.ohpPct = String(input.ohpPct);
      const [row] = await ctx.db.update(ahspItem).set(sets)
        .where(and(eq(ahspItem.id, input.id), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .returning();
      await snapshotAhsp(ctx.db, input.id, ctx.session.user.id, `update meta`);
      return row;
    }),

  addResource: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      category: z.enum(['tenaga', 'bahan', 'peralatan']),
      kode: z.string().min(1),
      uraian: z.string().min(1),
      koefisien: z.number(),
      hsd: z.number().optional(),
      satuan: z.string().optional(),
      resourceMasterId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.db, input.ahspItemId, ctx.session.organizationId);
      // Default HSD/satuan from master if linked and caller didn't supply them.
      let hsd = input.hsd;
      let satuan = input.satuan;
      if (input.resourceMasterId && (hsd === undefined || satuan === undefined)) {
        const [m] = await ctx.db.select().from(resourceMaster)
          .where(eq(resourceMaster.id, input.resourceMasterId)).limit(1);
        if (m) {
          if (hsd === undefined) hsd = N(m.defaultHsd);
          if (satuan === undefined) satuan = m.satuan;
        }
      }
      const [maxOrd] = await ctx.db.select({ m: max(ahspResource.ordinal) }).from(ahspResource)
        .where(and(eq(ahspResource.ahspItemId, input.ahspItemId), eq(ahspResource.category, input.category)));
      const ordinal = (maxOrd?.m ?? -1) + 1;
      const [row] = await ctx.db.insert(ahspResource).values({
        ahspItemId: input.ahspItemId,
        category: input.category,
        ordinal,
        resourceCode: input.kode,
        uraian: input.uraian,
        koefisien: String(input.koefisien),
        satuan,
        hsd: String(hsd ?? 0),
      }).returning();
      await snapshotAhsp(ctx.db, input.ahspItemId, ctx.session.user.id, `add resource ${input.category}/${input.kode}`);
      return row;
    }),

  updateResource: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      koefisien: z.number().optional(),
      hsd: z.number().optional(),
      uraian: z.string().optional(),
      satuan: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspResource).where(eq(ahspResource.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      const sets: any = {};
      if (input.koefisien !== undefined) sets.koefisien = String(input.koefisien);
      if (input.hsd !== undefined) sets.hsd = String(input.hsd);
      if (input.uraian !== undefined) sets.uraian = input.uraian;
      if (input.satuan !== undefined) sets.satuan = input.satuan;
      const [row] = await ctx.db.update(ahspResource).set(sets).where(eq(ahspResource.id, input.id)).returning();
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `update resource ${existing.resourceCode}`);
      return row;
    }),

  deleteResource: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspResource).where(eq(ahspResource.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      await ctx.db.delete(ahspResource).where(eq(ahspResource.id, input.id));
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `delete resource ${existing.resourceCode}`);
      return { ok: true };
    }),

  addInput: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      kode: z.string().min(1),
      variable: z.string().optional(),
      uraian: z.string().min(1),
      nilai: z.number().optional(),
      satuan: z.string().optional(),
      sumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.db, input.ahspItemId, ctx.session.organizationId);
      const [maxOrd] = await ctx.db.select({ m: max(ahspInput.ordinal) }).from(ahspInput)
        .where(eq(ahspInput.ahspItemId, input.ahspItemId));
      const ordinal = (maxOrd?.m ?? -1) + 1;
      const [row] = await ctx.db.insert(ahspInput).values({
        ahspItemId: input.ahspItemId,
        ordinal,
        kode: input.kode,
        variable: input.variable,
        uraian: input.uraian,
        nilai: input.nilai !== undefined ? String(input.nilai) : null,
        satuan: input.satuan,
        sumber: input.sumber,
      }).returning();
      await snapshotAhsp(ctx.db, input.ahspItemId, ctx.session.user.id, `add input ${input.kode}`);
      return row;
    }),

  updateInput: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      kode: z.string().optional(),
      variable: z.string().optional(),
      uraian: z.string().optional(),
      nilai: z.number().nullable().optional(),
      satuan: z.string().optional(),
      sumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspInput).where(eq(ahspInput.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      const sets: any = {};
      if (input.kode !== undefined) sets.kode = input.kode;
      if (input.variable !== undefined) sets.variable = input.variable;
      if (input.uraian !== undefined) sets.uraian = input.uraian;
      if (input.nilai !== undefined) sets.nilai = input.nilai === null ? null : String(input.nilai);
      if (input.satuan !== undefined) sets.satuan = input.satuan;
      if (input.sumber !== undefined) sets.sumber = input.sumber;
      const [row] = await ctx.db.update(ahspInput).set(sets).where(eq(ahspInput.id, input.id)).returning();
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `update input ${existing.kode}`);
      return row;
    }),

  deleteInput: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspInput).where(eq(ahspInput.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      await ctx.db.delete(ahspInput).where(eq(ahspInput.id, input.id));
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `delete input ${existing.kode}`);
      return { ok: true };
    }),

  addKoefisien: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      kode: z.string().min(1),
      variable: z.string().optional(),
      uraian: z.string().optional(),
      nilai: z.number().optional(),
      satuan: z.string().optional(),
      formula: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEditable(ctx.db, input.ahspItemId, ctx.session.organizationId);
      const [maxOrd] = await ctx.db.select({ m: max(ahspKoefisien.ordinal) }).from(ahspKoefisien)
        .where(eq(ahspKoefisien.ahspItemId, input.ahspItemId));
      const ordinal = (maxOrd?.m ?? -1) + 1;
      const [row] = await ctx.db.insert(ahspKoefisien).values({
        ahspItemId: input.ahspItemId,
        ordinal,
        kode: input.kode,
        variable: input.variable,
        uraian: input.uraian,
        nilai: input.nilai !== undefined ? String(input.nilai) : null,
        satuan: input.satuan,
        formula: input.formula,
      }).returning();
      await snapshotAhsp(ctx.db, input.ahspItemId, ctx.session.user.id, `add koefisien ${input.kode}`);
      return row;
    }),

  updateKoefisien: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      kode: z.string().optional(),
      variable: z.string().optional(),
      uraian: z.string().optional(),
      nilai: z.number().nullable().optional(),
      satuan: z.string().optional(),
      formula: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      const sets: any = {};
      if (input.kode !== undefined) sets.kode = input.kode;
      if (input.variable !== undefined) sets.variable = input.variable;
      if (input.uraian !== undefined) sets.uraian = input.uraian;
      if (input.nilai !== undefined) sets.nilai = input.nilai === null ? null : String(input.nilai);
      if (input.satuan !== undefined) sets.satuan = input.satuan;
      if (input.formula !== undefined) sets.formula = input.formula;
      const [row] = await ctx.db.update(ahspKoefisien).set(sets).where(eq(ahspKoefisien.id, input.id)).returning();
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `update koefisien ${existing.kode}`);
      return row;
    }),

  deleteKoefisien: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, existing.ahspItemId, ctx.session.organizationId);
      await ctx.db.delete(ahspKoefisien).where(eq(ahspKoefisien.id, input.id));
      await snapshotAhsp(ctx.db, existing.ahspItemId, ctx.session.user.id, `delete koefisien ${existing.kode}`);
      return { ok: true };
    }),

  /**
   * Version history (newest first) joined with editor name/email for display.
   */
  versions: orgProcedure
    .input(z.object({ ahspItemId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      const rows = await ctx.db.select({
        id: ahspVersion.id,
        versionNumber: ahspVersion.versionNumber,
        changeSummary: ahspVersion.changeSummary,
        createdAt: ahspVersion.createdAt,
        changedById: ahspVersion.changedById,
        changedByName: user.name,
        changedByEmail: user.email,
      })
        .from(ahspVersion)
        .leftJoin(user, eq(user.id, ahspVersion.changedById))
        .where(eq(ahspVersion.ahspItemId, input.ahspItemId))
        .orderBy(desc(ahspVersion.versionNumber))
        .limit(input.limit);
      return rows;
    }),

  /**
   * Restore a past version: snapshot the BEFORE-state first (reversible), then wipe + replay
   * snapshot contents back into ahsp_input / ahsp_koefisien / ahsp_resource and overwrite item
   * header fields (preserving id + organizationId). Owner/admin only.
   */
  restoreVersion: requireRole('owner', 'admin')
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [ver] = await ctx.db.select().from(ahspVersion).where(eq(ahspVersion.id, input.versionId)).limit(1);
      if (!ver) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertEditable(ctx.db, ver.ahspItemId, ctx.session.organizationId);

      await snapshotAhsp(ctx.db, ver.ahspItemId, ctx.session.user.id, `pre-restore (→ v${ver.versionNumber})`);

      const snap = ver.snapshot as any;
      if (snap.item) {
        const it = snap.item;
        await ctx.db.update(ahspItem).set({
          kode: it.kode,
          label: it.label ?? null,
          section: it.section ?? null,
          jenis: it.jenis,
          deskripsi: it.deskripsi ?? null,
          satuan: it.satuan,
          ohpPct: String(it.ohpPct ?? 0),
          metadata: it.metadata ?? null,
          updatedAt: new Date(),
        }).where(eq(ahspItem.id, ver.ahspItemId));
      }
      await ctx.db.delete(ahspInput).where(eq(ahspInput.ahspItemId, ver.ahspItemId));
      await ctx.db.delete(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, ver.ahspItemId));
      await ctx.db.delete(ahspResource).where(eq(ahspResource.ahspItemId, ver.ahspItemId));
      if (snap.inputs?.length) {
        await ctx.db.insert(ahspInput).values(snap.inputs.map((i: any) => ({
          ahspItemId: ver.ahspItemId,
          ordinal: i.ordinal,
          kode: i.kode,
          variable: i.variable ?? null,
          uraian: i.uraian,
          nilai: i.nilai !== null && i.nilai !== undefined ? String(i.nilai) : null,
          satuan: i.satuan ?? null,
          sumber: i.sumber ?? null,
        })));
      }
      if (snap.koefisien?.length) {
        await ctx.db.insert(ahspKoefisien).values(snap.koefisien.map((k: any) => ({
          ahspItemId: ver.ahspItemId,
          ordinal: k.ordinal,
          kode: k.kode,
          variable: k.variable ?? null,
          uraian: k.uraian ?? null,
          nilai: k.nilai !== null && k.nilai !== undefined ? String(k.nilai) : null,
          satuan: k.satuan ?? null,
          formula: k.formula ?? null,
        })));
      }
      if (snap.resources?.length) {
        await ctx.db.insert(ahspResource).values(snap.resources.map((r: any) => ({
          ahspItemId: ver.ahspItemId,
          category: r.category,
          ordinal: r.ordinal,
          resourceCode: r.resourceCode,
          uraian: r.uraian,
          koefisien: String(r.koefisien),
          satuan: r.satuan ?? null,
          hsd: String(r.hsd),
        })));
      }
      await snapshotAhsp(ctx.db, ver.ahspItemId, ctx.session.user.id, `restored from v${ver.versionNumber}`);
      return { ok: true, restoredFrom: ver.versionNumber };
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Quick inline rename + bulk archive + pins (catalog page UX)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inline-rename the `jenis` field of an org-owned AHSP item. Global items (org NULL) are
   * read-only here — owner role is required to override. Snapshots after change.
   */
  quickRenameJenis: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      newJenis: z.string().min(3).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem).where(eq(ahspItem.id, input.id)).limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      if (item.organizationId === null) {
        if (ctx.session.role !== 'owner') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Global AHSP rename requires owner role.' });
        }
      } else if (item.organizationId !== ctx.session.organizationId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Item belongs to another organization.' });
      }
      const [row] = await ctx.db.update(ahspItem)
        .set({ jenis: input.newJenis, updatedAt: new Date() })
        .where(eq(ahspItem.id, input.id))
        .returning();
      await snapshotAhsp(ctx.db, input.id, ctx.session.user.id, `rename jenis`);
      return row;
    }),

  /**
   * Soft-archive a batch of org-owned AHSP items (sets archived_at = now()).
   * Global items in the list are silently skipped.
   */
  bulkArchive: requireRole('owner', 'admin')
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.update(ahspItem)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(
          inArray(ahspItem.id, input.ids),
          eq(ahspItem.organizationId, ctx.session.organizationId),
        ))
        .returning();
      return { archived: result.length };
    }),

  /**
   * Un-archive: NULL archived_at for the given org-owned items.
   */
  bulkUnarchive: requireRole('owner', 'admin')
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.update(ahspItem)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(and(
          inArray(ahspItem.id, input.ids),
          eq(ahspItem.organizationId, ctx.session.organizationId),
        ))
        .returning();
      return { unarchived: result.length };
    }),

  /**
   * Toggle a per-user pin on an AHSP item. Insert if missing, delete if present.
   * Pin scope is the user; visibility is the org (item must be visible to org).
   */
  togglePin: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.id),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      const userId = ctx.session.user.id;
      const [existing] = await ctx.db.select().from(ahspPin)
        .where(and(eq(ahspPin.userId, userId), eq(ahspPin.ahspItemId, input.id)))
        .limit(1);
      if (existing) {
        await ctx.db.delete(ahspPin)
          .where(and(eq(ahspPin.userId, userId), eq(ahspPin.ahspItemId, input.id)));
        return { pinned: false };
      }
      await ctx.db.insert(ahspPin).values({ userId, ahspItemId: input.id });
      return { pinned: true };
    }),

  /**
   * Returns the set of ahsp_item_id values pinned by the current user (org-scoped visibility).
   */
  myPins: orgProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db.select({ ahspItemId: ahspPin.ahspItemId })
        .from(ahspPin)
        .where(eq(ahspPin.userId, ctx.session.user.id));
      return rows.map(r => r.ahspItemId);
    }),

  /**
   * Find duplicate AHSP items grouped by case-insensitive (jenis, satuan).
   * Returns 2+ matching items per group with computed unit rate and project-usage count
   * so the user can pick a canonical row to keep before merging.
   */
  findDuplicates: orgProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;
      const result = await ctx.db.execute(sql`
        WITH visible AS (
          SELECT ai.id, ai.kode, ai.jenis, ai.satuan, ai.ohp_pct,
                 TRIM(LOWER(ai.jenis))  AS jkey,
                 TRIM(LOWER(ai.satuan)) AS skey
          FROM ahsp_item ai
          WHERE (ai.organization_id IS NULL OR ai.organization_id = ${orgId})
            AND ai.jenis IS NOT NULL AND TRIM(ai.jenis) <> ''
            AND ai.satuan IS NOT NULL AND TRIM(ai.satuan) <> ''
        ),
        dup_keys AS (
          SELECT jkey, skey FROM visible
          GROUP BY jkey, skey HAVING COUNT(*) > 1
        )
        SELECT v.id, v.kode, v.jenis, v.satuan, v.jkey, v.skey,
          COALESCE((
            SELECT SUM(ar.koefisien::float8 * ar.hsd::float8)
            FROM ahsp_resource ar WHERE ar.ahsp_item_id = v.id
          ), 0) * (1 + COALESCE(v.ohp_pct, 0)::float8 / 100) AS computed_rate,
          (
            SELECT COUNT(DISTINCT p.id)::int
            FROM boq_item bi JOIN project p ON p.id = bi.project_id
            WHERE bi.ahsp_item_id = v.id AND p.organization_id = ${orgId}
          ) AS used_in_projects
        FROM visible v
        JOIN dup_keys d ON d.jkey = v.jkey AND d.skey = v.skey
        ORDER BY v.jkey, v.skey, used_in_projects DESC, computed_rate DESC
      `);
      const rows = ((result as any).rows ?? result) as any[];

      const groups = new Map<string, {
        jenis: string;
        satuan: string;
        items: Array<{ id: string; kode: string; computedRate: number; usedInProjects: number }>;
      }>();
      for (const r of rows) {
        const key = `${r.jkey}\x1f${r.skey}`;
        const g = groups.get(key) ?? {
          jenis: r.jenis as string,
          satuan: r.satuan as string,
          items: [],
        };
        g.items.push({
          id: String(r.id),
          kode: r.kode as string,
          computedRate: Number(r.computed_rate ?? 0),
          usedInProjects: Number(r.used_in_projects ?? 0),
        });
        groups.set(key, g);
      }
      return Array.from(groups.values());
    }),

  /**
   * Merge duplicate AHSP items into one canonical row.
   *   1. Reroutes every boq_item.ahsp_item_id reference from removeIds -> keepId.
   *   2. Deletes the removed ahsp_item rows (CASCADE drops their inputs/koefisien/resources).
   *   3. Snapshots the keep-item with a summary of merged codes for the audit trail.
   * Owner/admin only.
   */
  mergeItems: requireRole('owner', 'admin')
    .input(z.object({
      keepId: z.string().uuid(),
      removeIds: z.array(z.string().uuid()).min(1),
      reason: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      if (input.removeIds.includes(input.keepId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'keepId cannot also appear in removeIds' });
      }

      // All ids (keep + removed) must be org-owned editable items
      const all = await ctx.db.select().from(ahspItem)
        .where(and(
          inArray(ahspItem.id, [input.keepId, ...input.removeIds]),
          eq(ahspItem.organizationId, orgId),
        ));
      if (all.length !== input.removeIds.length + 1) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'All items must be org-owned (global catalog items cannot be merged).',
        });
      }
      const removedKodes = all
        .filter(i => input.removeIds.includes(i.id))
        .map(i => i.kode);

      let merged = 0;
      let projectsAffected = 0;
      await ctx.db.transaction(async (tx) => {
        // Count distinct projects that referenced any of the removed items (before reroute)
        const projRes = await tx.execute(sql`
          SELECT COUNT(DISTINCT bi.project_id)::int AS n
          FROM boq_item bi
          WHERE bi.ahsp_item_id IN ${sql.raw(`('${input.removeIds.join("','")}')`)}
        `);
        const projRow = ((projRes as any).rows ?? projRes)[0];
        projectsAffected = Number(projRow?.n ?? 0);

        // Reroute boq_item references. boq_item has UNIQUE(project_id, ahsp_item_id), so
        // collisions (a project already references keepId) must be resolved by deleting the
        // duplicate boq line that points to the removed id.
        for (const removeId of input.removeIds) {
          await tx.execute(sql`
            DELETE FROM boq_item
            WHERE ahsp_item_id = ${removeId}
              AND project_id IN (
                SELECT project_id FROM boq_item WHERE ahsp_item_id = ${input.keepId}
              )
          `);
          await tx.execute(sql`
            UPDATE boq_item SET ahsp_item_id = ${input.keepId}
            WHERE ahsp_item_id = ${removeId}
          `);
        }

        // Delete removed ahsp_item rows; CASCADE cleans up children.
        await tx.delete(ahspItem)
          .where(and(
            inArray(ahspItem.id, input.removeIds),
            eq(ahspItem.organizationId, orgId),
          ));
        merged = input.removeIds.length;
      });

      const summary = `merged ${merged} kode(s): ${removedKodes.join(', ')}`
        + (input.reason ? ` — ${input.reason}` : '');
      await snapshotAhsp(ctx.db, input.keepId, ctx.session.user.id, summary);

      return { merged, projectsAffected };
    }),

  // ===== AGENT V =====
  // AGENT V additions: auto-merge all duplicates, auto-archive zero-rate items,
  // and clone-global-as-org-custom with optional resource auto-match.

  /**
   * Auto-merge every duplicate group reported by findDuplicates. For each group, pick the
   * canonical item heuristically:
   *   1. Most projects-used
   *   2. Tiebreaker: lowest computed rate (assumed more conservative/accurate)
   *   3. Tiebreaker: oldest created_at
   * Then route all boq_item references to the canonical id and delete the rest.
   * Owner/admin only. Skips groups that contain any non-org-owned (global) items —
   * those can't be merged via mergeItems guard.
   */
  autoMergeAllDuplicates: requireRole('owner', 'admin')
    .mutation(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;

      // Org-owned duplicate groups only (global items can't be merged).
      const result = await ctx.db.execute(sql`
        WITH visible AS (
          SELECT ai.id, ai.kode, ai.jenis, ai.satuan, ai.ohp_pct, ai.created_at,
                 TRIM(LOWER(ai.jenis))  AS jkey,
                 TRIM(LOWER(ai.satuan)) AS skey
          FROM ahsp_item ai
          WHERE ai.organization_id = ${orgId}
            AND ai.jenis IS NOT NULL AND TRIM(ai.jenis) <> ''
            AND ai.satuan IS NOT NULL AND TRIM(ai.satuan) <> ''
        ),
        dup_keys AS (
          SELECT jkey, skey FROM visible
          GROUP BY jkey, skey HAVING COUNT(*) > 1
        )
        SELECT v.id, v.kode, v.created_at, v.jkey, v.skey,
          COALESCE((
            SELECT SUM(ar.koefisien::float8 * ar.hsd::float8)
            FROM ahsp_resource ar WHERE ar.ahsp_item_id = v.id
          ), 0) * (1 + COALESCE(v.ohp_pct, 0)::float8 / 100) AS computed_rate,
          (
            SELECT COUNT(DISTINCT p.id)::int
            FROM boq_item bi JOIN project p ON p.id = bi.project_id
            WHERE bi.ahsp_item_id = v.id AND p.organization_id = ${orgId}
          ) AS used_in_projects
        FROM visible v
        JOIN dup_keys d ON d.jkey = v.jkey AND d.skey = v.skey
      `);
      const rows = ((result as any).rows ?? result) as any[];

      type Cand = { id: string; kode: string; createdAt: any; computedRate: number; usedInProjects: number };
      const groups = new Map<string, Cand[]>();
      for (const r of rows) {
        const key = `${r.jkey}\x1f${r.skey}`;
        const list = groups.get(key) ?? [];
        list.push({
          id: String(r.id),
          kode: r.kode as string,
          createdAt: r.created_at,
          computedRate: Number(r.computed_rate ?? 0),
          usedInProjects: Number(r.used_in_projects ?? 0),
        });
        groups.set(key, list);
      }

      let groupsMerged = 0;
      let itemsRemoved = 0;
      let projectsAffected = 0;

      for (const [, items] of groups) {
        if (items.length < 2) continue;
        // Sort by: most used DESC, then lowest rate ASC, then oldest createdAt ASC
        const sorted = [...items].sort((a, b) => {
          if (b.usedInProjects !== a.usedInProjects) return b.usedInProjects - a.usedInProjects;
          if (a.computedRate !== b.computedRate) return a.computedRate - b.computedRate;
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ta - tb;
        });
        const keep = sorted[0]!;
        const removeIds = sorted.slice(1).map(x => x.id);
        if (!removeIds.length) continue;
        const removedKodes = sorted.slice(1).map(x => x.kode);

        await ctx.db.transaction(async (tx) => {
          const projRes = await tx.execute(sql`
            SELECT COUNT(DISTINCT bi.project_id)::int AS n
            FROM boq_item bi
            WHERE bi.ahsp_item_id IN ${sql.raw(`('${removeIds.join("','")}')`)}
          `);
          const projRow = ((projRes as any).rows ?? projRes)[0];
          projectsAffected += Number(projRow?.n ?? 0);

          for (const removeId of removeIds) {
            await tx.execute(sql`
              DELETE FROM boq_item
              WHERE ahsp_item_id = ${removeId}
                AND project_id IN (
                  SELECT project_id FROM boq_item WHERE ahsp_item_id = ${keep.id}
                )
            `);
            await tx.execute(sql`
              UPDATE boq_item SET ahsp_item_id = ${keep.id}
              WHERE ahsp_item_id = ${removeId}
            `);
          }
          await tx.delete(ahspItem)
            .where(and(inArray(ahspItem.id, removeIds), eq(ahspItem.organizationId, orgId)));
        });

        await snapshotAhsp(
          ctx.db, keep.id, ctx.session.user.id,
          `auto-merge: kept ${keep.kode}, removed ${removedKodes.join(', ')}`,
        );

        groupsMerged++;
        itemsRemoved += removeIds.length;
      }

      return { groupsMerged, itemsRemoved, projectsAffected };
    }),

  /**
   * Auto-archive every org-owned AHSP item whose computed unit rate is 0
   * (resources exist but koefisien/hsd produce 0, or no resources at all).
   * Skips items already linked to a boq_item (safe-by-default — won't break live BoQs).
   * Owner/admin only.
   */
  autoArchiveZeroRate: requireRole('owner', 'admin')
    .mutation(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;
      const result = await ctx.db.execute(sql`
        SELECT ai.id
        FROM ahsp_item ai
        WHERE ai.organization_id = ${orgId}
          AND ai.archived_at IS NULL
          AND COALESCE((
            SELECT SUM(ar.koefisien::float8 * ar.hsd::float8)
            FROM ahsp_resource ar WHERE ar.ahsp_item_id = ai.id
          ), 0) * (1 + COALESCE(ai.ohp_pct, 0)::float8 / 100) = 0
          AND NOT EXISTS (
            SELECT 1 FROM boq_item bi WHERE bi.ahsp_item_id = ai.id
          )
      `);
      const rows = ((result as any).rows ?? result) as any[];
      const ids = rows.map(r => String(r.id));
      if (!ids.length) return { archived: 0 };

      const updated = await ctx.db.update(ahspItem)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(
          inArray(ahspItem.id, ids),
          eq(ahspItem.organizationId, orgId),
        ))
        .returning();
      return { archived: updated.length };
    }),

  /**
   * Mark a global AHSP item as a customized org-scoped copy. Optionally auto-populate
   * resource lines by keyword-matching the item's jenis against resource_master.nama.
   * Returns the new org-scoped item id and how many resource rows were added.
   * Owner/admin only.
   */
  markGlobalAsCustomAndFix: requireRole('owner', 'admin')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      autoMatchResources: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const [src] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, orgId)),
        ))
        .limit(1);
      if (!src) throw new TRPCError({ code: 'NOT_FOUND', message: 'AHSP item not visible' });

      // Pick a unique kode in org scope
      let newKode = src.kode;
      const [dup] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem)
        .where(and(eq(ahspItem.kode, newKode), eq(ahspItem.organizationId, orgId)))
        .limit(1);
      if (dup) newKode = `${src.kode}-ORG`;
      let suffix = 2;
      while (true) {
        const [d] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem)
          .where(and(eq(ahspItem.kode, newKode), eq(ahspItem.organizationId, orgId)))
          .limit(1);
        if (!d) break;
        newKode = `${src.kode}-ORG${suffix++}`;
        if (suffix > 50) throw new TRPCError({ code: 'CONFLICT', message: 'Could not find unique kode' });
      }

      const [created] = await ctx.db.insert(ahspItem).values({
        organizationId: orgId,
        kode: newKode,
        label: src.label,
        sourceKode: src.sourceKode ?? src.kode,
        itemNo: src.itemNo,
        section: src.section,
        jenis: src.jenis,
        deskripsi: src.deskripsi,
        satuan: src.satuan,
        ohpPct: src.ohpPct,
        metadata: src.metadata,
      }).returning();
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const newId = created.id;

      // Always copy structure (inputs/koefisien/resources) from source.
      const [srcInputs, srcKoef, srcResources] = await Promise.all([
        ctx.db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, src.id)),
        ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, src.id)),
        ctx.db.select().from(ahspResource).where(eq(ahspResource.ahspItemId, src.id)),
      ]);
      if (srcInputs.length) {
        await ctx.db.insert(ahspInput).values(srcInputs.map(i => ({
          ahspItemId: newId, ordinal: i.ordinal, kode: i.kode,
          variable: i.variable, uraian: i.uraian, nilai: i.nilai,
          satuan: i.satuan, sumber: i.sumber,
        })));
      }
      if (srcKoef.length) {
        await ctx.db.insert(ahspKoefisien).values(srcKoef.map(k => ({
          ahspItemId: newId, ordinal: k.ordinal, kode: k.kode,
          variable: k.variable, uraian: k.uraian, nilai: k.nilai,
          satuan: k.satuan, formula: k.formula,
        })));
      }
      if (srcResources.length) {
        await ctx.db.insert(ahspResource).values(srcResources.map(r => ({
          ahspItemId: newId, category: r.category, ordinal: r.ordinal,
          resourceCode: r.resourceCode, uraian: r.uraian,
          koefisien: r.koefisien, satuan: r.satuan, hsd: r.hsd,
        })));
      }

      let resourcesAdded = srcResources.length;

      // Optionally try to fill missing resources by keyword-matching jenis against master.
      if (input.autoMatchResources && srcResources.length === 0) {
        const keywords = (src.jenis ?? '')
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(w => w.length >= 4);
        if (keywords.length) {
          const masters = await ctx.db.select().from(resourceMaster)
            .where(or(isNull(resourceMaster.organizationId), eq(resourceMaster.organizationId, orgId)));
          const matches = masters.filter(m => {
            const nm = (m.nama ?? '').toLowerCase();
            return keywords.some(k => nm.includes(k));
          }).slice(0, 10);
          if (matches.length) {
            const ordByCat: Record<string, number> = { tenaga: 0, bahan: 0, peralatan: 0 };
            await ctx.db.insert(ahspResource).values(matches.map(m => {
              const cat = (m.category as string) ?? 'bahan';
              ordByCat[cat] = (ordByCat[cat] ?? 0) + 1;
              return {
                ahspItemId: newId,
                category: cat as 'tenaga' | 'bahan' | 'peralatan',
                ordinal: ordByCat[cat]!,
                resourceCode: m.kode,
                uraian: m.nama,
                koefisien: '0',
                satuan: m.satuan ?? null,
                hsd: m.defaultHsd ?? '0',
              };
            }));
            resourcesAdded += matches.length;
          }
        }
      }

      await snapshotAhsp(ctx.db, newId, ctx.session.user.id, `cloned from ${src.kode} as org custom`);
      return { newId, resourcesAdded };
    }),

  // ===== AGENT W =====
  // Reverse-lookup AHSP by resource, full cost breakdown for pie charts,
  // and productivity-based estimator (Q1/Q2/Qt-driven hour/day projection).

  /**
   * Find every AHSP item that consumes the given resource (by resource_code or master id).
   * Org-scoped: global + own-org items. Sorted by AHSP kode. Each row carries the matching
   * resource line's koefisien + hsd + subtotal so the caller can show "how much that resource
   * contributes" per AHSP without a second roundtrip.
   */
  byResource: orgProcedure
    .input(z.object({
      resourceCode: z.string().min(1).optional(),
      resourceMasterId: z.string().uuid().optional(),
      category: z.enum(['tenaga', 'bahan', 'peralatan']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!input.resourceCode && !input.resourceMasterId) {
        return [] as Array<{
          id: string; kode: string; jenis: string; satuan: string;
          resourceCode: string; koefisien: number; hsd: number; subtotal: number;
          computedRate: number; pctOfTotal: number;
        }>;
      }
      const orgId = ctx.session.organizationId;

      // Resolve resourceCode if only master id was supplied
      let code = input.resourceCode ?? null;
      if (!code && input.resourceMasterId) {
        const [m] = await ctx.db.select({ kode: resourceMaster.kode })
          .from(resourceMaster)
          .where(eq(resourceMaster.id, input.resourceMasterId))
          .limit(1);
        if (!m) return [];
        code = m.kode;
      }
      if (!code) return [];

      const catFilter = input.category
        ? sql`AND ar.category = ${input.category}`
        : sql``;

      const result = await ctx.db.execute(sql`
        SELECT
          ai.id,
          ai.kode,
          ai.jenis,
          ai.satuan,
          ai.ohp_pct,
          ar.resource_code,
          ar.koefisien::float8  AS koefisien,
          ar.hsd::float8        AS hsd,
          (ar.koefisien::float8 * ar.hsd::float8) AS subtotal,
          COALESCE((
            SELECT SUM(ar2.koefisien::float8 * ar2.hsd::float8)
            FROM ahsp_resource ar2 WHERE ar2.ahsp_item_id = ai.id
          ), 0) AS abc_total
        FROM ahsp_item ai
        JOIN ahsp_resource ar ON ar.ahsp_item_id = ai.id
        WHERE ar.resource_code = ${code}
          ${catFilter}
          AND (ai.organization_id IS NULL OR ai.organization_id = ${orgId})
        ORDER BY ai.kode
      `);
      const rows = ((result as any).rows ?? result) as any[];
      return rows.map(r => {
        const ohpPct = Number(r.ohp_pct ?? 0);
        const abc = Number(r.abc_total ?? 0);
        const computedRate = abc * (1 + ohpPct / 100);
        const subtotal = Number(r.subtotal ?? 0);
        const pctOfTotal = computedRate > 0 ? (subtotal / computedRate) * 100 : 0;
        return {
          id: String(r.id),
          kode: r.kode as string,
          jenis: r.jenis as string,
          satuan: r.satuan as string,
          resourceCode: r.resource_code as string,
          koefisien: Number(r.koefisien ?? 0),
          hsd: Number(r.hsd ?? 0),
          subtotal,
          computedRate,
          pctOfTotal,
        };
      });
    }),

  /**
   * Cost breakdown of one AHSP item for charting / "where is the money going":
   *   - per-category subtotals (tenaga/bahan/peralatan)
   *   - OHP amount + grand total
   *   - top 10 resource contributors (sorted DESC by subtotal) with % of grand total
   */
  costBreakdown: orgProcedure
    .input(z.object({ ahspItemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const resources = await ctx.db.select().from(ahspResource)
        .where(eq(ahspResource.ahspItemId, item.id))
        .orderBy(asc(ahspResource.category), asc(ahspResource.ordinal));

      const totals = computeAhspRate(
        resources.map(r => ({
          category: r.category as AhspCategory,
          koefisien: N(r.koefisien),
          hsd: N(r.hsd),
        })),
        N(item.ohpPct),
      );

      const grandTotal = totals.unitRate;
      const contributors = resources
        .map(r => {
          const subtotal = N(r.koefisien) * N(r.hsd);
          return {
            category: r.category as AhspCategory,
            kode: r.resourceCode,
            uraian: r.uraian,
            subtotal,
            pctOfTotal: grandTotal > 0 ? (subtotal / grandTotal) * 100 : 0,
          };
        })
        .sort((a, b) => b.subtotal - a.subtotal)
        .slice(0, 10);

      return {
        tenagaTotal:    totals.totalTenaga,
        bahanTotal:     totals.totalBahan,
        peralatanTotal: totals.totalPeralatan,
        ohpAmount:      totals.ohpAmt,
        grandTotal,
        perCategory: {
          tenaga:    totals.totalTenaga,
          bahan:     totals.totalBahan,
          peralatan: totals.totalPeralatan,
        },
        topContributors: contributors,
      };
    }),

  /**
   * Productivity-based estimator for an AHSP item over a planned BOQ volume.
   *   - unitRate     : computed AHSP unit rate
   *   - totalCost    : unitRate × plannedVolume
   *   - productivityPerHour / PerDay: looked up from ahsp_input or ahsp_koefisien rows
   *       whose `kode` (or `variable`) contains "Q1" / "Q2" (per-hour) or "Qt" (per-day).
   *       If only Qt is found, perHour = Qt / 7 (assumes 7-hour effective workday).
   *       If only Q1 is found, perDay  = Q1 × 7.
   *   - estimatedHours / estimatedDays
   *   - requiredResources: per ahsp_resource row, totalQty = koefisien × plannedVolume
   */
  productivityEstimate: orgProcedure
    .input(z.object({
      ahspItemId: z.string().uuid(),
      plannedVolume: z.number().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.ahspItemId),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const [resources, inputs, koef] = await Promise.all([
        ctx.db.select().from(ahspResource)
          .where(eq(ahspResource.ahspItemId, item.id))
          .orderBy(asc(ahspResource.category), asc(ahspResource.ordinal)),
        ctx.db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, item.id)),
        ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, item.id)),
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
      const unitRate = totals.unitRate;
      const totalCost = unitRate * input.plannedVolume;

      // Scan inputs + koefisien for productivity values
      type ProdRow = { kode: string; variable: string | null; nilai: number | null };
      const pool: ProdRow[] = [
        ...inputs.map(i => ({ kode: i.kode, variable: i.variable, nilai: i.nilai === null ? null : N(i.nilai) })),
        ...koef.map(k => ({ kode: k.kode, variable: k.variable, nilai: k.nilai === null ? null : N(k.nilai) })),
      ];
      const findBy = (re: RegExp): number | null => {
        for (const p of pool) {
          if (p.nilai === null || p.nilai === undefined || !isFinite(p.nilai) || p.nilai <= 0) continue;
          if (re.test(p.kode) || (p.variable && re.test(p.variable))) return p.nilai;
        }
        return null;
      };
      const q1 = findBy(/\bQ1\b/i);
      const q2 = findBy(/\bQ2\b/i);
      const qt = findBy(/\bQt\b/i);

      // Use the strongest signal available
      const perHour = q1 ?? q2 ?? (qt !== null ? qt / 7 : null);
      const perDay = qt ?? (perHour !== null ? perHour * 7 : null);

      const estimatedHours = perHour && perHour > 0 ? input.plannedVolume / perHour : null;
      const estimatedDays  = perDay  && perDay  > 0 ? input.plannedVolume / perDay  : null;

      const requiredResources = resources.map(r => ({
        kode: r.resourceCode,
        category: r.category as AhspCategory,
        uraian: r.uraian,
        totalQty: N(r.koefisien) * input.plannedVolume,
        satuan: r.satuan,
      }));

      return {
        item: {
          id: item.id,
          kode: item.kode,
          jenis: item.jenis,
          satuan: item.satuan,
        },
        unitRate,
        totalCost,
        productivityPerHour: perHour,
        productivityPerDay: perDay,
        estimatedHours,
        estimatedDays,
        requiredResources,
      };
    }),
});
