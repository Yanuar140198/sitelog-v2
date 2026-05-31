'use client';
import { trpc } from '@sitelog/api-client/react';

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function SuperAdminDatabase() {
  const stats = trpc.admin.databaseStats.useQuery(undefined, { retry: false, refetchInterval: 10_000 });

  if (stats.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{stats.error.message}</div>;
  if (!stats.data) return <div className="font-mono text-xs text-white/60">Loading…</div>;

  const totalRows = stats.data.tables.reduce((s, t) => s + Number(t.rows ?? 0), 0);
  const totalConn = stats.data.connections.reduce((s, c) => s + c.n, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">OPS</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Database</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Live PostgreSQL stats. Auto-refresh 10s.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border-2 border-white/30 bg-black/50 p-4">
          <p className="font-mono text-[10px] tracking-wider text-[var(--color-brand)]">DATABASE SIZE</p>
          <p className="font-display text-3xl font-bold mt-1">{bytes(stats.data.databaseBytes)}</p>
        </div>
        <div className="border-2 border-white/30 bg-black/50 p-4">
          <p className="font-mono text-[10px] tracking-wider text-[var(--color-brand)]">TOTAL ROWS</p>
          <p className="font-display text-3xl font-bold mt-1">{totalRows.toLocaleString()}</p>
        </div>
        <div className="border-2 border-white/30 bg-black/50 p-4">
          <p className="font-mono text-[10px] tracking-wider text-[var(--color-brand)]">CONNECTIONS</p>
          <p className="font-display text-3xl font-bold mt-1">{totalConn}</p>
        </div>
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">CONNECTIONS BY STATE</h2>
        <table className="w-full font-mono text-xs">
          <tbody>
            {stats.data.connections.map((c, i) => (
              <tr key={i} className="border-t border-white/10">
                <td className="py-1">{c.state ?? '<idle>'}</td>
                <td className="text-right font-bold">{c.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">TOP 30 TABLES BY SIZE</h2>
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[560px]">
          <thead className="text-white/50"><tr>
            <th className="text-left py-1">TABLE</th>
            <th className="text-right">ROWS</th>
            <th className="text-right">TABLE SIZE</th>
            <th className="text-right">TOTAL (+INDEX)</th>
          </tr></thead>
          <tbody>
            {stats.data.tables.map(t => (
              <tr key={t.table_name} className="border-t border-white/10">
                <td className="py-1 text-[var(--color-brand)]">{t.table_name}</td>
                <td className="text-right">{Number(t.rows ?? 0).toLocaleString()}</td>
                <td className="text-right text-white/70">{bytes(Number(t.table_bytes))}</td>
                <td className="text-right font-bold">{bytes(Number(t.total_bytes))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
