import { describe, it, expect } from 'vitest';
import {
  ahspBaselineRate, itemSubtotal, projectTotal, spi,
  geofenceDistanceM, isInsideGeofence,
  checkProjectQuota, checkSeatQuota, getPlanLimits,
} from './boq-math.js';

describe('Edge cases — empty + zero inputs', () => {
  it('ahspBaselineRate returns 0 for empty resources', () => {
    expect(ahspBaselineRate([])).toBe(0);
  });

  it('ahspBaselineRate handles single resource with 0 koef', () => {
    expect(ahspBaselineRate([{ koefisien: 0, hsd: 100000 }])).toBe(0);
  });

  it('itemSubtotal handles 0 quantity', () => {
    expect(itemSubtotal({ quantity: 0, unitRateOverride: 1000 })).toBe(0);
  });

  it('projectTotal with 0% PPN returns subtotal as grand', () => {
    const items = [{ quantity: 100, unitRateOverride: 1000 }];
    const t = projectTotal(items, { markupPct: 0, contingencyPct: 0, ppnPct: 0 });
    expect(t.grand).toBe(t.subtotal);
    expect(t.ppn).toBe(0);
  });

  it('projectTotal with negative markup is mathematically allowed (discount)', () => {
    const t = projectTotal([{ quantity: 100, unitRateOverride: 1000 }], { markupPct: -10, contingencyPct: 0, ppnPct: 11 });
    expect(t.subtotal).toBe(100_000);
    expect(t.markup).toBe(-10_000);
    expect(t.prePpn).toBe(90_000);
  });
});

describe('Edge cases — SPI extremes', () => {
  it('SPI returns 0 for empty items', () => {
    expect(spi([])).toBe(0);
  });

  it('SPI handles mixed completion', () => {
    const items = [
      { plannedQty: 100, actualQty: 100, unitRate: 1 },
      { plannedQty: 100, actualQty: 50, unitRate: 1 },
      { plannedQty: 100, actualQty: 0, unitRate: 1 },
    ];
    expect(spi(items)).toBeCloseTo(0.5, 2);
  });

  it('SPI weights expensive items more', () => {
    const items = [
      { plannedQty: 1, actualQty: 1, unitRate: 1 },         // tiny cheap item
      { plannedQty: 100, actualQty: 0, unitRate: 100_000 }, // expensive untouched
    ];
    expect(spi(items)).toBeLessThan(0.001);  // weighted by cost
  });
});

describe('Edge cases — geofence', () => {
  it('distance handles antipodal points (~20,000 km)', () => {
    const d = geofenceDistanceM(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19_000_000);
    expect(d).toBeLessThan(21_000_000);
  });

  it('distance handles polar points', () => {
    const d = geofenceDistanceM(90, 0, -90, 0);
    expect(d).toBeGreaterThan(19_000_000);
  });

  it('isInsideGeofence true for exact center', () => {
    expect(isInsideGeofence(-3.5, 121.5, 100, -3.5, 121.5)).toBe(true);
  });

  it('isInsideGeofence handles southern hemisphere correctly', () => {
    expect(isInsideGeofence(-6.2, 106.8, 500, -6.201, 106.801)).toBe(true);
  });
});

describe('Edge cases — plan quotas', () => {
  it('unlimited plan accepts any count (Number.MAX_SAFE_INTEGER)', () => {
    expect(checkProjectQuota('enterprise', Number.MAX_SAFE_INTEGER)).toBe(null);
    expect(checkSeatQuota('enterprise', Number.MAX_SAFE_INTEGER)).toBe(null);
  });

  it('getPlanLimits exposes storageGb + aiCallsPerMonth', () => {
    const trial = getPlanLimits('trial');
    expect(trial.storageGb).toBe(1);
    expect(trial.aiCallsPerMonth).toBe(50);
    const pro = getPlanLimits('pro');
    expect(pro.storageGb).toBe(100);
    expect(pro.aiCallsPerMonth).toBe(5000);
  });

  it('quotas at boundary 0 with trial plan', () => {
    // Empty org with 0 projects → can create
    expect(checkProjectQuota('trial', 0)).toBe(null);
  });
});
