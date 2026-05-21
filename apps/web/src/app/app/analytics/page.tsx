'use client';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';

export default function AnalyticsPage() {
  const portfolio = trpc.dashboard.portfolio.useQuery();
  const rows = portfolio.data ?? [];

  const totalPlan = rows.reduce((a, p) => a + p.grandTotal, 0);
  const totalEarned = rows.reduce((a, p) => a + p.earnedValue, 0);
  const avgSpi = rows.length ? rows.reduce((a, p) => a + p.spi, 0) / rows.length : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">INSIGHTS</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Analytics</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="TOTAL PLANNED VALUE" value={fmtIDR(totalPlan)} />
        <Kpi label="EARNED VALUE" value={fmtIDR(totalEarned)} />
        <Kpi label="AVG SPI" value={avgSpi ? avgSpi.toFixed(2) : '—'} highlight={avgSpi >= 1} />
      </div>

      <section className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">PROJECT PERFORMANCE</div>
        <div className="p-5 space-y-4">
          {rows.map(p => {
            const pct = p.grandTotal > 0 ? (p.earnedValue / p.grandTotal) * 100 : 0;
            return (
              <div key={p.id}>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <div><strong className="text-[var(--color-brand)]">{p.code}</strong> {p.name}</div>
                  <div className="flex gap-4">
                    <span>SPI <strong>{p.spi ? p.spi.toFixed(2) : '—'}</strong></span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-3 bg-neutral-200 border border-[var(--color-ink)]">
                  <div className="h-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 font-mono text-sm">No data yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border-2 border-[var(--color-ink)] p-5 ${highlight ? 'bg-[var(--color-brand)] text-white' : 'bg-white'}`}>
      <div className="font-mono text-[10px] tracking-[0.2em] opacity-70">{label}</div>
      <div className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</div>
    </div>
  );
}
