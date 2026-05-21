import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtIDR(n: number, opts: { decimals?: number; prefix?: boolean } = {}) {
  const { decimals = 0, prefix = true } = opts;
  const s = n.toLocaleString('id-ID', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  return prefix ? `Rp ${s}` : s;
}

export function fmtCurrency(n: number, currency = 'IDR', locale = 'id-ID', decimals = 0): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: decimals }).format(n);
  } catch { return `${currency} ${n.toLocaleString(locale)}`; }
}

export function fmtNum(n: number, decimals = 2) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: decimals });
}
