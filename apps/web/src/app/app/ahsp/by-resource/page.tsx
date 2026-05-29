'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { fmtIDR, fmtNum } from '@/lib/utils';
import { ArrowLeft, Search, X, ExternalLink } from 'lucide-react';

type Cat = 'tenaga' | 'bahan' | 'peralatan';

function ByResourceInner() {
  const params = useSearchParams();

  const initialCode = params.get('resourceCode') ?? '';
  const initialCat = (params.get('category') as Cat | null) ?? '';

  const [selectedCode, setSelectedCode] = useState<string>(initialCode);
  const [selectedNama, setSelectedNama] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<Cat | ''>(initialCat as Cat | '');
  const [selectedHsd, setSelectedHsd] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // Sync URL
  useEffect(() => {
    const qs = new URLSearchParams();
    if (selectedCode) qs.set('resourceCode', selectedCode);
    if (selectedCategory) qs.set('category', selectedCategory);
    const s = qs.toString();
    window.history.replaceState(null, '', `/app/ahsp/by-resource${s ? `?${s}` : ''}`);
  }, [selectedCode, selectedCategory]);

  // Resource autocomplete (uses resourceMaster.list with q)
  const resources = trpc.resourceMaster.list.useQuery(
    { q: search.trim() || undefined },
    { enabled: open || !!search.trim() },
  );

  // Hydrate selected nama/hsd from full list when initial code came from URL
  const seedList = trpc.resourceMaster.list.useQuery({}, { enabled: !!selectedCode && !selectedNama });
  useEffect(() => {
    if (!seedList.data || !selectedCode || selectedNama) return;
    const hit = seedList.data.find(r => r.kode === selectedCode);
    if (hit) {
      setSelectedNama(hit.nama);
      setSelectedCategory(hit.category as Cat);
      setSelectedHsd(Number(hit.defaultHsd ?? 0));
    }
  }, [seedList.data, selectedCode, selectedNama]);

  const suggestions = useMemo(() => {
    if (!resources.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return resources.data.slice(0, 20);
    return resources.data
      .filter(r => r.kode.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q))
      .slice(0, 20);
  }, [resources.data, search]);

  const lookup = trpc.ahsp.byResource.useQuery(
    {
      resourceCode: selectedCode || undefined,
      category: (selectedCategory || undefined) as Cat | undefined,
    },
    { enabled: !!selectedCode },
  );

  function pickResource(r: { kode: string; nama: string; category: string; defaultHsd: string }) {
    setSelectedCode(r.kode);
    setSelectedNama(r.nama);
    setSelectedCategory(r.category as Cat);
    setSelectedHsd(Number(r.defaultHsd ?? 0));
    setSearch('');
    setOpen(false);
  }

  function clearSelection() {
    setSelectedCode('');
    setSelectedNama('');
    setSelectedCategory('');
    setSelectedHsd(null);
    setSearch('');
  }

  const catColor = (cat?: string) =>
    cat === 'tenaga' ? 'text-amber-600'
    : cat === 'bahan' ? 'text-emerald-600'
    : cat === 'peralatan' ? 'text-sky-600'
    : 'text-neutral-500';

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · BY RESOURCE</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP by Resource</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">Find AHSP using a specific resource — handy when a price changes.</p>
      </div>

      {/* Resource picker */}
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">RESOURCE</div>
        <div className="p-4 space-y-3">
          {selectedCode ? (
            <div className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)] bg-white px-3 py-1.5 font-mono text-xs shadow-[3px_3px_0_var(--color-brand)]">
              <strong className="text-[var(--color-brand)]">{selectedCode}</strong>
              <span className="text-neutral-700 max-w-[420px] truncate">{selectedNama || '…'}</span>
              {selectedCategory && (
                <span className={`uppercase ${catColor(selectedCategory)}`}>· {selectedCategory}</span>
              )}
              {selectedHsd !== null && (
                <span className="text-neutral-500">· default {fmtIDR(selectedHsd)}</span>
              )}
              <button onClick={clearSelection} className="text-red-600 hover:bg-red-50 p-0.5" aria-label="Clear">
                <X size={12} />
              </button>
            </div>
          ) : null}

          <div className="relative max-w-2xl">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-neutral-400" />
              <Input
                value={search}
                onFocus={() => setOpen(true)}
                onChange={e => { setSearch(e.target.value); setOpen(true); }}
                placeholder={selectedCode ? 'Pick another resource…' : 'Search by kode or nama (e.g. L01, E10, Pekerja, Excavator)…'}
              />
            </div>
            {open && (suggestions.length > 0 || resources.isLoading) && (
              <div className="absolute z-10 left-0 right-0 mt-1 border-2 border-[var(--color-ink)] bg-white max-h-72 overflow-auto shadow-[4px_4px_0_var(--color-brand)]">
                {resources.isLoading && (
                  <div className="px-3 py-2 font-mono text-xs text-neutral-500">Loading…</div>
                )}
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => pickResource(s)}
                    className="w-full text-left px-3 py-2 font-mono text-xs hover:bg-neutral-100 border-b border-neutral-100"
                  >
                    <strong className="text-[var(--color-brand)]">{s.kode}</strong>
                    <span className="ml-2 text-neutral-700">{s.nama}</span>
                    <span className={`ml-2 uppercase text-[10px] ${catColor(s.category)}`}>{s.category}</span>
                    <span className="ml-2 text-neutral-400">· {s.satuan}</span>
                    <span className="ml-2 text-neutral-500">· {fmtIDR(Number(s.defaultHsd ?? 0))}</span>
                  </button>
                ))}
                {!resources.isLoading && suggestions.length === 0 && (
                  <div className="px-3 py-2 font-mono text-xs text-neutral-500">No matches.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {!selectedCode && (
        <div className="border-2 border-dashed border-neutral-300 p-12 text-center font-mono text-xs text-neutral-500">
          Pick a resource to start. Try L01 (Pekerja) or E10 (Excavator).
        </div>
      )}

      {selectedCode && lookup.isLoading && (
        <div className="p-8 font-mono text-xs text-neutral-500">Loading AHSP usage…</div>
      )}

      {selectedCode && lookup.data && (
        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex items-center justify-between">
            <span>USED IN {lookup.data.length} AHSP ITEM{lookup.data.length === 1 ? '' : 'S'}</span>
            {lookup.data.length > 0 && (
              <span className="text-neutral-300">{selectedCode} · {selectedNama}</span>
            )}
          </div>
          {lookup.data.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-neutral-500">
              No AHSP currently references this resource.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="bg-neutral-100 border-b-2 border-[var(--color-ink)]">
                  <tr>
                    <th className="text-left px-3 py-2 tracking-wider">KODE</th>
                    <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                    <th className="text-left px-3 py-2 tracking-wider w-20">SATUAN</th>
                    <th className="text-right px-3 py-2 tracking-wider w-28">KOEFISIEN</th>
                    <th className="text-right px-3 py-2 tracking-wider w-32">HSD</th>
                    <th className="text-right px-3 py-2 tracking-wider w-36">SUBTOTAL</th>
                    <th className="text-right px-3 py-2 tracking-wider w-28">% OF AHSP</th>
                    <th className="text-right px-3 py-2 tracking-wider w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {lookup.data.map(row => (
                    <tr key={`${row.id}-${row.resourceCode}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2 font-bold text-[var(--color-brand)]">
                        <Link href={`/app/ahsp/${row.id}` as any} className="hover:underline">{row.kode}</Link>
                      </td>
                      <td className="px-3 py-2 max-w-[420px] truncate" title={row.jenis}>{row.jenis}</td>
                      <td className="px-3 py-2 text-neutral-500">{row.satuan}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(row.koefisien, 4)}</td>
                      <td className="px-3 py-2 text-right">{fmtIDR(row.hsd)}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtIDR(row.subtotal)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={row.pctOfTotal >= 30 ? 'text-red-600 font-bold' : row.pctOfTotal >= 10 ? 'text-amber-600' : 'text-neutral-500'}>
                          {fmtNum(row.pctOfTotal, 1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/app/ahsp/${row.id}` as any}
                          className="inline-flex items-center gap-1 text-neutral-600 hover:text-[var(--color-brand)]"
                        >
                          VIEW <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 border-t-2 border-[var(--color-ink)]">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 font-bold tracking-wider">TOTAL EXPOSURE</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {fmtIDR(lookup.data.reduce((s, r) => s + r.subtotal, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AhspByResourcePage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading…</div>}>
      <ByResourceInner />
    </Suspense>
  );
}
