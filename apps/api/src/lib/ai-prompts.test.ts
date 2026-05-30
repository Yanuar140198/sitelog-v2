import { describe, it, expect } from 'vitest';
import {
  DAILY_REPORT_SYSTEM, buildDailyReportUser,
  EXPLAIN_RATE_SYSTEM, buildExplainRateUser,
} from './ai-prompts.js';

describe('ai-prompts: system prompts are cache-stable', () => {
  it('contain no volatile tokens (dates/ids/random) so the cache prefix stays warm', () => {
    for (const s of [DAILY_REPORT_SYSTEM, EXPLAIN_RATE_SYSTEM]) {
      expect(s).not.toMatch(/\d{4}-\d{2}-\d{2}/);          // no ISO dates
      expect(s.length).toBeGreaterThan(50);
      expect(s).toBe(s.trim());
    }
  });
});

describe('buildDailyReportUser', () => {
  it('renders header fields and dashes missing values', () => {
    const out = buildDailyReportUser({
      projectName: 'PIT DS', entryDate: '2026-05-30', shift: 'day',
      weather: 'rain_light', effectiveHours: 6.5, workforce: 12, notes: null,
      activities: [], equipment: [],
    });
    expect(out).toContain('Proyek: PIT DS');
    expect(out).toContain('Tanggal: 2026-05-30');
    expect(out).toContain('Jam efektif: 6.5');
    expect(out).toContain('AKTIVITAS (0):');
    expect(out).toContain('ALAT (0):');
    expect(out.match(/tidak ada data/g)?.length).toBe(2); // activities + equipment
  });

  it('lists activities with quantity + satuan + station', () => {
    const out = buildDailyReportUser({
      projectName: 'X', entryDate: '2026-05-30', shift: 'day', weather: null,
      effectiveHours: null, workforce: null, notes: 'hujan sore',
      activities: [{ description: 'Galian tanah', quantity: 1200, satuan: 'm3', station: 'STA 1+200' }],
      equipment: [{ unitLabel: 'EX-01 (Excavator)', hmWork: 7, hmIdle: 1, hmBreakdown: 0, fuelLiters: 80, trips: null, status: 'ok' }],
    });
    expect(out).toContain('- Galian tanah: 1200 m3 @STA 1+200');
    expect(out).toContain('EX-01 (Excavator): kerja 7 HM, idle 1 HM, rusak 0 HM, BBM 80 L, status ok');
    expect(out).toContain('CATATAN LAPANGAN: hujan sore');
  });

  it('omits null fuel/trips/status from the equipment line', () => {
    const out = buildDailyReportUser({
      projectName: 'X', entryDate: '2026-05-30', shift: 'day', weather: null,
      effectiveHours: null, workforce: null, notes: null,
      activities: [], equipment: [{ unitLabel: 'DT-1', hmWork: 5, hmIdle: 0, hmBreakdown: 0, fuelLiters: null, trips: null, status: null }],
    });
    expect(out).toContain('DT-1: kerja 5 HM, idle 0 HM, rusak 0 HM');
    expect(out).not.toMatch(/BBM|ritase|status/);
  });
});

describe('buildExplainRateUser', () => {
  it('renders the three category sections + totals', () => {
    const out = buildExplainRateUser({
      kode: 'A.1.1', jenis: 'Galian biasa', satuan: 'm3', ohpPct: 10,
      sections: {
        tenaga: { rows: [{ uraian: 'Pekerja', koefisien: 0.5, hsd: 100000, subtotal: 50000 }], total: 50000 },
        bahan: { rows: [], total: 0 },
        peralatan: { rows: [{ uraian: 'Excavator', koefisien: 0.05, hsd: 400000, subtotal: 20000 }], total: 20000 },
      },
      totals: { abcSubtotal: 70000, ohpAmount: 7000, unitRate: 77000 },
    });
    expect(out).toContain('Kode: A.1.1 | Jenis: Galian biasa | Satuan: m3 | OHP: 10%');
    expect(out).toContain('A. TENAGA (total 50000):');
    expect(out).toContain('- Pekerja: koef 0.5 × HSD 100000 = 50000');
    expect(out).toContain('B. BAHAN (total 0):');
    expect(out).toContain('  - (kosong)');
    expect(out).toContain('Harga Satuan: 77000');
  });
});
