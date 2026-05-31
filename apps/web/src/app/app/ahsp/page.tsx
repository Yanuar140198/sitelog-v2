'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { Plus, X, Copy, Eye, Pencil, Download, LayoutGrid, Table as TableIcon, Star, Archive, Loader2, PencilLine } from 'lucide-react';
import { QuickEditDrawer } from '@/components/ahsp/quick-edit-drawer';

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
  archivedAt?: string | Date | null;
};

const VALID_SORTS: SortKey[] = ['kode-asc', 'jenis-asc', 'rate-desc', 'used-desc'];
const VALID_VIEWS: ViewMode[] = ['table', 'grid'];

function AhspCatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven state
  const initialSearch = searchParams.get('q') ?? '';
  const initialSection = searchParams.get('section') ?? '';
  const initialSortRaw = searchParams.get('sort') as SortKey | null;
  const initialSort: SortKey = initialSortRaw && VALID_SORTS.includes(initialSortRaw) ? initialSortRaw : 'kode-asc';
  const initialViewRaw = searchParams.get('view') as ViewMode | null;
  const initialView: ViewMode = initialViewRaw && VALID_VIEWS.includes(initialViewRaw) ? initialViewRaw : 'table';
  const initialPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const initialShowArchived = searchParams.get('archived') === '1';

  const [search, setSearch] = useState(initialSearch);
  const [sectionFilter, setSectionFilter] = useState<string>(initialSection);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>(initialSort);
  const [view, setView] = useState<ViewMode>(initialView);
  const [page, setPage] = useState(initialPage);
  const [showArchived, setShowArchived] = useState(initialShowArchived);

  // Persist filter/sort/view to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (sectionFilter) params.set('section', sectionFilter);
    if (sortKey !== 'kode-asc') params.set('sort', sortKey);
    if (view !== 'table') params.set('view', view);
    if (page > 1) params.set('page', String(page));
    if (showArchived) params.set('archived', '1');
    const qs = params.toString();
    router.replace(`/app/ahsp${qs ? `?${qs}` : ''}` as any);
  }, [search, sectionFilter, sortKey, view, page, showArchived, router]);

  // Prefer rich query; fall back to legacy `catalog` if not yet deployed.
  const rich = trpc.ahsp.catalogWithRates.useQuery(undefined, { retry: false });
  const fallback = trpc.ahsp.catalog.useQuery(undefined, { enabled: rich.isError });
  const pinsQuery = trpc.ahsp.myPins.useQuery(undefined, { retry: false });
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
  const quickRename = trpc.ahsp.quickRenameJenis.useMutation({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
      setEditingId(null);
    },
    onError: (e) => alert(`Rename failed: ${e.message}`),
  });
  const togglePin = trpc.ahsp.togglePin.useMutation({
    onSuccess: () => utils.ahsp.myPins.invalidate(),
  });
  const bulkArchive = trpc.ahsp.bulkArchive.useMutation({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
      setSelected(new Set());
    },
  });
  const bulkUnarchive = trpc.ahsp.bulkUnarchive.useMutation({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
      setSelected(new Set());
    },
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
      archivedAt: null,
    }));
  }, [hasRates, rich.data, fallback.data]);

  const pinnedSet = useMemo(() => new Set(pinsQuery.data ?? []), [pinsQuery.data]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.section) s.add(it.section);
    return Array.from(s).sort();
  }, [items]);

  const categories = useMemo(() => {
    const c = new Set<string>();
    for (const it of items) {
      const m = it.kode.match(/^([A-Za-z]+)/);
      if (m && m[1]) c.add(m[1].toUpperCase());
    }
    return Array.from(c).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items.filter(it => {
      const isArch = !!it.archivedAt;
      if (!showArchived && isArch) return false;
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
      // Pinned always first
      const ap = pinnedSet.has(a.id) ? 0 : 1;
      const bp = pinnedSet.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      switch (sortKey) {
        case 'jenis-asc': return a.jenis.localeCompare(b.jenis);
        case 'rate-desc': return b.computedRate - a.computedRate;
        case 'used-desc': return b.usedInProjects - a.usedInProjects;
        case 'kode-asc':
        default: return a.kode.localeCompare(b.kode, undefined, { numeric: true });
      }
    });
    return out;
  }, [items, search, sectionFilter, activeCategories, sortKey, pinnedSet, showArchived]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const customCount = items.filter(i => i.organizationId).length;
  const globalCount = items.length - customCount;
  const archivedCount = items.filter(i => !!i.archivedAt).length;

  // Selection (checkboxes)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    const visibleIds = pageItems.map(p => p.id);
    const allOn = visibleIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allOn) { for (const id of visibleIds) next.delete(id); }
      else { for (const id of visibleIds) next.add(id); }
      return next;
    });
  }
  const allVisibleSelected = pageItems.length > 0 && pageItems.every(p => selected.has(p.id));

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);
  function beginEdit(row: Row) {
    if (!row.organizationId) return; // global = read-only here
    setEditingId(row.id);
    setEditingValue(row.jenis);
  }
  function commitEdit() {
    if (!editingId) return;
    const orig = items.find(it => it.id === editingId);
    const v = editingValue.trim();
    if (!orig || v.length < 3 || v === orig.jenis) { setEditingId(null); return; }
    quickRename.mutate({ id: editingId, newJenis: v });
  }

  // Keyboard navigation
  const [activeRowIdx, setActiveRowIdx] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); return; }
        if (selected.size) { setSelected(new Set()); return; }
        setActiveRowIdx(-1);
        return;
      }
      if (inField) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'j') {
        e.preventDefault();
        setActiveRowIdx(i => Math.min(pageItems.length - 1, i + 1));
        return;
      }
      if (e.key === 'k') {
        e.preventDefault();
        setActiveRowIdx(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'e') {
        if (activeRowIdx >= 0 && activeRowIdx < pageItems.length) {
          e.preventDefault();
          beginEdit(pageItems[activeRowIdx]!);
        }
        return;
      }
      if (e.key === ' ') {
        if (activeRowIdx >= 0 && activeRowIdx < pageItems.length) {
          e.preventDefault();
          toggleSelect(pageItems[activeRowIdx]!.id);
        }
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageItems, activeRowIdx, editingId, selected.size]);

  const [show, setShow] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
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

  const handleExport = useCallback(() => {
    const rows = items.filter(it => selected.has(it.id));
    const header = ['kode', 'jenis', 'section', 'satuan', 'ohpPct', 'computedRate', 'usedInProjects', 'scope'];
    const csv = [header.join(',')]
      .concat(rows.map(r => [
        `"${(r.kode ?? '').replace(/"/g, '""')}"`,
        `"${(r.jenis ?? '').replace(/"/g, '""')}"`,
        `"${(r.section ?? '').replace(/"/g, '""')}"`,
        `"${(r.satuan ?? '').replace(/"/g, '""')}"`,
        String(r.ohpPct),
        String(r.computedRate),
        String(r.usedInProjects),
        r.organizationId ? 'custom' : 'global',
      ].join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ahsp-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, selected]);

  const loading = rich.isLoading || (rich.isError && fallback.isLoading);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CATALOG</p>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight">AHSP Catalog</h1>
            <span className="font-mono text-xs px-2 py-1 bg-[var(--color-ink)] text-white">{items.length} ITEMS</span>
          </div>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {items.length} items · {customCount} custom · {globalCount} global
            {archivedCount > 0 && <> · {archivedCount} archived</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW CUSTOM AHSP</Button>
          <Link href={"/app/ahsp/import" as any}>
            <Button><Download size={14} /> IMPORT XLSX</Button>
          </Link>
          <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-400 px-1">|</span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">TOOLS:</span>
          <Link href={"/app/ahsp/dedup" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">DEDUP</Link>
          <Link href={"/app/ahsp/usage" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">USAGE</Link>
          <Link href={"/app/ahsp/sanity" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">SANITY</Link>
          <Link href={"/app/ahsp/compare" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">COMPARE</Link>
          <Link href={"/app/ahsp/by-resource" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">BY RESOURCE</Link>
          <Link href={"/app/ahsp/productivity" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">PRODUCTIVITY</Link>
          <Link href={"/app/ahsp/import" as any} className="font-mono text-[10px] tracking-wider underline text-neutral-700 hover:text-[var(--color-brand)]">IMPORT</Link>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selected.size > 0 && (
        <div className="border-2 border-[var(--color-brand)] bg-[var(--color-brand)]/10 p-3 flex items-center gap-3 flex-wrap font-mono text-xs">
          <span className="font-bold">{selected.size} SELECTED</span>
          <span className="text-neutral-400">·</span>
          <button
            onClick={() => {
              if (!confirm(`Archive ${selected.size} items? Only org-owned items will be archived.`)) return;
              bulkArchive.mutate({ ids: Array.from(selected) });
            }}
            disabled={bulkArchive.isPending}
            className="px-2 py-1 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white disabled:opacity-40 flex items-center gap-1"
          ><Archive size={12} /> ARCHIVE</button>
          {showArchived && (
            <button
              onClick={() => bulkUnarchive.mutate({ ids: Array.from(selected) })}
              disabled={bulkUnarchive.isPending}
              className="px-2 py-1 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white disabled:opacity-40"
            >UNARCHIVE</button>
          )}
          <button
            onClick={handleExport}
            className="px-2 py-1 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
          >EXPORT CSV</button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 border border-neutral-400 text-neutral-600 hover:bg-neutral-200"
          >CANCEL</button>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="font-mono text-[10px] tracking-[0.2em]">SEARCH <span className="text-neutral-400">(press /)</span></Label>
            <Input
              ref={searchInputRef}
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
            <span className="font-mono text-[10px] text-neutral-300 px-1">|</span>
            <button
              onClick={() => { setShowArchived(v => !v); setPage(1); }}
              className={`px-2 py-1 font-mono text-[10px] tracking-wider border transition-colors flex items-center gap-1 ${
                showArchived
                  ? 'bg-neutral-700 text-white border-neutral-700'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-[var(--color-ink)]'
              }`}
            ><Archive size={10} /> ARCHIVED {archivedCount > 0 && `(${archivedCount})`}</button>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">
            SHOWING {total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)} OF {total}
            <span className="ml-3 text-neutral-400">SHORTCUTS: / search · j/k row · e edit · space select · esc clear</span>
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
        <div className="text-neutral-500 font-mono text-xs py-16 text-center border-2 border-dashed border-neutral-300 flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin" />
          LOADING CATALOG…
        </div>
      ) : total === 0 ? (
        <div className="text-neutral-500 font-mono text-xs py-16 text-center border-2 border-dashed border-neutral-300 space-y-3">
          <div className="text-base">{items.length === 0 ? 'NO AHSP ITEMS YET' : 'NO ITEMS MATCH FILTERS'}</div>
          {items.length === 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setShow(true)}><Plus size={12} /> CREATE FIRST AHSP</Button>
              <Link href={"/app/ahsp/import" as any}><Button><Download size={12} /> IMPORT XLSX</Button></Link>
            </div>
          ) : (
            <button
              onClick={() => { setSearch(''); setSectionFilter(''); setActiveCategories(new Set()); setShowArchived(false); setPage(1); }}
              className="underline hover:text-[var(--color-brand)]"
            >CLEAR ALL FILTERS</button>
          )}
        </div>
      ) : view === 'table' ? (
        <div className="border-2 border-[var(--color-ink)] bg-white overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead className="bg-[var(--color-ink)] text-white">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible"
                  />
                </th>
                <th className="w-8 px-2 py-2"></th>
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
              {pageItems.map((it, idx) => {
                const isCustom = !!it.organizationId;
                const isPinned = pinnedSet.has(it.id);
                const isSelected = selected.has(it.id);
                const isActive = idx === activeRowIdx;
                const isArchived = !!it.archivedAt;
                const isEditing = editingId === it.id;
                const isSavingThis = quickRename.isPending && quickRename.variables?.id === it.id;
                return (
                  <tr
                    key={it.id}
                    className={`border-b border-neutral-100 ${isActive ? 'bg-[var(--color-brand)]/10 outline outline-1 outline-[var(--color-brand)]' : isSelected ? 'bg-[var(--color-brand)]/5' : 'hover:bg-neutral-50'} ${isArchived ? 'opacity-50' : ''}`}
                    onClick={() => setActiveRowIdx(idx)}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(it.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Select ${it.kode}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); togglePin.mutate({ id: it.id }); }}
                        title={isPinned ? 'Unpin' : 'Pin to top'}
                        className="p-0.5 hover:scale-110 transition-transform"
                      >
                        <Star size={13} className={isPinned ? 'fill-orange-500 text-orange-500' : 'text-neutral-300 hover:text-orange-400'} />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-bold text-[var(--color-brand)] whitespace-nowrap">
                      <Link href={`/app/ahsp/${it.id}` as any} className="hover:underline">{it.kode}</Link>
                      {isCustom && <span className="ml-1 text-[9px] text-neutral-400">●</span>}
                      {isArchived && <span className="ml-1 text-[9px] text-neutral-500 uppercase">[arch]</span>}
                    </td>
                    <td className="px-3 py-2 group">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={editInputRef}
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                              else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                            }}
                            className="flex-1 border border-[var(--color-brand)] px-2 py-1 font-mono text-xs"
                          />
                          {isSavingThis && <Loader2 size={12} className="animate-spin text-neutral-500" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Link href={`/app/ahsp/${it.id}` as any} className="hover:underline">{it.jenis}</Link>
                          {isCustom && (
                            <button
                              onClick={e => { e.stopPropagation(); beginEdit(it); }}
                              title="Inline rename (or press E)"
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[var(--color-brand)] transition-opacity"
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                        </div>
                      )}
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
                        <button
                          onClick={e => { e.stopPropagation(); setDrawerId(it.id); }}
                          title="Quick edit (drawer)"
                          className="p-1 hover:bg-[var(--color-brand)] hover:text-white"
                        ><PencilLine size={12} /></button>
                        <Link href={`/app/ahsp/${it.id}` as any} title="View">
                          <button className="p-1 hover:bg-neutral-200"><Eye size={12} /></button>
                        </Link>
                        <button
                          onClick={e => { e.stopPropagation(); handleClone(it); }}
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
                              onClick={e => { e.stopPropagation(); if (confirm(`Delete ${it.kode}?`)) del.mutate({ id: it.id }); }}
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
            const isPinned = pinnedSet.has(it.id);
            const isSelected = selected.has(it.id);
            const isArchived = !!it.archivedAt;
            return (
              <div
                key={it.id}
                className={`border-2 ${isSelected ? 'border-[var(--color-brand)] shadow-[4px_4px_0_var(--color-brand)]' : 'border-neutral-300'} bg-white p-4 font-mono text-xs hover:border-[var(--color-brand)] hover:shadow-[4px_4px_0_var(--color-brand)] transition-all ${isArchived ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(it.id)}
                      aria-label={`Select ${it.kode}`}
                    />
                    <Link href={`/app/ahsp/${it.id}` as any} className="text-[var(--color-brand)] font-bold text-base hover:underline">
                      {it.kode}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePin.mutate({ id: it.id })} title={isPinned ? 'Unpin' : 'Pin'}>
                      <Star size={12} className={isPinned ? 'fill-orange-500 text-orange-500' : 'text-neutral-300 hover:text-orange-400'} />
                    </button>
                    {isCustom && <span className="text-[9px] px-1 bg-neutral-200">CUSTOM</span>}
                  </div>
                </div>
                <div className="mt-2 line-clamp-2 min-h-[2.4em]">{it.jenis}</div>
                <div className="mt-2 text-neutral-500 text-[10px]">{it.section ?? 'NO SECTION'} · {it.satuan}{isArchived && ' · ARCHIVED'}</div>
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
                    onClick={() => setDrawerId(it.id)}
                    title="Quick edit (drawer)"
                    className="p-2 border border-neutral-300 hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white"
                  ><PencilLine size={12} /></button>
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

      {/* QUICK EDIT DRAWER */}
      <QuickEditDrawer ahspItemId={drawerId} onClose={() => setDrawerId(null)} />

      {/* CREATE MODAL */}
      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">New Custom AHSP</h2>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ ...form, ohpPct: Number(form.ohpPct) }); }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Kode *</Label><Input required value={form.kode} onChange={e => set('kode', e.target.value)} placeholder="CUSTOM-001" /></div>
              <div><Label>Label</Label><Input value={form.label} onChange={e => set('label', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Jenis Pekerjaan *</Label><Input required value={form.jenis} onChange={e => set('jenis', e.target.value)} placeholder="Custom Cut Soil with Bulldozer" /></div>
              <div><Label>Section</Label><Input value={form.section} onChange={e => set('section', e.target.value)} placeholder="EARTHWORK" /></div>
              <div><Label>Satuan *</Label><Input required value={form.satuan} onChange={e => set('satuan', e.target.value)} placeholder="M3" /></div>
              <div><Label>OHP %</Label><Input type="number" step="0.1" value={form.ohpPct} onChange={e => set('ohpPct', Number(e.target.value) || 0)} /></div>
              <div className="sm:col-span-2 flex gap-2 mt-3">
                <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
              {create.error && <div className="sm:col-span-2 text-red-600 text-xs font-mono">{create.error.message}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AhspCatalogPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading…</div>}>
      <AhspCatalogInner />
    </Suspense>
  );
}
