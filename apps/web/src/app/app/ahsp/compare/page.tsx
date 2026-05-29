'use client';
import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { fmtIDR } from '@/lib/utils';
import { ArrowLeft, X, Plus } from 'lucide-react';

type Cat = 'tenaga' | 'bahan' | 'peralatan';
const SECTIONS: Array<{ key: Cat; letter: string; title: string }> = [
  { key: 'tenaga',    letter: 'A', title: 'TENAGA' },
  { key: 'bahan',     letter: 'B', title: 'BAHAN' },
  { key: 'peralatan', letter: 'C', title: 'PERALATAN' },
];

function CompareInner() {
  const params = useSearchParams();
  const initialIds = useMemo(() => {
    const raw = params.get('ids') ?? '';
    return raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
  }, [params]);

  const [ids, setIds] = useState<string[]>(initialIds);
  const [search, setSearch] = useState('');

  // Keep URL in sync (replaceState — no page reload, no router rerender storm)
  useEffect(() => {
    const qs = ids.length ? `?ids=${ids.join(',')}` : '';
    window.history.replaceState(null, '', `/app/ahsp/compare${qs}`);
  }, [ids]);

  const catalog = trpc.ahsp.catalog.useQuery();
  const compare = trpc.ahsp.compare.useQuery(
    { ids },
    { enabled: ids.length >= 2 && ids.length <= 4 },
  );

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !catalog.data) return [];
    return catalog.data
      .filter(it => !ids.includes(it.id))
      .filter(it =>
        it.kode.toLowerCase().includes(q) ||
        it.jenis.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, catalog.data, ids]);

  function addId(id: string) {
    if (ids.length >= 4 || ids.includes(id)) return;
    setIds([...ids, id]);
    setSearch('');
  }
  function removeId(id: string) {
    setIds(ids.filter(x => x !== id));
  }

  // Build aligned resource matrix once data ready
  const matrix = useMemo(() => {
    if (!compare.data) return null;
    const cols = compare.data;
    const allKeys = new Map<string, { kode: string; uraian: string; satuan: string | null; category: Cat }>();
    for (const col of cols) {
      for (const r of col.resources) {
        if (!allKeys.has(r.kode)) {
          allKeys.set(r.kode, { kode: r.kode, uraian: r.uraian, satuan: r.satuan, category: r.category as Cat });
        }
      }
    }
    const lookup = cols.map(col => {
      const m = new Map<string, typeof col.resources[number]>();
      for (const r of col.resources) m.set(r.kode, r);
      return m;
    });

    const bySection: Record<Cat, Array<{ kode: string; uraian: string; satuan: string | null }>> = {
      tenaga: [], bahan: [], peralatan: [],
    };
    for (const v of allKeys.values()) {
      bySection[v.category].push({ kode: v.kode, uraian: v.uraian, satuan: v.satuan });
    }
    for (const k of Object.keys(bySection) as Cat[]) {
      bySection[k].sort((a, b) => a.kode.localeCompare(b.kode));
    }

    // Grand totals: cheapest (green) & most expensive (red) column
    const grands = cols.map(c => c.sectionTotals.grand);
    const cheapest = Math.min(...grands.filter(v => v > 0));
    const expensive = Math.max(...grands);

    return { cols, lookup, bySection, cheapest, expensive };
  }, [compare.data]);

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · COMPARE</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP Comparison</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">Pick 2-4 AHSP items to align resources & rates side by side.</p>
      </div>

      {/* Picker */}
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">SELECTED ({ids.length}/4)</div>
        <div className="p-4 space-y-3">
          {ids.length === 0 && (
            <div className="text-neutral-500 font-mono text-xs">No items selected. Search below to add.</div>
          )}
          <div className="flex flex-wrap gap-2">
            {ids.map((id, idx) => {
              const col = compare.data?.[idx];
              const meta = catalog.data?.find(c => c.id === id);
              const label = col?.item.kode ?? meta?.kode ?? id.slice(0, 8);
              const jenis = col?.item.jenis ?? meta?.jenis ?? '';
              return (
                <div key={id} className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)] bg-white px-3 py-1.5 font-mono text-xs shadow-[3px_3px_0_var(--color-brand)]">
                  <strong className="text-[var(--color-brand)]">{label}</strong>
                  <span className="text-neutral-600 max-w-[280px] truncate">{jenis}</span>
                  <button onClick={() => removeId(id)} className="text-red-600 hover:bg-red-50 p-0.5"><X size={12} /></button>
                </div>
              );
            })}
          </div>

          {ids.length < 4 && (
            <div className="relative max-w-xl">
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-neutral-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by kode or jenis to add…"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 border-2 border-[var(--color-ink)] bg-white max-h-64 overflow-auto shadow-[4px_4px_0_var(--color-brand)]">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => addId(s.id)}
                      className="w-full text-left px-3 py-2 font-mono text-xs hover:bg-neutral-100 border-b border-neutral-100"
                    >
                      <strong className="text-[var(--color-brand)]">{s.kode}</strong>
                      <span className="ml-2 text-neutral-700">{s.jenis}</span>
                      <span className="ml-2 text-neutral-400">· {s.satuan}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compare grid */}
      {ids.length < 2 && (
        <div className="border-2 border-dashed border-neutral-300 p-12 text-center font-mono text-xs text-neutral-500">
          Select at least 2 AHSP items to compare.
        </div>
      )}

      {ids.length >= 2 && compare.isLoading && (
        <div className="p-8 font-mono text-xs text-neutral-500">Loading comparison…</div>
      )}

      {matrix && (
        <div className="border-2 border-[var(--color-ink)] bg-white overflow-auto">
          <table className="w-full font-mono text-xs">
            <thead className="bg-[var(--color-ink)] text-white">
              <tr>
                <th className="text-left px-3 py-2 tracking-wider sticky left-0 bg-[var(--color-ink)] z-10 min-w-[260px]">RESOURCE</th>
                {matrix.cols.map(c => (
                  <th key={c.item.id} className="text-right px-3 py-2 tracking-wider min-w-[180px]">
                    <div className="text-[var(--color-brand)] font-bold">{c.item.kode}</div>
                  </th>
                ))}
              </tr>
              <tr className="bg-[var(--color-ink)]/90">
                <th className="text-left px-3 py-1.5 font-normal text-neutral-300 sticky left-0 bg-[var(--color-ink)]/90 z-10">JENIS</th>
                {matrix.cols.map(c => (
                  <th key={c.item.id} className="text-right px-3 py-1.5 font-normal text-neutral-200">{c.item.jenis}</th>
                ))}
              </tr>
              <tr className="bg-[var(--color-ink)]/80">
                <th className="text-left px-3 py-1.5 font-normal text-neutral-300 sticky left-0 bg-[var(--color-ink)]/80 z-10">SATUAN</th>
                {matrix.cols.map(c => (
                  <th key={c.item.id} className="text-right px-3 py-1.5 font-normal text-neutral-200">{c.item.satuan}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(sec => {
                const rows = matrix.bySection[sec.key];
                return (
                  <>
                    <tr key={`sec-${sec.key}`} className="bg-neutral-100">
                      <td colSpan={matrix.cols.length + 1} className="px-3 py-2 font-bold tracking-wider text-[var(--color-ink)]">
                        {sec.letter} · {sec.title}
                      </td>
                    </tr>
                    {rows.length === 0 && (
                      <tr key={`empty-${sec.key}`}>
                        <td colSpan={matrix.cols.length + 1} className="px-3 py-2 text-neutral-400 italic text-center">no resources in this section</td>
                      </tr>
                    )}
                    {rows.map(rk => (
                      <tr key={`${sec.key}-${rk.kode}`} className="border-b border-neutral-100">
                        <td className="px-3 py-2 sticky left-0 bg-white z-10">
                          <strong className="text-[var(--color-brand)]">{rk.kode}</strong>
                          <span className="ml-2 text-neutral-700">{rk.uraian}</span>
                          {rk.satuan ? <span className="ml-1 text-neutral-400">· {rk.satuan}</span> : null}
                        </td>
                        {matrix.lookup.map((m, idx) => {
                          const r = m.get(rk.kode);
                          if (!r) return <td key={idx} className="px-3 py-2 text-right text-neutral-300">—</td>;
                          return (
                            <td key={idx} className="px-3 py-2 text-right">
                              <div>{fmtIDR(r.subtotal)}</div>
                              <div className="text-[10px] text-neutral-400">{r.koefisien} × {fmtIDR(r.hsd)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      <td className="px-3 py-2 sticky left-0 bg-neutral-50 z-10 font-bold">SUBTOTAL {sec.letter}</td>
                      {matrix.cols.map(c => (
                        <td key={c.item.id} className="px-3 py-2 text-right font-bold">
                          {fmtIDR(c.sectionTotals[sec.key])}
                        </td>
                      ))}
                    </tr>
                  </>
                );
              })}

              <tr className="bg-neutral-50">
                <td className="px-3 py-2 sticky left-0 bg-neutral-50 z-10 font-bold">OHP</td>
                {matrix.cols.map(c => (
                  <td key={c.item.id} className="px-3 py-2 text-right">
                    {fmtIDR(c.sectionTotals.ohp)}
                    <span className="ml-2 text-neutral-400 text-[10px]">{c.item.ohpPct}%</span>
                  </td>
                ))}
              </tr>
              <tr className="bg-[var(--color-ink)] text-white">
                <td className="px-3 py-3 sticky left-0 bg-[var(--color-ink)] z-10 font-bold tracking-wider">GRAND TOTAL</td>
                {matrix.cols.map(c => {
                  const isCheap = c.sectionTotals.grand === matrix.cheapest && matrix.cheapest > 0;
                  const isExp = c.sectionTotals.grand === matrix.expensive && matrix.expensive !== matrix.cheapest;
                  const color = isCheap ? 'bg-green-500 text-white' : isExp ? 'bg-red-500 text-white' : '';
                  return (
                    <td key={c.item.id} className={`px-3 py-3 text-right font-bold text-base ${color}`}>
                      {fmtIDR(c.sectionTotals.grand)}
                      {isCheap && <div className="text-[10px] font-normal">CHEAPEST</div>}
                      {isExp && <div className="text-[10px] font-normal">MOST EXPENSIVE</div>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AhspComparePage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading…</div>}>
      <CompareInner />
    </Suspense>
  );
}
