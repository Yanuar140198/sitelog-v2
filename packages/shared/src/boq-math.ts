/**
 * Pure BOQ math — extracted from router/lib for unit testing.
 * Single source of truth for: resource cost, item subtotal, project grand total.
 */

export interface ResourceLine {
  koefisien: number;
  hsd: number;
}

export interface BoqItemInput {
  quantity: number;
  unitRateOverride?: number | null;
  resources?: ResourceLine[];
}

export interface ProjectMargins {
  markupPct: number;
  contingencyPct: number;
  ppnPct: number;
}

export function resourceLineCost(r: ResourceLine): number {
  return r.koefisien * r.hsd;
}

export function ahspBaselineRate(resources: ResourceLine[]): number {
  return resources.reduce((sum, r) => sum + resourceLineCost(r), 0);
}

export function itemUnitRate(item: BoqItemInput): number {
  if (item.unitRateOverride != null && item.unitRateOverride > 0) return item.unitRateOverride;
  return ahspBaselineRate(item.resources ?? []);
}

export function itemSubtotal(item: BoqItemInput): number {
  return item.quantity * itemUnitRate(item);
}

export interface ProjectTotal {
  subtotal: number;
  markup: number;
  contingency: number;
  prePpn: number;
  ppn: number;
  grand: number;
}

export function projectTotal(items: BoqItemInput[], margins: ProjectMargins): ProjectTotal {
  const subtotal = items.reduce((sum, i) => sum + itemSubtotal(i), 0);
  const markup = subtotal * margins.markupPct / 100;
  const contingency = subtotal * margins.contingencyPct / 100;
  const prePpn = subtotal + markup + contingency;
  const ppn = prePpn * margins.ppnPct / 100;
  return { subtotal, markup, contingency, prePpn, ppn, grand: prePpn + ppn };
}

/**
 * SPI = earned / planned (schedule performance index).
 * earned = sum over items of min(actual/plan, 1) × planned_cost
 */
export function spi(items: Array<{ plannedQty: number; actualQty: number; unitRate: number }>): number {
  const planned = items.reduce((s, i) => s + i.plannedQty * i.unitRate, 0);
  if (planned <= 0) return 0;
  const earned = items.reduce((s, i) => {
    const pct = i.plannedQty > 0 ? Math.min(1, i.actualQty / i.plannedQty) : 0;
    return s + pct * i.plannedQty * i.unitRate;
  }, 0);
  return earned / planned;
}

/**
 * Haversine geofence check — meters between two GPS points.
 */
export function geofenceDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // earth radius m
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isInsideGeofence(siteLat: number, siteLng: number, radiusM: number, lat: number, lng: number): boolean {
  return geofenceDistanceM(siteLat, siteLng, lat, lng) <= radiusM;
}

/**
 * Plan quota limits — single source of truth.
 *
 * `-1` = unlimited (used for DB checks rather than Infinity for serialization).
 */
export interface PlanLimits {
  projects: number;
  seats: number;
  storageGb: number;
  aiCallsPerMonth: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial:      { projects: 3,   seats: 5,  storageGb: 1,   aiCallsPerMonth: 50 },
  starter:    { projects: 10,  seats: 5,  storageGb: 10,  aiCallsPerMonth: 500 },
  pro:        { projects: 100, seats: 25, storageGb: 100, aiCallsPerMonth: 5000 },
  enterprise: { projects: -1,  seats: -1, storageGb: -1,  aiCallsPerMonth: -1 },
};

export type PlanTier = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial!;
}

export function checkProjectQuota(plan: string, currentCount: number): string | null {
  const max = getPlanLimits(plan).projects;
  if (max === -1) return null;
  if (currentCount >= max) {
    return `Plan limit reached: ${max} projects max. Upgrade to add more.`;
  }
  return null;
}

export function checkSeatQuota(plan: string, currentCount: number): string | null {
  const max = getPlanLimits(plan).seats;
  if (max === -1) return null;
  if (currentCount >= max) {
    return `Plan limit reached: ${max} seats max. Upgrade to add more.`;
  }
  return null;
}

/** @deprecated use checkSeatQuota — kept for backward compat with old tests */
export const checkMemberQuota = checkSeatQuota;
