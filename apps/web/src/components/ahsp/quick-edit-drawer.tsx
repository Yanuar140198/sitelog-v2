'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { X, Loader2, Plus, Trash2, ExternalLink, Save, Pencil } from 'lucide-react';

type Props = {
  ahspItemId: string | null;
  onClose: () => void;
};

type Category = 'tenaga' | 'bahan' | 'peralatan';

const CATEGORY_LABELS: Record<Category, string> = {
  tenaga: 'TENAGA',
  bahan: 'BAHAN',
  peralatan: 'PERALATAN',
};

export function QuickEditDrawer({ ahspItemId, onClose }: Props) {
  const open = !!ahspItemId;

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return <DrawerBody ahspItemId={ahspItemId!} onClose={onClose} />;
}

function DrawerBody({ ahspItemId, onClose }: { ahspItemId: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const ahspAny = trpc.ahsp as any;

  const breakdownQuery = ahspAny.detailBreakdown?.useQuery({ ahspItemId }, { retry: false });
  const detailQuery = ahspAny.detail?.useQuery({ id: ahspItemId }, { enabled: !breakdownQuery, retry: false });

  const breakdown = breakdownQuery?.data;
  const detail = detailQuery?.data;
  const isLoading = (breakdownQuery?.isLoading ?? false) || (detailQuery?.isLoading ?? false);

  // Normalised view-model (works whether breakdown OR detail returned)
  const view = useMemo(() => {
    if (breakdown) {
      return {
        id: breakdown.item.id as string,
        kode: breakdown.item.kode as string,
        jenis: breakdown.item.jenis as string,
        satuan: breakdown.item.satuan as string,
        ohpPct: Number(breakdown.item.ohpPct ?? 0),
        unitRate: Number(breakdown.totals?.unitRate ?? 0),
        organizationId: undefined as string | undefined, // breakdown doesn't include it
        sections: breakdown.sections as Record<Category, { rows: any[]; total: number }>,
      };
    }
    if (detail) {
      const byCat: Record<Category, any[]> = { tenaga: [], bahan: [], peralatan: [] };
      for (const r of detail.resources ?? []) {
        const c = r.category as Category;
        if (byCat[c]) byCat[c].push({
          id: r.id,
          code: r.resourceCode,
          uraian: r.uraian,
          satuan: r.satuan,
          koefisien: Number(r.koefisien ?? 0),
          hsd: Number(r.hsd ?? 0),
          subtotal: Number(r.koefisien ?? 0) * Number(r.hsd ?? 0),
        });
      }
      return {
        id: detail.item.id as string,
        kode: detail.item.kode as string,
        jenis: detail.item.jenis as string,
        satuan: detail.item.satuan as string,
        ohpPct: Number(detail.item.ohpPct ?? 0),
        unitRate: 0,
        organizationId: detail.item.organizationId as string | undefined,
        sections: {
          tenaga: { rows: byCat.tenaga, total: 0 },
          bahan: { rows: byCat.bahan, total: 0 },
          peralatan: { rows: byCat.peralatan, total: 0 },
        },
      };
    }
    return null;
  }, [breakdown, detail]);

  const updateMeta = ahspAny.updateMeta?.useMutation?.({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      await utils.ahsp.catalog.invalidate();
      breakdownQuery?.refetch?.();
      detailQuery?.refetch?.();
    },
    onError: (e: any) => alert(`Save failed: ${e.message}`),
  });
  const addResource = ahspAny.addResource?.useMutation?.({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      breakdownQuery?.refetch?.();
      detailQuery?.refetch?.();
    },
    onError: (e: any) => alert(`Add failed: ${e.message}`),
  });
  const updateResource = ahspAny.updateResource?.useMutation?.({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      breakdownQuery?.refetch?.();
      detailQuery?.refetch?.();
    },
    onError: (e: any) => alert(`Update failed: ${e.message}`),
  });
  const deleteResource = ahspAny.deleteResource?.useMutation?.({
    onSuccess: async () => {
      await utils.ahsp.catalogWithRates.invalidate();
      breakdownQuery?.refetch?.();
      detailQuery?.refetch?.();
    },
    onError: (e: any) => alert(`Delete failed: ${e.message}`),
  });

  const canEdit = !!updateMeta && !!addResource && !!updateResource && !!deleteResource;

  // Local edit state for header form (initialised when view loads)
  const [jenis, setJenis] = useState('');
  const [satuan, setSatuan] = useState('');
  const [ohpPct, setOhpPct] = useState<number>(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (view && !dirty) {
      setJenis(view.jenis);
      setSatuan(view.satuan);
      setOhpPct(view.ohpPct);
    }
  }, [view, dirty]);

  // Reset dirty / re-init when switching items
  useEffect(() => {
    setDirty(false);
  }, [ahspItemId]);

  function saveHeader() {
    if (!view || !canEdit) return;
    updateMeta.mutate({
      id: view.id,
      jenis: jenis.trim() || view.jenis,
      satuan: satuan.trim() || view.satuan,
      ohpPct: Number(ohpPct) || 0,
    }, {
      onSuccess: () => setDirty(false),
    });
  }

  // Add-resource form
  const [newCat, setNewCat] = useState<Category>('tenaga');
  const [newKode, setNewKode] = useState('');
  const [newUraian, setNewUraian] = useState('');
  const [newKoef, setNewKoef] = useState<number>(0);
  const [newHsd, setNewHsd] = useState<number>(0);
  const [newSatuan, setNewSatuan] = useState('');
  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!view || !canEdit) return;
    if (!newKode.trim() || !newUraian.trim()) return;
    addResource.mutate({
      ahspItemId: view.id,
      category: newCat,
      kode: newKode.trim(),
      uraian: newUraian.trim(),
      koefisien: Number(newKoef) || 0,
      hsd: Number(newHsd) || 0,
      satuan: newSatuan.trim() || undefined,
    }, {
      onSuccess: () => {
        setNewKode(''); setNewUraian(''); setNewKoef(0); setNewHsd(0); setNewSatuan('');
      },
    });
  }

  // Inline-edit a single resource row (one at a time)
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editKoef, setEditKoef] = useState<number>(0);
  const [editHsd, setEditHsd] = useState<number>(0);
  function beginEditRow(row: { id: string; koefisien: number; hsd: number }) {
    setEditRowId(row.id);
    setEditKoef(row.koefisien);
    setEditHsd(row.hsd);
  }
  function saveEditRow() {
    if (!editRowId || !canEdit) return;
    updateResource.mutate({
      id: editRowId,
      koefisien: Number(editKoef) || 0,
      hsd: Number(editHsd) || 0,
    }, {
      onSuccess: () => setEditRowId(null),
    });
  }

  const resourceCount =
    (view?.sections.tenaga.rows.length ?? 0) +
    (view?.sections.bahan.rows.length ?? 0) +
    (view?.sections.peralatan.rows.length ?? 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Quick edit AHSP"
        className="fixed top-0 right-0 h-full w-full sm:w-[600px] bg-white border-l-2 border-[var(--color-ink)] shadow-[-8px_0_0_var(--color-brand)] z-50 flex flex-col"
      >
        {/* HEADER */}
        <header className="border-b-2 border-[var(--color-ink)] p-4 flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">QUICK EDIT</p>
            {view ? (
              <>
                <div className="flex items-baseline gap-2 mt-1">
                  <h2 className="font-display text-xl font-bold text-[var(--color-brand)] truncate">{view.kode}</h2>
                  <span className="font-mono text-[10px] text-neutral-500">·</span>
                  <span className="font-mono text-xs text-neutral-700 truncate">{view.jenis}</span>
                </div>
              </>
            ) : (
              <h2 className="font-display text-xl font-bold mt-1">…</h2>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 hover:bg-neutral-200 shrink-0"
          ><X size={18} /></button>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading || !view ? (
            <div className="flex items-center justify-center py-16 font-mono text-xs text-neutral-500">
              <Loader2 size={16} className="animate-spin mr-2" /> LOADING…
            </div>
          ) : (
            <>
              {!canEdit && (
                <div className="border-2 border-amber-400 bg-amber-50 p-3 font-mono text-xs text-amber-900">
                  Read-only mode. Open full detail to edit.
                </div>
              )}

              {/* QUICK STATS */}
              <section className="grid grid-cols-3 gap-2">
                <Stat label="RATE" value={view.unitRate > 0 ? fmtIDR(view.unitRate) : '—'} />
                <Stat label="RESOURCES" value={String(resourceCount)} />
                <Stat label="OHP %" value={String(view.ohpPct)} />
              </section>

              {/* HEADER FORM */}
              <section className="border-2 border-neutral-300 p-3 space-y-3">
                <h3 className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">HEADER</h3>
                <div>
                  <Label className="font-mono text-[10px] tracking-[0.2em]">JENIS</Label>
                  <Input
                    value={jenis}
                    disabled={!canEdit}
                    onChange={e => { setJenis(e.target.value); setDirty(true); }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="font-mono text-[10px] tracking-[0.2em]">SATUAN</Label>
                    <Input
                      value={satuan}
                      disabled={!canEdit}
                      onChange={e => { setSatuan(e.target.value); setDirty(true); }}
                    />
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] tracking-[0.2em]">OHP %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={ohpPct}
                      disabled={!canEdit}
                      onChange={e => { setOhpPct(Number(e.target.value)); setDirty(true); }}
                    />
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="primary"
                    onClick={saveHeader}
                    disabled={!dirty || updateMeta.isPending}
                  >
                    {updateMeta.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    SAVE HEADER
                  </Button>
                )}
              </section>

              {/* RESOURCES */}
              <section className="space-y-3">
                <h3 className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">RESOURCES</h3>
                {(['tenaga', 'bahan', 'peralatan'] as Category[]).map(cat => {
                  const sec = view.sections[cat];
                  return (
                    <div key={cat} className="border border-neutral-300">
                      <div className="bg-neutral-100 px-2 py-1 flex items-center justify-between">
                        <span className="font-mono text-[10px] tracking-[0.2em] font-bold">{CATEGORY_LABELS[cat]}</span>
                        <span className="font-mono text-[10px] text-neutral-500">{sec.rows.length} ITEMS · {fmtIDR(sec.total)}</span>
                      </div>
                      {sec.rows.length === 0 ? (
                        <div className="px-2 py-3 font-mono text-[10px] text-neutral-400 text-center">— EMPTY —</div>
                      ) : (
                        <ul className="divide-y divide-neutral-100">
                          {sec.rows.map(r => {
                            const isEditing = editRowId === r.id;
                            return (
                              <li key={r.id} className="px-2 py-1.5 font-mono text-[11px]">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-bold text-[var(--color-brand)]">{r.code}</span>
                                      <span className="truncate">{r.uraian}</span>
                                    </div>
                                    {isEditing ? (
                                      <div className="mt-1 flex items-center gap-2">
                                        <label className="text-[9px] text-neutral-500">KOEF</label>
                                        <input
                                          type="number"
                                          step="0.0001"
                                          value={editKoef}
                                          onChange={e => setEditKoef(Number(e.target.value))}
                                          className="w-20 border border-[var(--color-brand)] px-1 py-0.5 text-[11px]"
                                        />
                                        <label className="text-[9px] text-neutral-500">HSD</label>
                                        <input
                                          type="number"
                                          step="1"
                                          value={editHsd}
                                          onChange={e => setEditHsd(Number(e.target.value))}
                                          className="w-24 border border-[var(--color-brand)] px-1 py-0.5 text-[11px]"
                                        />
                                      </div>
                                    ) : (
                                      <div className="mt-0.5 text-[10px] text-neutral-500 flex gap-3 tabular-nums">
                                        <span>koef {r.koefisien}</span>
                                        <span>hsd {fmtIDR(r.hsd)}</span>
                                        <span className="font-bold text-neutral-700">{fmtIDR(r.subtotal)}</span>
                                      </div>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isEditing ? (
                                        <>
                                          <button
                                            onClick={saveEditRow}
                                            disabled={updateResource.isPending}
                                            title="Save"
                                            className="p-1 text-green-700 hover:bg-green-100 disabled:opacity-40"
                                          >{updateResource.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}</button>
                                          <button
                                            onClick={() => setEditRowId(null)}
                                            title="Cancel"
                                            className="p-1 hover:bg-neutral-200"
                                          ><X size={11} /></button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => beginEditRow(r)}
                                            title="Edit koef/hsd"
                                            className="p-1 hover:bg-neutral-200"
                                          ><Pencil size={11} /></button>
                                          <button
                                            onClick={() => {
                                              if (confirm(`Delete ${r.code}?`)) deleteResource.mutate({ id: r.id });
                                            }}
                                            title="Delete"
                                            className="p-1 text-red-600 hover:bg-red-50"
                                          ><Trash2 size={11} /></button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {/* ADD ROW FORM */}
                {canEdit && (
                  <form
                    onSubmit={submitAdd}
                    className="border-2 border-dashed border-neutral-300 p-3 space-y-2 font-mono text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tracking-[0.2em] text-neutral-500">+ ADD LINE</span>
                      <select
                        value={newCat}
                        onChange={e => setNewCat(e.target.value as Category)}
                        className="border border-neutral-300 px-1 py-0.5 text-[10px] bg-white"
                      >
                        <option value="tenaga">TENAGA</option>
                        <option value="bahan">BAHAN</option>
                        <option value="peralatan">PERALATAN</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="KODE"
                        value={newKode}
                        onChange={e => setNewKode(e.target.value)}
                        required
                        className="border border-neutral-300 px-2 py-1"
                      />
                      <input
                        placeholder="SATUAN (e.g. M3)"
                        value={newSatuan}
                        onChange={e => setNewSatuan(e.target.value)}
                        className="border border-neutral-300 px-2 py-1"
                      />
                    </div>
                    <input
                      placeholder="URAIAN"
                      value={newUraian}
                      onChange={e => setNewUraian(e.target.value)}
                      required
                      className="w-full border border-neutral-300 px-2 py-1"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="KOEFISIEN"
                        value={newKoef}
                        onChange={e => setNewKoef(Number(e.target.value))}
                        className="border border-neutral-300 px-2 py-1"
                      />
                      <input
                        type="number"
                        step="1"
                        placeholder="HSD"
                        value={newHsd}
                        onChange={e => setNewHsd(Number(e.target.value))}
                        className="border border-neutral-300 px-2 py-1"
                      />
                    </div>
                    <Button type="submit" disabled={addResource.isPending} variant="primary">
                      {addResource.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      ADD
                    </Button>
                  </form>
                )}
              </section>
            </>
          )}
        </div>

        {/* FOOTER */}
        <footer className="border-t-2 border-[var(--color-ink)] p-3 flex items-center justify-between bg-white">
          {view ? (
            <Link
              href={`/app/ahsp/${view.id}` as any}
              className="font-mono text-[11px] tracking-wider text-[var(--color-brand)] hover:underline flex items-center gap-1"
              onClick={onClose}
            >
              OPEN FULL DETAIL <ExternalLink size={11} />
            </Link>
          ) : <span />}
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-neutral-500 hover:text-[var(--color-ink)]"
          >CLOSE (ESC)</button>
        </footer>
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-300 p-2">
      <div className="font-mono text-[9px] tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums mt-0.5 truncate">{value}</div>
    </div>
  );
}
