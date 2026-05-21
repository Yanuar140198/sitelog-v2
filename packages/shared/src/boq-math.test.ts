import { describe, it, expect } from 'vitest';
import {
  resourceLineCost, ahspBaselineRate, itemUnitRate, itemSubtotal,
  projectTotal, spi, geofenceDistanceM, isInsideGeofence,
  checkProjectQuota, checkSeatQuota, PLAN_LIMITS,
} from './boq-math.js';

describe('AHSP rate computation (Bina Marga parity)', () => {
  it('resourceLineCost = koefisien × hsd', () => {
    expect(resourceLineCost({ koefisien: 0.044, hsd: 22442.8 })).toBeCloseTo(987.48, 1);
  });

  // Reproduces AHSP-1 (Cut Soil 1-stage) using exact seed values: matches Excel reference Rp 38,102
  it('ahspBaselineRate matches Bina Marga reference AHSP-1', () => {
    const resources = [
      { koefisien: 0.04462294, hsd: 22442.86 },   // L01 Pekerja
      { koefisien: 0.02231147, hsd: 28485.71 },   // L03 Mandor
      { koefisien: 0.02231147, hsd: 544666.67 },  // E10 Excavator
      { koefisien: 0.05416335, hsd: 447500.00 },  // E09 Dump Truck
      { koefisien: 1.0,        hsd: 75.00 },      // ZB01 Alat Bantu
    ];
    const rate = ahspBaselineRate(resources);
    expect(Math.round(rate)).toBe(38102);
  });

  it('itemUnitRate prefers override when positive', () => {
    expect(itemUnitRate({ quantity: 100, unitRateOverride: 50000, resources: [{ koefisien: 1, hsd: 100 }] })).toBe(50000);
  });

  it('itemUnitRate falls back to baseline when override null', () => {
    expect(itemUnitRate({ quantity: 100, unitRateOverride: null, resources: [{ koefisien: 1, hsd: 100 }] })).toBe(100);
  });

  it('itemUnitRate falls back to baseline when override is 0', () => {
    expect(itemUnitRate({ quantity: 100, unitRateOverride: 0, resources: [{ koefisien: 1, hsd: 100 }] })).toBe(100);
  });

  it('itemSubtotal = qty × rate', () => {
    expect(itemSubtotal({ quantity: 10, unitRateOverride: 500 })).toBe(5000);
  });
});

describe('Project total (matches demo Rp 3,034,955,640)', () => {
  it('demo project grand total — 3 scopes with markup 0 / cont 0 / PPN 11%', () => {
    const items = [
      { quantity: 39802, unitRateOverride: 38102.437652007 },
      { quantity: 26895, unitRateOverride: 30379.3959929772 },
      { quantity: 21551, unitRateOverride: 18587.87023 },
    ];
    const t = projectTotal(items, { markupPct: 0, contingencyPct: 0, ppnPct: 11 });
    expect(Math.round(t.subtotal)).toBe(2_734_194_270);
    expect(Math.round(t.grand)).toBe(3_034_955_640);
  });

  it('markup + contingency + PPN compose correctly', () => {
    const items = [{ quantity: 100, unitRateOverride: 1000 }];
    const t = projectTotal(items, { markupPct: 10, contingencyPct: 5, ppnPct: 11 });
    expect(t.subtotal).toBe(100_000);
    expect(t.markup).toBe(10_000);
    expect(t.contingency).toBe(5_000);
    expect(t.prePpn).toBe(115_000);
    expect(t.ppn).toBeCloseTo(12_650, 0);
    expect(t.grand).toBeCloseTo(127_650, 0);
  });

  it('empty items returns zero grand total', () => {
    expect(projectTotal([], { markupPct: 10, contingencyPct: 5, ppnPct: 11 }).grand).toBe(0);
  });
});

describe('SPI computation', () => {
  it('SPI = 1.0 when all items 100% complete', () => {
    expect(spi([{ plannedQty: 100, actualQty: 100, unitRate: 50 }])).toBe(1);
  });

  it('SPI = 0.5 when half complete', () => {
    expect(spi([{ plannedQty: 100, actualQty: 50, unitRate: 50 }])).toBe(0.5);
  });

  it('SPI clamps overdelivery to 100%', () => {
    expect(spi([{ plannedQty: 100, actualQty: 200, unitRate: 50 }])).toBe(1);
  });

  it('SPI = 0 when no plan', () => {
    expect(spi([{ plannedQty: 0, actualQty: 100, unitRate: 50 }])).toBe(0);
  });

  it('SPI weighted by item cost (matches demo LS 45 SPI 0.36)', () => {
    // Demo: 25,500 m³ actual on AHSP-1 (planned 39,802 × Rp 38,102)
    // SPI = (25,500 × 38,102) ÷ (39,802 × 38,102 + 26,895 × 30,379 + 21,551 × 18,588)
    // ≈ 0.355
    const items = [
      { plannedQty: 39802, actualQty: 25500, unitRate: 38102 },
      { plannedQty: 26895, actualQty: 0, unitRate: 30379 },
      { plannedQty: 21551, actualQty: 0, unitRate: 18588 },
    ];
    expect(spi(items)).toBeCloseTo(0.355, 2);
  });
});

describe('Geofence (haversine)', () => {
  it('zero distance for same point', () => {
    expect(geofenceDistanceM(-3.5, 121.5, -3.5, 121.5)).toBe(0);
  });

  it('distance Jakarta → Bandung ≈ 120 km', () => {
    const d = geofenceDistanceM(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(125_000);
  });

  it('isInsideGeofence true for point inside radius', () => {
    // Site at (-3.5, 121.5), radius 500m, check point 300m away
    const d = geofenceDistanceM(-3.5, 121.5, -3.5025, 121.5025); // ~370m
    expect(d).toBeLessThan(500);
    expect(isInsideGeofence(-3.5, 121.5, 500, -3.5025, 121.5025)).toBe(true);
  });

  it('isInsideGeofence false for point outside radius', () => {
    expect(isInsideGeofence(-3.5, 121.5, 100, -3.51, 121.51)).toBe(false);
  });
});

describe('Plan quotas (matches live demo enforcement)', () => {
  it('trial blocks at 3 projects', () => {
    expect(checkProjectQuota('trial', 3)).toMatch(/Plan limit reached: 3 projects/);
    expect(checkProjectQuota('trial', 2)).toBe(null);
  });

  it('starter allows up to 10', () => {
    expect(checkProjectQuota('starter', 9)).toBe(null);
    expect(checkProjectQuota('starter', 10)).toMatch(/Plan limit reached: 10/);
  });

  it('pro allows up to 100 projects', () => {
    expect(checkProjectQuota('pro', 99)).toBe(null);
    expect(checkProjectQuota('pro', 100)).toMatch(/100 projects/);
  });

  it('enterprise has unlimited (sentinel -1)', () => {
    expect(PLAN_LIMITS.enterprise!.projects).toBe(-1);
    expect(PLAN_LIMITS.enterprise!.seats).toBe(-1);
    expect(checkProjectQuota('enterprise', 999_999)).toBe(null);
  });

  it('unknown plan defaults to trial limits', () => {
    expect(checkProjectQuota('unknown-plan', 3)).toMatch(/3 projects/);
  });

  it('seat quota matches plan', () => {
    expect(checkSeatQuota('trial', 5)).toMatch(/5 seats/);
    expect(checkSeatQuota('pro', 25)).toMatch(/25 seats/);
    expect(checkSeatQuota('pro', 24)).toBe(null);
  });
});
