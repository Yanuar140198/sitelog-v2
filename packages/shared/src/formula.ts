/**
 * Safe arithmetic formula evaluator for AHSP koefisien.
 *
 * Lets a coefficient be entered as a formula whose basis is explicit, e.g.
 *   "0,5 × 2"            → 1
 *   "1 / (2.5 * 0.8)"    → 0.5
 *   "1 / Q1"             → 1 / value-of-Q1
 *
 * Supports: numbers (`.` or `,` decimal), `+ - * / × ÷`, parentheses, unary minus,
 * and variables resolved from a context (e.g. AHSP input parameters Q1, n, eff).
 * No eval/Function — a hand-written tokenizer + recursive-descent parser, so it is
 * safe to run on user input.
 */

export interface FormulaResult {
  ok: boolean;
  value: number;
  error?: string;
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'id'; v: string };

function tokenize(input: string): Tok[] {
  const s = input.replace(/×/g, '*').replace(/÷/g, '/');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') { toks.push({ t: 'op', v: c }); i++; continue; }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j]!)) j++;
      const raw = s.slice(i, j).replace(/,/g, '.');
      const n = Number(raw);
      if (!isFinite(n)) throw new Error(`Angka tidak valid: "${s.slice(i, j)}"`);
      toks.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) j++;
      toks.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Karakter tidak dikenal: "${c}"`);
  }
  return toks;
}

export function evalFormula(expr: string, vars: Record<string, number> = {}): FormulaResult {
  if (!expr || !expr.trim()) return { ok: false, value: 0, error: 'Formula kosong' };
  let toks: Tok[];
  try { toks = tokenize(expr); } catch (e: any) { return { ok: false, value: 0, error: e.message }; }
  if (toks.length === 0) return { ok: false, value: 0, error: 'Formula kosong' };

  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  // expr := term (('+'|'-') term)*
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() && peek()!.t === 'op' && ((peek() as any).v === '+' || (peek() as any).v === '-')) {
      const op = (next() as any).v as '+' | '-';
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  // term := factor (('*'|'/') factor)*
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() && peek()!.t === 'op' && ((peek() as any).v === '*' || (peek() as any).v === '/')) {
      const op = (next() as any).v as '*' | '/';
      const r = parseFactor();
      if (op === '/') {
        if (r === 0) throw new Error('Pembagian dengan nol');
        v = v / r;
      } else { v = v * r; }
    }
    return v;
  }
  // factor := '-' factor | number | id | '(' expr ')'
  function parseFactor(): number {
    const tk = peek();
    if (!tk) throw new Error('Formula tidak lengkap');
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
      next();
      const f = parseFactor();
      return tk.v === '-' ? -f : f;
    }
    if (tk.t === 'num') { next(); return tk.v; }
    if (tk.t === 'id') {
      next();
      if (!(tk.v in vars)) throw new Error(`Variabel "${tk.v}" tidak ada`);
      const val = vars[tk.v];
      if (typeof val !== 'number' || !isFinite(val)) throw new Error(`Variabel "${tk.v}" bukan angka`);
      return val;
    }
    if (tk.t === 'lp') {
      next();
      const v = parseExpr();
      if (!peek() || peek()!.t !== 'rp') throw new Error('Kurung tutup ")" hilang');
      next();
      return v;
    }
    throw new Error('Formula tidak valid');
  }

  try {
    const value = parseExpr();
    if (p !== toks.length) return { ok: false, value: 0, error: 'Ada token tersisa di akhir formula' };
    if (!isFinite(value)) return { ok: false, value: 0, error: 'Hasil tidak terhingga' };
    return { ok: true, value };
  } catch (e: any) {
    return { ok: false, value: 0, error: e.message ?? 'Formula tidak valid' };
  }
}
