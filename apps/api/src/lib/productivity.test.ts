import { describe, it, expect } from 'vitest';
import { estimateProductivity, HOURS_PER_DAY, type ProdSignal } from './productivity.js';

const sig = (kode: string, nilai: number | null, variable: string | null = null): ProdSignal =>
  ({ kode, variable, nilai });

describe('estimateProductivity', () => {
  it('no signals → all null', () => {
    expect(estimateProductivity([], 100)).toEqual({
      perHour: null, perDay: null, estimatedHours: null, estimatedDays: null,
    });
  });

  it('Q1 is treated as per-hour; derives per-day + estimates', () => {
    const r = estimateProductivity([sig('Q1', 10)], 100);
    expect(r.perHour).toBe(10);
    expect(r.perDay).toBe(10 * HOURS_PER_DAY);
    expect(r.estimatedHours).toBe(10);          // 100 / 10
    expect(r.estimatedDays).toBeCloseTo(100 / 70, 6);
  });

  it('Q1 wins over Q2 when both present', () => {
    const r = estimateProductivity([sig('Q2', 5), sig('Q1', 20)], 100);
    expect(r.perHour).toBe(20);
  });

  it('falls back to Q2 when no Q1', () => {
    const r = estimateProductivity([sig('Q2', 8)], 80);
    expect(r.perHour).toBe(8);
    expect(r.estimatedHours).toBe(10);
  });

  it('Qt is per-day; per-hour derived as Qt / HOURS_PER_DAY', () => {
    const r = estimateProductivity([sig('Qt', 70)], 140);
    expect(r.perDay).toBe(70);
    expect(r.perHour).toBe(10);                 // 70 / 7
    expect(r.estimatedDays).toBe(2);            // 140 / 70
    expect(r.estimatedHours).toBe(14);          // 140 / 10
  });

  it('matches signal by variable name, not just kode', () => {
    const r = estimateProductivity([sig('A.1', 12, 'Q1')], 60);
    expect(r.perHour).toBe(12);
    expect(r.estimatedHours).toBe(5);
  });

  it('skips zero / negative / non-finite / null values', () => {
    const r = estimateProductivity([
      sig('Q1', 0), sig('Q1', -5), sig('Q1', Infinity), sig('Q1', null), sig('Q1', 4),
    ], 40);
    expect(r.perHour).toBe(4);                  // first valid positive
    expect(r.estimatedHours).toBe(10);
  });

  it('all-invalid signals → null (no NaN, no division blowup)', () => {
    const r = estimateProductivity([sig('Q1', 0), sig('Qt', -3)], 100);
    expect(r).toEqual({ perHour: null, perDay: null, estimatedHours: null, estimatedDays: null });
  });

  it('does not match unrelated codes (word-boundary)', () => {
    const r = estimateProductivity([sig('Q12', 99), sig('AQ1B', 50)], 100);
    expect(r.perHour).toBeNull();
  });

  it('zero planned volume → zero estimates (not NaN)', () => {
    const r = estimateProductivity([sig('Q1', 10)], 0);
    expect(r.estimatedHours).toBe(0);
    expect(r.estimatedDays).toBe(0);
  });
});
