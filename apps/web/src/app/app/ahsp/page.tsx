'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { Plus, X, Copy, Eye, Pencil, Download, LayoutGrid, Table as TableIcon } from 'lucide-react';

type SortKey = 'kode-asc' | 'jenis-asc' | 'rate-desc' | 'used-desc';
type ViewMode = 'table' | 'grid';

const PAGE_SIZE = 50;

type Row = {
  id: string;
  organizationId: string | null;
  kode: string;
  label: string | null;
  section: string | null;
  jenis: string;
  satuan: string;
  ohpPct: number;
  computedRate: number;
  usedInProjects: number;
};

export default function AhspCatalogPage() {
  const router = useRouter();
  // Prefer rich query; fall back to legacy `catalog` if not yet deployed.
  const rich = trpc.ahsp.catalogWithRates.useQuery(undefined, { retry: false });
  const fallback = trpc.ahsp.catalog.useQuery(undefined, { enabled: rich.isError });
  const utils = trpc.useUtils();

  const create = trpc.ahsp.create.useMutation({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
      setShow(false);
      reset();
    },
  });
  const del = trpc.ahsp.delete.useMutation({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
    },
  });
  const clone = trpc.ahsp.clone.useMutation({
    onSuccess: (res) => {
      utils.ahsp.catalogWithRates.invalidate();
      utils.ahsp.catalog.invalidate();
      router.push(`/app/ahsp/${res.id}` as any);
    },
    onError: (e) => alert(`Clone failed: ${e.message}`),
  });

  const hasRates = !rich.isError && !!rich.data;
  const items: Row[] = useMemo(() => {
    if (hasRates) return rich.data as Row[];
    return (fallback.data ?? []).map(a => ({
      id: a.id,
      organizationId: a.organizationId,
      kode: a.kode,
      label: a.label ?? null,
      section: a.section ?? null,
      jenis: a.jenis,
      satuan: a.satuan,
      ohpPct: Number(a.ohpPct ?? 0),
      computedRate: 0,
      usedInProjects: 0,
    }));
  }, [hasRates, rich.data, fallback.data]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.section) s.add(it.section);
    return Array.from(s).sort();
  }, [items]);

  // CATEGORY chips: derived from kode prefix (e.g. "EI-311" → "EI", "AHSP-1" → "AHSP")
  const categories = useMemo(() => {
    const c = new Set<string>();
    for (const it of items) {
      const m = it.kode.match(/^([A-Za-z]+)/);
      if (m && m[1]) c.add(m[1].toUpperCase());
    }
    return Array.from(c).sort();
  }, [items]);

  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('kode-asc');
  const [view, setView] = useState<ViewMode>('table');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items.filter(it => {
      if (sectionFilter && it.section !== sectionFilter) return false;
      if (activeCategories.size) {
        const m = it.kode.match(/^([A-Za-z]+)/);
        const cat = m && m[1] ? m[1].toUpperCase() : '';
        if (!activeCategories.has(cat)) return false;
      }
      if (q) {
        const hay = `${it.kode} ${it.jenis} ${it.section ?? ''} ${it.label ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'jenis-asc': return a.jenis.localeCompare(b.jenis);
        case 'rate-desc': return b.computedRate - a.computedRate;
        case 'used-desc': return b.usedInProjects - a.usedInProjects;
        case 'kode-asc':
        default: return a.kode.localeCompare(b.kode, undefined, { numeric: true });
      }
    });
    return out;
  }, [items, search, sectionFilter, activeCategories, sortKey]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const customCount = items.filter(i => i.organizationId).length;
  const globalCount = items.length - customCount;

  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ kode: '', label: '', section: '', jenis: '', satuan: '', ohpPct: 0 });
  function reset() { setForm({ kode: '', label: '', section: '', jenis: '', satuan: '', ohpPct: 0 }); }
  function set<K extends keyof typeof form>(k: K, v: any) { setForm(p => ({ ...p, [k]: v })); }

  function toggleCategory(c: string) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
    setPage(1);
  }

  function handleClone(row: Row) {
    const newKode = window.prompt(`Clone "${row.kode}" — enter NEW kode:`, `${row.kode}-COPY`);
    if (!newKode) return;
    const newJenis = window.prompt('Enter NEW jenis (or leave blank to keep):', row.jenis) ?? undefined;
    clone.mutate({ ahspItemId: row.id, newKode: newKode.trim(), newJenis: newJenis?.trim() || undefined });
  }

  const loading = rich.isLoading || (rich.isError && fallback.isLoading);

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CATALOG</p>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="font-display text-4xl font-bold tracking-tight">AHSP Catalog</h1>
            <span className="font-mono text-xs px-2 py-1 bg-[var(--color-ink)] text-white">{items.length} ITEMS</span>
          </div>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {items.length} items · {customCount} custom · {globalCount} global
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO: /app/ahsp/import created by sibling agent */}
          <Link href={"/app/ahsp/import" as any}>
            <Button><Download size={14} /> IMPORT XLSX</Button>
          </Link>
          <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW CUSTOM AHSP</Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="font-mono text-[10px] tracking-[0.2em]">SEARCH</Label>
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="kode / jenis / section..."
            />
          </div>
          <div>
            <Label className="font-mono text-[10px] tracking-[0.2em]">SECTION</Label>
            <select
              className="w-full border border-neutral-300 px-2 py-2 font-mono text-xs bg-white"
              value={sectionFilter}
              onChange={e => { setSectionFilter(e.target.value); setPage(1); }}
            >
              <option value="">ALL SECTIONS</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label className="font-mono text-[10px] tracking-[0.2em]">SORT</Label>
            <select
              className="w-full border border-neutral-300 px-2 py-2 font-mono text-xs bg-white"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
            >
              <option value="kode-asc">KODE ↑</option>
              <option value="jenis-asc">JENIS ↑</option>
              <option value="rate-desc">RATE ↓</option>
              <option value="used-desc">USED ↓</option>
            </select>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">CATEGORY:</span>
            {categories.map(c => {
              const on = activeCategories.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`px-2 py-1 font-mono text-[10px] tracking-wider border transition-colors ${
                    on
                      ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:border-[var(--color-ink)]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
            {activeCategories.size > 0 && (
              <button
                onClick={() => { setActiveCategories(new Set()); setPage(1); }}
                className="font-mono text-[10px] tracking-wider text-neutral-500 hover:text-[var(--color-brand)] underline"
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">
            SHOWING {total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)} OF {total}
          </div>
          <div className="flex border border-neutral-300">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1 font-mono text-[10px] tracking-wider flex items-center gap-1 ${
                view === 'table' ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-neutral-600'
              }`}
            ><TableIcon size={12} /> TABLE</button>
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-1 font-mono text-[10px] tracking-wider flex items-center gap-1 ${
                view === 'grid' ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-neutral-600'
              }`}
            ><LayoutGrid size={12} /> GRID</button>
          </div>
        </div>
      </div>

      {/* BODY */}
      {loading ? (
        <div className="text-neutral-500 font-mono text-xs py-12 text-center border-2 border-dashed border-neutral-300">
          LOADING…
        </div>
      ) : total === 0 ? (
        <div className="text-neutral-500 font-mono text-xs py-12 text-center border-2 border-dashed border-neutral-300">
          NO ITEMS MATCH FILTERS
        </div>
      ) : view === 'table' ? (
        <div className="border-2 border-[var(--color-ink)] bg-white overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead className="bg-[var(--color-ink)] text-white">
              <tr>
                <th className="text-left px-3 py-2 tracking-wider">KODE</th>
                <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                <th className="text-left px-3 py-2 tracking-wider">SECTION</th>
                <th className="text-left px-3 py-2 tracking-wider">SAT</th>
                {hasRates && <th className="text-right px-3 py-2 tracking-wider">COMPUTED RATE</th>}
                {hasRates && <th className="text-right px-3 py-2 tracking-wider">USED IN</th>}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(it => {
                const isCustom = !!it.organizationId;
                return (
                  <tr key={it.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-bold text-[var(--color-brand)] whitespace-nowrap">
                      <Link href={`/app/ahsp/${it.id}` as any} className="hover:underline">{it.kode}</Link>
                      {isCustom && <span className="ml-1 text-[9px] text-neutral-400">●</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/app/ahsp/${it.id}` as any} className="hover:underline">{it.jenis}</Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-500">{it.section ?? '—'}</td>
                    <td className="px-3 py-2">{it.satuan}</td>
                    {hasRates && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.computedRate > 0 ? fmtIDR(it.computedRate) : <span className="text-neutral-400">—</span>}
                      </td>
                    )}
                    {hasRates && (
                      <td className="px-3 py-2 text-right">
                        {it.usedInProjects > 0 ? (
                          <span className="px-1.5 py-0.5 bg-[var(--color-brand)] text-white text-[10px]">{it.usedInProjects}</span>
                        ) : (
                          <span className="text-neutral-400">0</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/app/ahsp/${it.id}` as any} title="View">
                          <button className="p-1 hover:bg-neutral-200"><Eye size={12} /></button>
                        </Link>
                        <button
                          onClick={() => handleClone(it)}
                          disabled={clone.isPending}
                          title="Clone"
                          className="p-1 hover:bg-neutral-200 disabled:opacity-40"
                        ><Copy size={12} /></button>
                        {isCustom && (
                          <>
                            <Link href={`/app/ahsp/${it.id}` as any} title="Edit">
                              <button className="p-1 hover:bg-neutral-200"><Pencil size={12} /></button>
                            </Link>
                            <button
                              onClick={() => { if (confirm(`Delete ${it.kode}?`)) del.mutate({ id: it.id }); }}
                              title="Delete"
                              className="p-1 text-red-600 hover:bg-red-50"
                            ><X size={12} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {pageItems.map(it => {
            const isCustom = !!it.organizationId;
            return (
              <div
                key={it.id}
                className="border-2 border-neutral-300 bg-white p-4 font-mono text-xs hover:border-[var(--color-brand)] hover:shadow-[4px_4px_0_var(--color-brand)] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/app/ahsp/${it.id}` as any} className="text-[var(--color-brand)] font-bold text-base hover:underline">
                    {it.kode}
                  </Link>
                  {isCustom && <span className="text-[9px] px-1 bg-neutral-200">CUSTOM</span>}
                </div>
                <div className="mt-2 line-clamp-2 min-h-[2.4em]">{it.jenis}</div>
                <div className="mt-2 text-neutral-500 text-[10px]">{it.section ?? 'NO SECTION'} · {it.satuan}</div>
                {hasRates && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 flex items-end justify-between">
                    <div>
                      <div className="text-[9px] tracking-[0.2em] text-neutral-500">RATE</div>
                      <div className="font-bold text-sm tabular-nums">
                        {it.computedRate > 0 ? fmtIDR(it.computedRate) : '—'}
                      </div>
                    </div>
                    {it.usedInProjects > 0 && (
                      <span className="px-1.5 py-0.5 bg-[var(--color-brand)] text-white text-[10px]">
                        {it.usedInProjects} proj
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-1">
                  <Link href={`/app/ahsp/${it.id}` as any} className="flex-1">
                    <Button className="w-full"><Eye size={12} /> VIEW</Button>
                  </Link>
                  <button
                    onClick={() => handleClone(it)}
                    disabled={clone.isPending}
                    title="Clone"
                    className="p-2 border border-neutral-300 hover:border-[var(--color-brand)] disabled:opacity-40"
                  ><Copy size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 font-mono text-xs">
          <button
            disabled={safePage === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 border border-neutral-300 disabled:opacity-30 hover:border-[var(--color-ink)]"
          >‹ PREV</button>
          <span className="px-3 py-1">PAGE {safePage} / {totalPages}</span>
          <button
            disabled={safePage === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1 border border-neutral-300 disabled:opacity-30 hover:border-[var(--color-ink)]"
          >NEXT ›</button>
        </div>
      )}

      {/* CREATE MODAL */}
      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">New Custom AHSP</h2>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ ...form, ohpPct: Number(form.ohpPct) }); }}
              className="grid grid-cols-2 gap-3">
              <div><Label>Kode *</Label><Input required value={form.kode} onChange={e => set('kode', e.target.value)} placeholder="CUSTOM-001" /></div>
              <div><Label>Label</Label><Input value={form.label} onChange={e => set('label', e.target.value)} /></div>
              <div className="col-span-2"><Label>Jenis Pekerjaan *</Label><Input required value={form.jenis} onChange={e => set('jenis', e.target.value)} placeholder="Custom Cut Soil with Bulldozer" /></div>
              <div><Label>Section</Label><Input value={form.section} onChange={e => set('section', e.target.value)} placeholder="EARTHWORK" /></div>
              <div><Label>Satuan *</Label><Input required value={form.satuan} onChange={e => set('satuan', e.target.value)} placeholder="M3" /></div>
              <div><Label>OHP %</Label><Input type="number" step="0.1" value={form.ohpPct} onChange={e => set('ohpPct', e.target.value)} /></div>
              <div className="col-span-2 flex gap-2 mt-3">
                <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
              {create.error && <div className="col-span-2 text-red-600 text-xs font-mono">{create.error.message}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
