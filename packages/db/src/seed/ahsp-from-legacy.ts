/**
 * Seed AHSP catalog from legacy spi.k11ops.com JSON dumps.
 *
 * Usage:
 *   DATABASE_URL=... bun packages/db/src/seed/ahsp-from-legacy.ts \
 *     --rates path/to/ahsp_rates.json \
 *     --detail path/to/ahsp_detail.json \
 *     [--org-id <uuid>]   # if set, seeds as org-scoped, else global catalog
 */
import { readFileSync } from 'node:fs';
import { db } from '../index.js';
import { ahspItem, ahspInput, ahspKoefisien, ahspResource } from '../schema/ahsp.js';
import { eq, and, isNull } from 'drizzle-orm';

interface LegacyRate {
  kode: string;
  itemNo?: string;
  section?: string;
  jenis: string;
  satuan: string;
  unitRate?: number;
}

interface LegacyDetailItem {
  kode: string;
  label?: string;
  srcKode?: string;
  ahspNo?: string | number;
  deskripsi?: string;
  satuan: string;
  ohpPct?: number;
  inputs: Array<{ kode: string; var?: string; uraian: string; nilai: any; satuan?: string; sumber?: string }>;
  koefisien: Array<{ kode: string; var?: string; uraian?: string; nilai: any; satuan?: string; sumber?: string }>;
  tenaga: Array<{ kode: string; uraian: string; koefisien: number; satuan?: string; hsd: number }>;
  bahan: Array<{ kode: string; uraian: string; koefisien: number; satuan?: string; hsd: number }>;
  peralatan: Array<{ kode: string; uraian: string; koefisien: number; satuan?: string; hsd: number }>;
}

function argFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const ratesPath = argFlag('rates');
  const detailPath = argFlag('detail');
  const orgId = argFlag('org-id') ?? null;

  let rates: LegacyRate[] = [];
  let details: LegacyDetailItem[] = [];
  if (ratesPath) {
    const parsed = JSON.parse(readFileSync(ratesPath, 'utf-8'));
    rates = parsed.items ?? parsed;
  }
  if (detailPath) {
    const parsed = JSON.parse(readFileSync(detailPath, 'utf-8'));
    details = parsed.items ?? parsed;
  }

  const detailByKode = new Map(details.map(d => [d.kode, d]));
  const detailBySrcKode = new Map<string, LegacyDetailItem>();
  for (const d of details) if (d.srcKode) detailBySrcKode.set(d.srcKode, d);

  console.log(`[seed] rates=${rates.length} detail=${details.length} org=${orgId ?? 'GLOBAL'}`);

  // Build combined list: rates + any detail items not already in rates (by kode).
  const ratesByKode = new Map(rates.map(r => [r.kode, r]));
  const combined: Array<LegacyRate & { _isDetailOnly?: boolean }> = [...rates];
  for (const d of details) {
    if (d.kode && !ratesByKode.has(d.kode)) {
      combined.push({
        kode: d.kode,
        section: 'DETAILED ANALYSIS',
        jenis: d.deskripsi || d.label || d.kode,
        satuan: d.satuan || '',
        _isDetailOnly: true,
      } as any);
    }
  }

  let inserted = 0, updated = 0;
  for (const r of combined) {
    if (!r.kode) continue;
    const d = detailByKode.get(r.kode) ?? detailBySrcKode.get(r.kode);

    // Upsert ahspItem
    const whereOrg = orgId ? eq(ahspItem.organizationId, orgId) : isNull(ahspItem.organizationId);
    const existing = await db.select().from(ahspItem)
      .where(and(eq(ahspItem.kode, r.kode), whereOrg)).limit(1);

    const payload = {
      organizationId: orgId,
      kode: r.kode,
      label: d?.label ?? r.kode,
      sourceKode: d?.srcKode ?? r.kode,
      itemNo: r.itemNo,
      section: r.section,
      jenis: r.jenis ?? d?.deskripsi ?? r.kode,
      deskripsi: d?.deskripsi,
      satuan: r.satuan || d?.satuan || '',
      ohpPct: String(d?.ohpPct ?? 0),
    };

    let itemId: string;
    if (existing.length > 0) {
      itemId = existing[0]!.id;
      await db.update(ahspItem).set({ ...payload, updatedAt: new Date() }).where(eq(ahspItem.id, itemId));
      updated++;
    } else {
      const [row] = await db.insert(ahspItem).values(payload).returning();
      itemId = row!.id;
      inserted++;
    }

    if (!d) continue;

    // Replace inputs/koef/resources (idempotent)
    await db.delete(ahspInput).where(eq(ahspInput.ahspItemId, itemId));
    await db.delete(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, itemId));
    await db.delete(ahspResource).where(eq(ahspResource.ahspItemId, itemId));

    if (d.inputs?.length) {
      await db.insert(ahspInput).values(d.inputs.map((x, i) => ({
        ahspItemId: itemId,
        ordinal: i,
        kode: x.kode ?? '',
        variable: x.var,
        uraian: x.uraian,
        nilai: x.nilai !== null && x.nilai !== undefined ? String(x.nilai) : null,
        satuan: x.satuan,
        sumber: x.sumber,
      })));
    }
    if (d.koefisien?.length) {
      await db.insert(ahspKoefisien).values(d.koefisien.map((x, i) => ({
        ahspItemId: itemId,
        ordinal: i,
        kode: x.kode ?? '',
        variable: x.var,
        uraian: x.uraian,
        nilai: x.nilai !== null && x.nilai !== undefined ? String(x.nilai) : null,
        satuan: x.satuan,
        formula: x.sumber,
      })));
    }
    const allRes: Array<{ cat: 'tenaga' | 'bahan' | 'peralatan'; lines: typeof d.tenaga }> = [
      { cat: 'tenaga', lines: d.tenaga ?? [] },
      { cat: 'bahan', lines: d.bahan ?? [] },
      { cat: 'peralatan', lines: d.peralatan ?? [] },
    ];
    for (const { cat, lines } of allRes) {
      if (!lines.length) continue;
      await db.insert(ahspResource).values(lines.map((l, i) => ({
        ahspItemId: itemId,
        category: cat,
        ordinal: i,
        resourceCode: l.kode ?? '',
        uraian: l.uraian,
        koefisien: String(l.koefisien ?? 0),
        satuan: l.satuan,
        hsd: String(l.hsd ?? 0),
      })));
    }
  }

  console.log(`[seed] done. inserted=${inserted} updated=${updated}`);
}

main().catch(e => { console.error(e); process.exit(1); });
