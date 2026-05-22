/**
 * AHSP unit-rate math — pure helper extracted for reuse between
 * `router/boq.ts` (project-priced rates with overrides) and
 * `router/ahsp.ts` (catalog detail breakdown).
 *
 * Input is a normalized list of resource lines (already merged with
 * any project overrides if applicable). Output is the section
 * subtotals + OHP + final unit rate.
 */

export type AhspCategory = 'tenaga' | 'bahan' | 'peralatan';

export interface AhspResourceLine {
  category: AhspCategory;
  koefisien: number;
  hsd: number;
}

export interface AhspRateTotals {
  totalTenaga: number;
  totalBahan: number;
  totalPeralatan: number;
  jumlahABC: number;
  ohpPct: number;
  ohpAmt: number;
  unitRate: number;
}

const N = (v: unknown) => Number(v ?? 0);

export function computeAhspRate(
  resources: ReadonlyArray<AhspResourceLine>,
  ohpPct: number,
): AhspRateTotals {
  let totalTenaga = 0;
  let totalBahan = 0;
  let totalPeralatan = 0;
  for (const r of resources) {
    const line = N(r.koefisien) * N(r.hsd);
    if (r.category === 'tenaga') totalTenaga += line;
    else if (r.category === 'bahan') totalBahan += line;
    else if (r.category === 'peralatan') totalPeralatan += line;
  }
  const jumlahABC = totalTenaga + totalBahan + totalPeralatan;
  const pct = N(ohpPct);
  const ohpAmt = jumlahABC * pct / 100;
  return {
    totalTenaga,
    totalBahan,
    totalPeralatan,
    jumlahABC,
    ohpPct: pct,
    ohpAmt,
    unitRate: jumlahABC + ohpAmt,
  };
}
