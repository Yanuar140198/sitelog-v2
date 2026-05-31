/**
 * AHSP productivity estimator — pure helper extracted from `router/ahsp.ts`.
 *
 * Reads productivity signals (Q1/Q2/Qt) out of an AHSP item's input/koefisien
 * rows and derives per-hour / per-day output + estimated hours/days for a planned
 * volume. Q1/Q2 are treated as per-hour rates; Qt as per-day. The workday is
 * assumed to be HOURS_PER_DAY hours.
 */

export interface ProdSignal {
  kode: string;
  variable: string | null;
  nilai: number | null;
}

export interface ProductivityEstimate {
  perHour: number | null;
  perDay: number | null;
  estimatedHours: number | null;
  estimatedDays: number | null;
}

export const HOURS_PER_DAY = 7;

const N = (v: unknown) => Number(v ?? 0);

export function estimateProductivity(
  pool: ReadonlyArray<ProdSignal>,
  plannedVolume: number,
): ProductivityEstimate {
  // First positive, finite signal matching the pattern wins (kode or variable).
  const findBy = (re: RegExp): number | null => {
    for (const p of pool) {
      const n = p.nilai;
      if (n === null || n === undefined || !isFinite(n) || n <= 0) continue;
      if (re.test(p.kode) || (p.variable && re.test(p.variable))) return n;
    }
    return null;
  };

  const q1 = findBy(/\bQ1\b/i);
  const q2 = findBy(/\bQ2\b/i);
  const qt = findBy(/\bQt\b/i);

  // Strongest signal: explicit per-hour (Q1, then Q2), else derive from per-day Qt.
  const perHour = q1 ?? q2 ?? (qt !== null ? qt / HOURS_PER_DAY : null);
  const perDay = qt ?? (perHour !== null ? perHour * HOURS_PER_DAY : null);

  const vol = N(plannedVolume);
  const estimatedHours = perHour && perHour > 0 ? vol / perHour : null;
  const estimatedDays = perDay && perDay > 0 ? vol / perDay : null;

  return { perHour, perDay, estimatedHours, estimatedDays };
}
