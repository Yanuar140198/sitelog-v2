/**
 * Pure feature flag evaluation. DB lookup happens at caller; this just decides:
 * given the global flag state + optional org override + orgId hash, is the flag on?
 *
 * Resolution order (first match wins):
 *   1. Per-org override (if present)
 *   2. Percentage rollout based on org-id hash (deterministic per org)
 *   3. Global enabled flag
 */

export interface FlagState {
  enabledGlobally: boolean;
  rolloutPct: number;  // 0-100
}

export function evaluateFlag(state: FlagState, orgId: string, overrideEnabled: boolean | null = null): boolean {
  if (overrideEnabled !== null) return overrideEnabled;
  if (state.enabledGlobally) return true;
  if (state.rolloutPct <= 0) return false;
  if (state.rolloutPct >= 100) return true;
  // Deterministic bucket per org-id — same org gets same answer.
  const hash = hashString(orgId);
  return (hash % 100) < state.rolloutPct;
}

function hashString(s: string): number {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
