/**
 * Load ahsp-seed.json (produced by import-ahsp-from-xlsx.py) into PostgreSQL.
 *
 *   DATABASE_URL=postgresql://postgres:dev@localhost:5434/sitelog \
 *     bun scripts/load-ahsp-seed.ts
 *
 * Strategy:
 *   1. UPSERT resource_master (org=null) by (kode). Last write wins for cross-
 *      category dupes like L01 (Pekerja vs Alat Bantu) — see PARAMETER sheet notes.
 *   2. For each AHSP item:
 *        - SELECT by (organization_id IS NULL, kode); UPDATE if exists, else INSERT.
 *        - DELETE existing ahsp_input / ahsp_koefisien / ahsp_resource rows.
 *        - INSERT fresh rows from seed.
 *      Preserves boq_item references (FK is ON DELETE RESTRICT — we never delete
 *      ahsp_item rows, only their children).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Import via the db package's node_modules (postgres is a transitive dep).
// @ts-ignore — resolved at runtime via Bun's node-style resolution
import postgres from '../packages/db/node_modules/postgres/src/index.js';

type SeedResource = {
  kode: string;
  nama: string;
  category: 'tenaga' | 'bahan' | 'peralatan';
  satuan: string;
  hsd: number;
  catatan?: string;
};

type SeedInput = {
  ordinal: number;
  kode: string;
  variable: string | null;
  uraian: string;
  nilai: number | null;
  satuan: string;
  sumber: string;
};

type SeedKoef = {
  ordinal: number;
  kode: string;
  variable: string | null;
  uraian: string;
  nilai: number | null;
  satuan: string;
  formula: string;
};

type SeedResourceLine = {
  category: 'tenaga' | 'bahan' | 'peralatan';
  ordinal: number;
  kode: string;
  uraian: string;
  koefisien: number;
  satuan: string;
  hsd: number;
  subtotal: number;
};

type SeedItem = {
  kode: string;
  sourceKode: string;
  label: string;
  jenis: string;
  satuan: string;
  ohpPct: number;
  inputs: SeedInput[];
  koefisien: SeedKoef[];
  resources: SeedResourceLine[];
  abcSubtotal: number;
  ohpAmount: number;
  unitRate: number;
};

type Seed = { resources: SeedResource[]; items: SeedItem[] };

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const SEED_PATH = resolve(import.meta.dir, 'ahsp-seed.json');
const seed: Seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));

const sql = postgres(DATABASE_URL, { max: 4, prepare: false });

async function upsertResourceMaster() {
  // Deduplicate by kode (last category wins for cross-category dupes like L01).
  const byKode = new Map<string, SeedResource>();
  for (const r of seed.resources) byKode.set(r.kode, r);
  console.log(`Upserting ${byKode.size} resource_master rows ...`);

  for (const r of byKode.values()) {
    await sql`
      INSERT INTO resource_master (organization_id, kode, nama, category, satuan, default_hsd, notes)
      VALUES (NULL, ${r.kode}, ${r.nama}, ${r.category}::resource_master_category, ${r.satuan}, ${r.hsd}, ${r.catatan ?? null})
      ON CONFLICT ((COALESCE(organization_id::text, '')), kode)
      DO UPDATE SET
        nama = EXCLUDED.nama,
        category = EXCLUDED.category,
        satuan = EXCLUDED.satuan,
        default_hsd = EXCLUDED.default_hsd,
        notes = EXCLUDED.notes,
        updated_at = now()
    `;
  }
}

async function upsertAhspItem(item: SeedItem): Promise<string> {
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM ahsp_item WHERE organization_id IS NULL AND kode = ${item.kode} LIMIT 1
  `;

  // Truncate strings to fit column widths.
  const label = (item.label || item.kode).slice(0, 64);
  const sourceKode = item.sourceKode.slice(0, 64);
  const jenis = (item.jenis || item.label || item.kode).slice(0, 255);

  if (existing.length > 0) {
    const id = existing[0].id;
    await sql`
      UPDATE ahsp_item SET
        label = ${label},
        source_kode = ${sourceKode},
        jenis = ${jenis},
        deskripsi = ${item.jenis},
        satuan = ${item.satuan},
        ohp_pct = ${item.ohpPct},
        updated_at = now()
      WHERE id = ${id}
    `;
    return id;
  }

  const [{ id }] = await sql<{ id: string }[]>`
    INSERT INTO ahsp_item (organization_id, kode, label, source_kode, jenis, deskripsi, satuan, ohp_pct)
    VALUES (NULL, ${item.kode}, ${label}, ${sourceKode}, ${jenis}, ${item.jenis}, ${item.satuan}, ${item.ohpPct})
    RETURNING id
  `;
  return id;
}

async function replaceChildren(item: SeedItem, ahspItemId: string) {
  await sql`DELETE FROM ahsp_input WHERE ahsp_item_id = ${ahspItemId}`;
  await sql`DELETE FROM ahsp_koefisien WHERE ahsp_item_id = ${ahspItemId}`;
  await sql`DELETE FROM ahsp_resource WHERE ahsp_item_id = ${ahspItemId}`;

  if (item.inputs.length > 0) {
    const rows = item.inputs.map(i => ({
      ahsp_item_id: ahspItemId,
      ordinal: i.ordinal,
      kode: (i.kode || '-').slice(0, 64),
      variable: i.variable ? i.variable.slice(0, 64) : null,
      uraian: i.uraian || '-',
      nilai: i.nilai,
      satuan: i.satuan ? i.satuan.slice(0, 32) : null,
      sumber: i.sumber || null,
    }));
    await sql`INSERT INTO ahsp_input ${sql(rows)}`;
  }

  if (item.koefisien.length > 0) {
    const rows = item.koefisien.map(k => ({
      ahsp_item_id: ahspItemId,
      ordinal: k.ordinal,
      kode: (k.kode || '-').slice(0, 64),
      variable: k.variable ? k.variable.slice(0, 64) : null,
      uraian: k.uraian || null,
      nilai: k.nilai,
      satuan: k.satuan ? k.satuan.slice(0, 32) : null,
      formula: k.formula || null,
    }));
    await sql`INSERT INTO ahsp_koefisien ${sql(rows)}`;
  }

  if (item.resources.length > 0) {
    const rows = item.resources.map(r => ({
      ahsp_item_id: ahspItemId,
      category: r.category,
      ordinal: r.ordinal,
      resource_code: r.kode.slice(0, 32),
      uraian: r.uraian,
      koefisien: r.koefisien,
      satuan: r.satuan ? r.satuan.slice(0, 32) : null,
      hsd: r.hsd,
    }));
    await sql`INSERT INTO ahsp_resource ${sql(rows)}`;
  }
}

async function main() {
  console.log(`Loaded seed: ${seed.resources.length} resources, ${seed.items.length} AHSP items`);

  await upsertResourceMaster();

  let updated = 0;
  let inserted = 0;
  for (const item of seed.items) {
    const before = await sql<{ id: string }[]>`
      SELECT id FROM ahsp_item WHERE organization_id IS NULL AND kode = ${item.kode} LIMIT 1
    `;
    const id = await upsertAhspItem(item);
    if (before.length > 0) updated++; else inserted++;
    await replaceChildren(item, id);
  }

  console.log(`AHSP items: ${inserted} inserted, ${updated} updated`);

  // Verify EI-311 / AHSP-1 rate.
  const sample = await sql<{ rate: string; resources: number }[]>`
    SELECT
      COALESCE(SUM(ar.koefisien * ar.hsd), 0)::text AS rate,
      COUNT(ar.id)::int AS resources
    FROM ahsp_item ai
    LEFT JOIN ahsp_resource ar ON ar.ahsp_item_id = ai.id
    WHERE ai.organization_id IS NULL AND ai.kode = 'AHSP-1'
    GROUP BY ai.id
  `;
  if (sample[0]) {
    console.log(`Verification AHSP-1: rate=${Number(sample[0].rate).toFixed(2)} (expected ≈ 38102.44), resource lines=${sample[0].resources}`);
  } else {
    console.warn('AHSP-1 not found in DB after load!');
  }

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
