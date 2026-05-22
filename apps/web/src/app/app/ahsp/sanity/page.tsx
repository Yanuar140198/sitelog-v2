'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';

type Severity = 'critical' | 'warning' | 'info';
const SEVERITY_FILTERS: Array<{ key: 'all' | Severity; label: string }> = [
  { key: 'all',      label: 'ALL' },
  { key: 'critical', label: 'CRITICAL' },
  { key: 'warning',  label: 'WARNING' },
  { key: 'info',     label: 'INFO' },
];

const ISSUE_TYPE_TITLES: Record<string, string> = {
  zero_rate:                    'Zero Unit Rate',
  missing_resources:            'Missing Resources',
  outlier_hsd:                  'Outlier HSD',
  missing_koefisien_for_input:  'Missing Koefisien for Input',
  orphan_resource_in_master:    'Orphan Resource (not in Master)',
  duplicate_kode:               'Duplicate Kode',
};

export default function AhspSanityCheckPage() {
  const issues = trpc.ahsp.sanityCheck.useQuery();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!issues.data) return [];
    return filter === 'all' ? issues.data : issues.data.filter(i => i.severity === filter);
  }, [issues.data, filter]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const it of filtered) {
      const list = m.get(it.issueType) ?? [];
      list.push(it);
      m.set(it.issueType, list);
    }
    return Array.from(m.entries())
      .map(([type, items]) => ({ type, items }))
      .sort((a, b) => severityOrder(a.items[0]!.severity) - severityOrder(b.items[0]!.severity));
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: 0, critical: 0, warning: 0, info: 0 };
    for (const i of issues.data ?? []) {
      c.all++;
      c[i.severity]++;
    }
    return c;
  }, [issues.data]);

  if (!issues.data) return <div className="p-8 font-mono text-xs">Loading…</div>;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · SANITY CHECK</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP Quality Check</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {counts.all} total issue{counts.all === 1 ? '' : 's'}
            {' · '}
            <span className="text-red-600">{counts.critical} critical</span>
            {' · '}
            <span className="text-amber-600">{counts.warning} warning</span>
            {' · '}
            <span className="text-neutral-500">{counts.info} info</span>
          </p>
        </div>
      </div>

      {/* Severity filter chips */}
      <div className="flex flex-wrap gap-2">
        {SEVERITY_FILTERS.map(s => {
          const active = filter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-3 py-1.5 border-2 font-mono text-xs tracking-wider transition ${
                active
                  ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                  : 'bg-white text-[var(--color-ink)] border-[var(--color-ink)] hover:bg-neutral-100'
              }`}
            >
              {s.label} ({counts[s.key]})
            </button>
          );
        })}
      </div>

      {counts.all === 0 && (
        <div className="border-2 border-green-500 bg-green-50 p-8 text-center font-mono text-xs">
          <div className="font-bold text-green-700">No issues detected.</div>
          <div className="text-neutral-600 mt-1">Your AHSP catalog is healthy.</div>
        </div>
      )}

      {grouped.map(g => {
        const isCollapsed = collapsed[g.type];
        const sevSample = g.items[0]!.severity;
        return (
          <div key={g.type} className="border-2 border-[var(--color-ink)] bg-white">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [g.type]: !p[g.type] }))}
              className="w-full px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex items-center justify-between hover:bg-[var(--color-brand)]"
            >
              <span className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <SeverityBadge severity={sevSample} />
                {ISSUE_TYPE_TITLES[g.type] ?? g.type}
                <span className="text-neutral-300">({g.items.length})</span>
              </span>
            </button>
            {!isCollapsed && (
              <table className="w-full font-mono text-xs">
                <thead className="bg-neutral-100 text-neutral-700">
                  <tr>
                    <th className="text-left px-3 py-2 tracking-wider w-32">KODE</th>
                    <th className="text-left px-3 py-2 tracking-wider">MESSAGE</th>
                    <th className="text-right px-3 py-2 tracking-wider w-32">COMPUTED</th>
                    <th className="text-right px-3 py-2 tracking-wider w-40">EXPECTED</th>
                    <th className="text-right px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((i, idx) => (
                    <tr key={`${i.ahspItemId}-${idx}`} className="border-b border-neutral-100">
                      <td className="px-3 py-2">
                        <Link href={`/app/ahsp/${i.ahspItemId}` as any} className="font-bold text-[var(--color-brand)] hover:underline">
                          {i.kode}
                        </Link>
                        <div className="text-neutral-500 text-[11px] truncate max-w-[160px]">{i.jenis}</div>
                      </td>
                      <td className="px-3 py-2">{i.message}</td>
                      <td className="px-3 py-2 text-right text-neutral-600">
                        {i.computedValue != null ? i.computedValue.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-500 text-[11px]">{i.expectedRange ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/app/ahsp/${i.ahspItemId}` as any}><Button size="sm">FIX</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === 'critical') return <AlertCircle size={14} className="text-red-400" />;
  if (severity === 'warning') return <AlertTriangle size={14} className="text-amber-400" />;
  return <Info size={14} className="text-neutral-400" />;
}

function severityOrder(s: Severity): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
}
