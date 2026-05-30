/**
 * Pure prompt builders for the AI assistant. System prompts are constant (no
 * dates/ids) so they cache cleanly; all per-request data goes into the user
 * message. Kept free of I/O so they can be unit-tested.
 */

// ── Daily report drafting ──────────────────────────────────────────────────

export const DAILY_REPORT_SYSTEM = [
  'Anda adalah asisten pelaporan untuk proyek konstruksi/earthworks di Indonesia.',
  'Tugas: menyusun narasi Laporan Harian Proyek yang ringkas, profesional, dan faktual',
  'dalam Bahasa Indonesia, dari data terstruktur yang diberikan.',
  '',
  'Aturan:',
  '- Hanya gunakan fakta dari data. Jangan mengarang angka, alat, atau aktivitas.',
  '- Struktur: (1) Ringkasan, (2) Aktivitas & progres, (3) Alat & produktivitas,',
  '  (4) Cuaca & kendala, (5) Catatan/Rekomendasi.',
  '- Sebutkan kuantitas + satuan apa adanya. Jika data kosong, tulis "tidak ada data".',
  '- Nada lugas, tanpa basa-basi. Maksimal ~250 kata.',
].join('\n');

export interface DailyReportActivity {
  description: string;
  quantity: string | number | null;
  satuan?: string | null;
  station?: string | null;
}
export interface DailyReportEquipment {
  unitLabel?: string | null;
  hmWork?: string | number | null;
  hmIdle?: string | number | null;
  hmBreakdown?: string | number | null;
  fuelLiters?: string | number | null;
  trips?: number | null;
  status?: string | null;
}
export interface DailyReportData {
  projectName?: string | null;
  entryDate?: string | null;
  shift?: string | null;
  weather?: string | null;
  effectiveHours?: string | number | null;
  workforce?: number | null;
  notes?: string | null;
  activities: DailyReportActivity[];
  equipment: DailyReportEquipment[];
}

const orDash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

export function buildDailyReportUser(d: DailyReportData): string {
  const lines: string[] = [];
  lines.push('DATA LAPORAN HARIAN');
  lines.push(`Proyek: ${orDash(d.projectName)}`);
  lines.push(`Tanggal: ${orDash(d.entryDate)}`);
  lines.push(`Shift: ${orDash(d.shift)}`);
  lines.push(`Cuaca: ${orDash(d.weather)}`);
  lines.push(`Jam efektif: ${orDash(d.effectiveHours)}`);
  lines.push(`Jumlah pekerja: ${orDash(d.workforce)}`);

  lines.push('', `AKTIVITAS (${d.activities.length}):`);
  if (d.activities.length === 0) lines.push('- tidak ada data');
  for (const a of d.activities) {
    const st = a.station ? ` @${a.station}` : '';
    lines.push(`- ${orDash(a.description)}: ${orDash(a.quantity)} ${orDash(a.satuan)}${st}`);
  }

  lines.push('', `ALAT (${d.equipment.length}):`);
  if (d.equipment.length === 0) lines.push('- tidak ada data');
  for (const e of d.equipment) {
    const parts = [
      `kerja ${orDash(e.hmWork)} HM`,
      `idle ${orDash(e.hmIdle)} HM`,
      `rusak ${orDash(e.hmBreakdown)} HM`,
      e.fuelLiters != null ? `BBM ${e.fuelLiters} L` : null,
      e.trips != null ? `${e.trips} ritase` : null,
      e.status ? `status ${e.status}` : null,
    ].filter(Boolean);
    lines.push(`- ${orDash(e.unitLabel)}: ${parts.join(', ')}`);
  }

  if (d.notes) lines.push('', `CATATAN LAPANGAN: ${d.notes}`);
  lines.push('', 'Susun narasi laporan harian dari data di atas.');
  return lines.join('\n');
}

// ── AHSP rate explanation ──────────────────────────────────────────────────

export const EXPLAIN_RATE_SYSTEM = [
  'Anda adalah estimator ahli AHSP (Analisa Harga Satuan Pekerjaan) Indonesia.',
  'Tugas: menjelaskan komposisi harga satuan sebuah item AHSP dalam Bahasa Indonesia',
  'secara singkat dan mudah dipahami oleh estimator pemula.',
  '',
  'Aturan:',
  '- Jelaskan kontribusi tiap kategori (Tenaga, Bahan, Peralatan) terhadap harga satuan.',
  '- Sebutkan komponen biaya terbesar dan dampak OHP (overhead & profit).',
  '- Gunakan angka dari data. Jangan mengarang koefisien atau harga.',
  '- Maksimal ~180 kata. Tanpa basa-basi.',
].join('\n');

export interface ExplainRateRow { uraian: string; koefisien: string | number; hsd: string | number; subtotal: string | number; }
export interface ExplainRateData {
  kode: string;
  jenis: string;
  satuan: string;
  ohpPct: string | number;
  sections: {
    tenaga: { rows: ExplainRateRow[]; total: number };
    bahan: { rows: ExplainRateRow[]; total: number };
    peralatan: { rows: ExplainRateRow[]; total: number };
  };
  totals: { abcSubtotal: number; ohpAmount: number; unitRate: number };
}

function fmtRows(rows: ExplainRateRow[]): string {
  if (rows.length === 0) return '  - (kosong)';
  return rows.map((r) => `  - ${orDash(r.uraian)}: koef ${orDash(r.koefisien)} × HSD ${orDash(r.hsd)} = ${orDash(r.subtotal)}`).join('\n');
}

export function buildExplainRateUser(d: ExplainRateData): string {
  return [
    'DATA ITEM AHSP',
    `Kode: ${orDash(d.kode)} | Jenis: ${orDash(d.jenis)} | Satuan: ${orDash(d.satuan)} | OHP: ${orDash(d.ohpPct)}%`,
    '',
    `A. TENAGA (total ${d.sections.tenaga.total}):`,
    fmtRows(d.sections.tenaga.rows),
    `B. BAHAN (total ${d.sections.bahan.total}):`,
    fmtRows(d.sections.bahan.rows),
    `C. PERALATAN (total ${d.sections.peralatan.total}):`,
    fmtRows(d.sections.peralatan.rows),
    '',
    `Jumlah A+B+C: ${d.totals.abcSubtotal}`,
    `OHP: ${d.totals.ohpAmount}`,
    `Harga Satuan: ${d.totals.unitRate}`,
    '',
    'Jelaskan komposisi harga satuan item ini.',
  ].join('\n');
}
