import { describe, it, expect } from 'vitest';
import { evalFormula } from './formula.js';

describe('evalFormula', () => {
  it('basic arithmetic with precedence', () => {
    expect(evalFormula('2 + 3 * 4').value).toBe(14);
    expect(evalFormula('(2 + 3) * 4').value).toBe(20);
    expect(evalFormula('10 - 4 - 3').value).toBe(3);
  });

  it('multiplication/division notation (× ÷ and * /)', () => {
    expect(evalFormula('0.5 × 2').value).toBe(1);
    expect(evalFormula('6 ÷ 3').value).toBe(2);
    expect(evalFormula('0.5 * 2').value).toBe(1);
  });

  it('decimal comma or dot', () => {
    expect(evalFormula('0,5 × 4').value).toBe(2);
    expect(evalFormula('1,25 + 0,75').value).toBe(2);
  });

  it('division (reciprocal koefisien) + close-enough float', () => {
    expect(evalFormula('1 / (2.5 * 0.8)').value).toBeCloseTo(0.5, 9);
    expect(evalFormula('1 / 7.5').value).toBeCloseTo(0.13333333, 6);
  });

  it('unary minus + parentheses', () => {
    expect(evalFormula('-3 + 5').value).toBe(2);
    expect(evalFormula('-(2 + 3)').value).toBe(-5);
    expect(evalFormula('2 * -3').value).toBe(-6);
  });

  it('resolves variables from context', () => {
    expect(evalFormula('1 / Q1', { Q1: 8 }).value).toBe(0.125);
    expect(evalFormula('n × eff', { n: 2, eff: 0.85 }).value).toBeCloseTo(1.7, 9);
    expect(evalFormula('1 / (Cap * Eff * 60 / Cycle)', { Cap: 1.2, Eff: 0.8, Cycle: 24 }).value).toBeCloseTo(0.416667, 5);
  });

  it('reports a clear error for unknown variable', () => {
    const r = evalFormula('1 / Qx', { Q1: 8 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Qx/);
  });

  it('rejects division by zero', () => {
    const r = evalFormula('5 / 0');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nol/i);
  });

  it('rejects malformed input (never throws)', () => {
    for (const bad of ['', '   ', '2 +', '(2 + 3', '2 3', '* 5', 'a b c']) {
      const r = evalFormula(bad);
      expect(r.ok).toBe(false);
      expect(typeof r.error).toBe('string');
    }
  });

  it('rejects unsafe input (no code execution)', () => {
    const r = evalFormula('process.exit(1)');
    expect(r.ok).toBe(false); // `process` is an unknown variable, `.` not a number → parse error
  });
});
