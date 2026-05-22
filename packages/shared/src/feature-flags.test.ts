import { describe, it, expect } from 'vitest';
import { evaluateFlag } from './feature-flags.js';

describe('Feature flag resolution', () => {
  it('override true beats everything', () => {
    expect(evaluateFlag({ enabledGlobally: false, rolloutPct: 0 }, 'org-a', true)).toBe(true);
  });

  it('override false beats everything', () => {
    expect(evaluateFlag({ enabledGlobally: true, rolloutPct: 100 }, 'org-a', false)).toBe(false);
  });

  it('global enabled returns true when no override', () => {
    expect(evaluateFlag({ enabledGlobally: true, rolloutPct: 0 }, 'org-a')).toBe(true);
  });

  it('global disabled + 0% rollout returns false', () => {
    expect(evaluateFlag({ enabledGlobally: false, rolloutPct: 0 }, 'org-a')).toBe(false);
  });

  it('100% rollout returns true even when global disabled', () => {
    expect(evaluateFlag({ enabledGlobally: false, rolloutPct: 100 }, 'org-a')).toBe(true);
  });

  it('rollout is deterministic per org', () => {
    const state = { enabledGlobally: false, rolloutPct: 50 };
    const a = evaluateFlag(state, 'org-deterministic-test');
    const b = evaluateFlag(state, 'org-deterministic-test');
    const c = evaluateFlag(state, 'org-deterministic-test');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different orgs get different buckets across 50% rollout', () => {
    const state = { enabledGlobally: false, rolloutPct: 50 };
    const results = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
      .map(id => evaluateFlag(state, id));
    const trues = results.filter(Boolean).length;
    // 10 samples not statistically tight but should split somewhat
    expect(trues).toBeGreaterThanOrEqual(2);
    expect(trues).toBeLessThanOrEqual(8);
  });

  it('rollout 1% includes very few orgs', () => {
    const state = { enabledGlobally: false, rolloutPct: 1 };
    let trues = 0;
    for (let i = 0; i < 1000; i++) {
      if (evaluateFlag(state, `org-${i}`)) trues++;
    }
    // Statistically ~10 ± significant
    expect(trues).toBeLessThan(50);
  });
});
