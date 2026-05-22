'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';

export default function AhspUsageStatsPage() {
  const stats = trpc.ahsp.usageStats.useQuery();
  const catalog = trpc.ahsp.catalog.useQuery();
  const [expandNeverUsed, setExpandNeverUsed] = useState(false);

  const neverUsedList = useMemo(() => {
    if (!stats.data || !catalog.data) return [];
    const usedIds = new Set(stats.data.topUsed.map(t => t.id));
    // Compute from catalog: items not in topUsed AND usedInProjects=0 from stats summary aren't directly
    // available, so derive: catalog items minus those with any usage. Use stats.topUsed only filters TOP
    // — instead reconstruct by checking which catalog items appear with 0 usage. We don't have per-item
    // usage outside topUsed, so fall back to "items not in topUsed when neverUsed > 0 + topUsed is < total"
    // For a useful list we re-derive by checking topUsed ranking.
    const allCount = stats.data.totalItems;
    const usedAny = stats.data.topUsed.filter(t => t.usedInProjects > 0).length;
    if (allCount - usedAny <= 0) return [];
    return catalog.data
      .filter(c => !stats.data!.topUsed.some(t => t.id === c.id && t.usedInProjects > 0))
      .slice(0, 200);
  }, [stats.data, catalog.data]);

  if (!stats.data) {
    return <div className="p-8 font-mono text-xs">Loading…</div>;
  }
  const { topUsed, neverUsed, byCategory, totalItems, totalCustom, totalGlobal } = stats.data;

  const maxBar = Math.max(1, ...byCategory.map(c => c.count));

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · USAGE</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP Usage Statistics</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">Which items power your BOQs, and which can be archived.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="TOTAL ITEMS" value={totalItems} accent="ink" />
        <Kpi label="CUSTOM" value={totalCustom} accent="brand" />
        <Kpi label="GLOBAL" value={totalGlobal} accent="ink" />
        <Kpi label="NEVER USED" value={neverUsed} accent={neverUsed > 0 ? 'danger' : 'ink'} />
      </div>

      {/* By Category */}
      <Section title="BY CATEGORY">
        <div className="p-4 space-y-2">
          {byCategory.length === 0 && <div className="font-mono text-xs text-neutral-500">No categorization data.</div>}
          {byCategory.map(c => (
            <div key={c.section} className="flex items-center gap-3 font-mono text-xs">
              <div className="w-48 truncate">{c.section}</div>
              <div className="flex-1 h-5 bg-neutral-100 relative">
                <div
                  className="h-full bg-[var(--color-brand)]"
                  style={{ width: `${(c.count / maxBar) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right font-bold">{c.count}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top 20 used */}
      <Section title="TOP 20 USED">
        {topUsed.filter(t => t.usedInProjects > 0).length === 0 ? (
          <div className="p-6 font-mono text-xs text-neutral-500 text-center">No AHSP items are referenced by any BOQ yet.</div>
        ) : (
          <table className="w-full font-mono text-xs">
            <thead className="bg-[var(--color-ink)] text-white">
              <tr>
                <th className="text-left px-3 py-2 tracking-wider w-12">RANK</th>
                <th className="text-left px-3 py-2 tracking-wider">KODE</th>
                <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                <th className="text-left px-3 py-2 tracking-wider">SECTION</th>
                <th className="text-right px-3 py-2 tracking-wider w-32">PROJECTS</th>
              </tr>
            </thead>
            <tbody>
              {topUsed.filter(t => t.usedInProjects > 0).map((t, i) => (
                <tr key={t.id} className="border-b border-neutral-100">
                  <td className="px-3 py-2 text-neutral-400">#{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-[var(--color-brand)]">
                    <Link href={`/app/ahsp/${t.id}` as any} className="hover:underline">{t.kode}</Link>
                  </td>
                  <td className="px-3 py-2">{t.jenis}</td>
                  <td className="px-3 py-2 text-neutral-500">{t.section ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-bold">{t.usedInProjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Never used */}
      <Section title={`NEVER USED (${neverUsed})`}>
        <div className="p-4">
          {neverUsed === 0 ? (
            <div className="font-mono text-xs text-neutral-500">All AHSP items have been used in at least one project.</div>
          ) : (
            <>
              <button
                onClick={() => setExpandNeverUsed(v => !v)}
                className="inline-flex items-center gap-2 font-mono text-xs hover:text-[var(--color-brand)] mb-3"
              >
                {expandNeverUsed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {expandNeverUsed ? 'HIDE' : 'SHOW'} LIST
              </button>
              {expandNeverUsed && (
                <>
                  <p className="font-mono text-[11px] text-neutral-500 mb-2">
                    Suggestion: consider archiving items that are never used to keep the catalog clean.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto">
                    {neverUsedList.map(it => (
                      <Link
                        key={it.id}
                        href={`/app/ahsp/${it.id}` as any}
                        className="block border border-neutral-300 p-2 font-mono text-xs hover:border-[var(--color-brand)]"
                      >
                        <strong className="text-[var(--color-brand)]">{it.kode}</strong>
                        <span className="ml-2 text-neutral-700">{it.jenis}</span>
                        <span className="ml-2 text-neutral-400">· {it.satuan}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: 'ink' | 'brand' | 'danger' }) {
  const color =
    accent === 'brand' ? 'text-[var(--color-brand)]' :
    accent === 'danger' ? 'text-red-600' : 'text-[var(--color-ink)]';
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white p-4 shadow-[4px_4px_0_var(--color-brand)]">
      <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">{label}</div>
      <div className={`font-display text-4xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      {children}
    </div>
  );
}
