'use client';
import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, Zap, ArrowLeft, Save } from 'lucide-react';
import { fmtIDR } from '@/lib/utils';

interface Staged {
  ahspItemId: string;
  kode: string;
  jenis: string;
  satuan: string;
  quantity: number;
  defaultRate: number | null;
}

export default function QuickAddPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const project = trpc.project.get.useQuery({ id });
  const catalog = trpc.ahsp.catalog.useQuery();

  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string>('');
  const [staged, setStaged] = useState<Staged[]>([]);

  const utils = trpc.useUtils();
  const bulk = trpc.boq.bulkAddScopes.useMutation({
    onSuccess: () => {
      utils.boq.list.invalidate({ projectId: id });
      router.push(`/app/projects/${id}`);
    },
  });

  // Inspect the boqTemplate.create input shape to decide if the button is enabled.
  // create expects { name, description?, category?, scopes: [{ ahspKode, defaultQty, note? }] }
  const saveTemplate = trpc.boqTemplate.create.useMutation();

  const sections = useMemo(() => {
    const s = new Set<string>();
    for (const a of catalog.data ?? []) if (a.section) s.add(a.section);
    return [...s].sort();
  }, [catalog.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog.data ?? []).filter(a => {
      if (section && (a.section ?? '') !== section) return false;
      if (!q) return true;
      return (a.kode + ' ' + a.jenis + ' ' + (a.section ?? '')).toLowerCase().includes(q);
    });
  }, [catalog.data, search, section]);

  const grouped = useMemo(() => {
    const g = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const k = a.section ?? 'OTHER';
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(a);
    }
    return g;
  }, [filtered]);

  const stagedIds = useMemo(() => new Set(staged.map(s => s.ahspItemId)), [staged]);

  function addToStaged(a: { id: string; kode: string; jenis: string; satuan: string }) {
    if (stagedIds.has(a.id)) return;
    setStaged(prev => [...prev, {
      ahspItemId: a.id,
      kode: a.kode,
      jenis: a.jenis,
      satuan: a.satuan,
      quantity: 1,
      defaultRate: null,
    }]);
  }

  function updateQty(ahspItemId: string, q: number) {
    setStaged(prev => prev.map(s => s.ahspItemId === ahspItemId ? { ...s, quantity: q } : s));
  }

  function removeStaged(ahspItemId: string) {
    setStaged(prev => prev.filter(s => s.ahspItemId !== ahspItemId));
  }

  const grandTotalEstimate = staged.reduce((acc, s) => acc + (s.quantity * (s.defaultRate ?? 0)), 0);

  async function handleAddAll() {
    if (staged.length === 0) return;
    await bulk.mutateAsync({
      projectId: id,
      items: staged.map(s => ({
        ahspItemId: s.ahspItemId,
        quantity: s.quantity,
      })),
    });
  }

  async function handleSaveTemplate() {
    if (staged.length === 0) return;
    const name = prompt('Template name?');
    if (!name) return;
    const category = prompt('Category? (optional, e.g. Jalan / Drainase)') ?? undefined;
    try {
      await saveTemplate.mutateAsync({
        name,
        category: category || undefined,
        scopes: staged.map(s => ({
          ahspKode: s.kode,
          defaultQty: s.quantity,
        })),
      });
      alert(`Template "${name}" saved (${staged.length} scopes).`);
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown error'}`);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b-2 border-[var(--color-ink)] flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold">
            {project.data?.code} · QUICK ADD
          </div>
          <h1 className="font-display text-lg font-bold flex items-center gap-2">
            <Zap size={18} className="text-[var(--color-brand)]" />
            {project.data?.name}
          </h1>
        </div>
        <Link href={`/app/projects/${id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white font-mono text-[10px] tracking-wider">
          <ArrowLeft size={12} /> BACK TO BOQ
        </Link>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-2 bg-neutral-50 border-b-2 border-[var(--color-ink)] flex items-center gap-2">
        <div>
          <Label className="text-[9px]">SECTION</Label>
          <select value={section} onChange={e => setSection(e.target.value)}
            className="block border border-[var(--color-ink)] bg-white text-xs px-2 py-1 font-mono">
            <option value="">All sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <Label className="text-[9px]">SEARCH</Label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="kode / jenis / section..."
              className="pl-7 text-xs" />
          </div>
        </div>
        <div className="font-mono text-[10px] text-neutral-500 self-end pb-1">
          {filtered.length} items · {staged.length} staged
        </div>
      </div>

      {/* Two-pane content */}
      <div className="grid grid-cols-[1fr_460px] flex-1 overflow-hidden">
        {/* Left: catalog */}
        <div className="bg-white border-r-2 border-[var(--color-ink)] overflow-auto">
          {grouped.size === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-neutral-500">
              No items match filters.
            </div>
          ) : (
            [...grouped.entries()].map(([sec, items]) => (
              <details key={sec} open className="group">
                <summary className="px-3 py-2 bg-[var(--color-ink)] text-white font-mono text-[10px] tracking-wider font-bold cursor-pointer hover:bg-[var(--color-brand)] flex justify-between items-center">
                  <span>▸ {sec}</span>
                  <span className="bg-white/20 px-1.5">{items.length}</span>
                </summary>
                <div>
                  {items.map(it => {
                    const isStaged = stagedIds.has(it.id);
                    return (
                      <button key={it.id}
                        onClick={() => addToStaged(it)}
                        disabled={isStaged}
                        className={`w-full text-left px-3 py-2 border-b border-neutral-100 font-mono text-xs ${
                          isStaged
                            ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                            : 'hover:bg-[var(--color-brand)] hover:text-white'
                        }`}>
                        <div className="flex justify-between">
                          <span>
                            <strong>{it.kode}</strong>{' '}
                            <span className="text-neutral-500 text-[10px]">{it.satuan}</span>
                          </span>
                          {isStaged && <span className="text-[9px]">STAGED</span>}
                        </div>
                        <div className="text-[10.5px] mt-0.5">{it.jenis}</div>
                      </button>
                    );
                  })}
                </div>
              </details>
            ))
          )}
        </div>

        {/* Right: staged */}
        <div className="bg-neutral-50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-[var(--color-ink)] text-white font-mono text-[10px] tracking-wider font-bold flex justify-between items-center">
            <span>STAGED SCOPES</span>
            <span className="bg-white/20 px-1.5">{staged.length}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {staged.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-neutral-500">
                Click any AHSP item on the left to stage it here.
              </div>
            ) : (
              <table className="w-full font-mono text-xs">
                <thead className="bg-neutral-200 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 tracking-wider w-[110px]">KODE</th>
                    <th className="text-left px-2 py-1.5 tracking-wider">JENIS</th>
                    <th className="text-left px-2 py-1.5 tracking-wider w-[40px]">SAT</th>
                    <th className="text-left px-2 py-1.5 tracking-wider w-[80px]">QTY</th>
                    <th className="text-right px-2 py-1.5 tracking-wider w-[80px]">RATE</th>
                    <th className="w-[30px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {staged.map(s => (
                    <tr key={s.ahspItemId} className="border-b border-neutral-200 bg-white">
                      <td className="px-2 py-1.5">
                        <strong className="text-[var(--color-brand)]">{s.kode}</strong>
                      </td>
                      <td className="px-2 py-1.5 text-[11px]">{s.jenis}</td>
                      <td className="px-2 py-1.5 text-neutral-500">{s.satuan}</td>
                      <td className="px-2 py-1.5">
                        <Input type="number" step="any" value={s.quantity}
                          onChange={e => updateQty(s.ahspItemId, Number(e.target.value))}
                          className="text-xs py-1 px-1.5" />
                      </td>
                      <td className="px-2 py-1.5 text-right text-neutral-500">
                        {s.defaultRate === null ? '—' : fmtIDR(s.defaultRate, { prefix: false })}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeStaged(s.ahspItemId)}
                          className="p-1 hover:bg-red-100 text-red-600" title="Remove">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t-2 border-[var(--color-ink)] bg-white">
            <div className="px-3 py-2 font-mono text-xs flex justify-between border-b border-neutral-200">
              <span className="text-neutral-500">GRAND TOTAL (est.)</span>
              <span className="font-bold">
                {grandTotalEstimate > 0 ? fmtIDR(grandTotalEstimate) : '— rate computed on save —'}
              </span>
            </div>
            <div className="px-3 py-2 flex gap-2">
              <button
                onClick={handleSaveTemplate}
                disabled={staged.length === 0 || saveTemplate.isPending}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white font-mono text-[10px] tracking-wider font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                <Save size={12} />
                {saveTemplate.isPending ? 'SAVING...' : 'SAVE AS TEMPLATE'}
              </button>
              <button
                onClick={handleAddAll}
                disabled={staged.length === 0 || bulk.isPending}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[var(--color-brand)] text-white hover:bg-[var(--color-ink)] font-mono text-[10px] tracking-wider font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                <Zap size={12} />
                {bulk.isPending ? 'ADDING...' : `ADD ALL (${staged.length})`}
              </button>
            </div>
            {bulk.isSuccess && (
              <div className="px-3 py-2 bg-green-50 text-green-700 font-mono text-[10px]">
                Added {bulk.data?.inserted} new · updated {bulk.data?.updated}. Redirecting...
              </div>
            )}
            {bulk.error && (
              <div className="px-3 py-2 bg-red-50 text-red-700 font-mono text-[10px]">
                {bulk.error.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
