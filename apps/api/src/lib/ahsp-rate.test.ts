import { describe, it, expect } from 'vitest';
import { computeAhspRate, type AhspResourceLine } from './ahsp-rate.js';

const line = (category: AhspResourceLine['category'], koefisien: number, hsd: number): AhspResourceLine =>
  ({ category, koefisien, hsd });

describe('computeAhspRate', () => {
  it('empty list → all zeros', () => {
    const r = computeAhspRate([], 10);
    expect(r).toMatchObject({
      totalTenaga: 0, totalBahan: 0, totalPeralatan: 0, jumlahABC: 0, ohpAmt: 0, unitRate: 0,
    });
  });

  it('buckets lines into the three categories', () => {
    const r = computeAhspRate([
      line('tenaga', 2, 100),      // 200
      line('bahan', 3, 50),        // 150
      line('peralatan', 1, 400),   // 400
    ], 0);
    expect(r.totalTenaga).toBe(200);
    expect(r.totalBahan).toBe(150);
    expect(r.totalPeralatan).toBe(400);
    expect(r.jumlahABC).toBe(750);
  });

  it('sums multiple lines within the same category', () => {
    const r = computeAhspRate([
      line('bahan', 1, 100),
      line('bahan', 2, 100),
      line('bahan', 0.5, 200),
    ], 0);
    expect(r.totalBahan).toBe(400);
    expect(r.jumlahABC).toBe(400);
  });

  it('applies OHP as a percentage of jumlahABC', () => {
    const r = computeAhspRate([line('tenaga', 1, 1000)], 10);
    expect(r.ohpPct).toBe(10);
    expect(r.ohpAmt).toBe(100);
    expect(r.unitRate).toBe(1100);
  });

  it('ohpPct = 0 → unitRate equals jumlahABC', () => {
    const r = computeAhspRate([line('bahan', 2, 250)], 0);
    expect(r.ohpAmt).toBe(0);
    expect(r.unitRate).toBe(500);
  });

  it('ohpPct = 100 → unitRate doubles', () => {
    const r = computeAhspRate([line('peralatan', 1, 800)], 100);
    expect(r.unitRate).toBe(1600);
  });

  it('treats null/undefined koefisien, hsd, ohp as 0 (no NaN poisoning)', () => {
    const r = computeAhspRate([
      { category: 'tenaga', koefisien: null as any, hsd: 100 },
      { category: 'bahan', koefisien: 2, hsd: undefined as any },
      line('peralatan', 1, 500),
    ], null as any);
    expect(Number.isNaN(r.jumlahABC)).toBe(false);
    expect(r.totalTenaga).toBe(0);
    expect(r.totalBahan).toBe(0);
    expect(r.totalPeralatan).toBe(500);
    expect(r.unitRate).toBe(500); // ohp null → 0%
  });

  it('handles fractional koefisien precisely enough for IDR', () => {
    const r = computeAhspRate([line('tenaga', 0.0667, 150000)], 15);
    expect(r.jumlahABC).toBeCloseTo(10005, 5);
    expect(r.unitRate).toBeCloseTo(11505.75, 2);
  });

  it('ignores unknown categories (no bucket) but still counts nothing', () => {
    const r = computeAhspRate([
      { category: 'lain' as any, koefisien: 5, hsd: 100 },
      line('bahan', 1, 100),
    ], 0);
    expect(r.totalBahan).toBe(100);
    expect(r.jumlahABC).toBe(100); // unknown line excluded from all buckets
  });

  it('negative koefisien (data error) flows through as a negative line', () => {
    const r = computeAhspRate([line('bahan', -1, 100), line('bahan', 2, 100)], 0);
    expect(r.totalBahan).toBe(100);
  });
});
