'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, ChevronLeft, History, Pencil, Plus, Printer, Copy,
  Save, Trash2, X, Check, AlertTriangle,
} from 'lucide-react';

const CATS = ['tenaga', 'bahan', 'peralatan'] as const;
type Cat = typeof CATS[number];
const CAT_META: Record<Cat, { letter: string; title: string }> = {
  tenaga:    { letter: 'A', title: 'TENAGA KERJA' },
  bahan:     { letter: 'B', title: 'BAHAN' },
  peralatan: { letter: 'C', title: 'PERALATAN' },
};

export default function AhspDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const breakdown = trpc.ahsp.detailBreakdown.useQuery({ ahspItemId: id });
  const detail = trpc.ahsp.detail.useQuery({ id });
  const catalog = trpc.ahsp.catalog.useQuery();
  const utils = trpc.useUtils();

  const refresh = () => {
    utils.ahsp.detail.invalidate({ id });
    utils.ahsp.detailBreakdown.invalidate({ ahspItemId: id });
  };

  // Mutations — use loose casts so the page still compiles if a procedure isn't
  // yet wired in some environments.
  const ahspMut = trpc.ahsp as any;
  const updateMeta = ahspMut.updateMeta?.useMutation({ onSuccess: refresh });
  const addResource = ahspMut.addResource?.useMutation({ onSuccess: refresh });
  const updateResource = ahspMut.updateResource?.useMutation({ onSuccess: refresh });
  const deleteResource = ahspMut.deleteResource?.useMutation({ onSuccess: refresh });
  const addInput = ahspMut.addInput?.useMutation({ onSuccess: refresh });
  const updateInput = ahspMut.updateInput?.useMutation({ onSuccess: refresh });
  const deleteInput = ahspMut.deleteInput?.useMutation({ onSuccess: refresh });
  const addKoefisien = ahspMut.addKoefisien?.useMutation({ onSuccess: refresh });
  const updateKoefisien = ahspMut.updateKoefisien?.useMutation({ onSuccess: refresh });
  const deleteKoefisien = ahspMut.deleteKoefisien?.useMutation({ onSuccess: refresh });
  const restoreVersion = ahspMut.restoreVersion?.useMutation({ onSuccess: refresh });
  const cloneMut = ahspMut.clone?.useMutation();

  const [editHeader, setEditHeader] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (!breakdown.data || !detail.data) {
    return <div className="p-8 font-mono text-sm">Loading...</div>;
  }
  const { item, sections, totals, inputs } = breakdown.data;
  const { resources, koefisien, inputs: rawInputs, item: rawItem } = detail.data;
  const isEditable = Boolean(rawItem.organizationId);

  // Prev/Next via catalog ordering
  const list = catalog.data ?? [];
  const idx = list.findIndex(c => c.id === id);
  const prevId = idx > 0 ? list[idx - 1]?.id : null;
  const nextId = idx >= 0 && idx < list.length - 1 ? list[idx + 1]?.id : null;

  const handleClone = async () => {
    if (!cloneMut) return;
    const newKode = prompt('New kode for cloned AHSP', `${item.kode}-COPY`);
    if (!newKode) return;
    const newJenis = prompt('New jenis (description)', item.jenis) ?? item.jenis;
    try {
      const res = await cloneMut.mutateAsync({ ahspItemId: id, newKode, newJenis });
      router.push(`/app/ahsp/${res.id}`);
    } catch (e: any) {
      alert(`Clone failed: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
          <ArrowLeft size={14} /> AHSP CATALOG
        </Link>
        <div className="flex items-center gap-2">
          <NavBtn disabled={!prevId} onClick={() => prevId && router.push(`/app/ahsp/${prevId}`)} icon={<ChevronLeft size={14} />} label="PREV" />
          <span className="font-mono text-xs text-neutral-400">
            {idx >= 0 ? `${idx + 1} / ${list.length}` : ''}
          </span>
          <NavBtn disabled={!nextId} onClick={() => nextId && router.push(`/app/ahsp/${nextId}`)} icon={<ArrowRight size={14} />} label="NEXT" right />
          <span className="w-px h-5 bg-neutral-300 mx-1" />
          <button
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 border-2 border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
          >
            <History size={14} /> HISTORY
          </button>
          <Link
            href={`/app/ahsp/${id}/print`}
            className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 border-2 border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
          >
            <Printer size={14} /> PRINT
          </Link>
          <button
            onClick={handleClone}
            className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 border-2 border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:bg-[var(--color-ink)] hover:border-[var(--color-ink)]"
          >
            <Copy size={14} /> CLONE
          </button>
        </div>
      </div>

      {!isEditable && (
        <div className="border-2 border-amber-500 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1">
            <div className="font-mono text-xs tracking-[0.2em] text-amber-700 font-bold">GLOBAL CATALOG · READ-ONLY</div>
            <div className="font-mono text-xs text-amber-700 mt-1">
              This is a shared global AHSP item. Clone it to your organization to customize.
            </div>
          </div>
          <button
            onClick={handleClone}
            className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-2 bg-[var(--color-brand)] text-white hover:bg-[var(--color-ink)]"
          >
            <Copy size={14} /> CLONE TO ORG
          </button>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-5">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">
          {item.kode}
          {item.deskripsi ? <span className="ml-3 text-neutral-400">· {item.deskripsi}</span> : null}
        </div>
        <div className="flex items-start justify-between gap-3 mt-1">
          <h1 className="font-display text-3xl font-bold">{item.jenis}</h1>
          {isEditable && (
            <button
              onClick={() => setEditHeader(true)}
              className="font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)] inline-flex items-center gap-1"
              title="Edit header"
            >
              <Pencil size={14} /> EDIT
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="font-mono text-xs px-2 py-1 bg-[var(--color-ink)] text-white tracking-wider">
            SATUAN · {item.satuan}
          </span>
          <span className="font-mono text-xs px-2 py-1 border border-[var(--color-ink)] tracking-wider">
            OHP · {item.ohpPct}%
          </span>
        </div>
      </div>

      {editHeader && isEditable && (
        <HeaderEditModal
          initial={{ jenis: item.jenis, deskripsi: item.deskripsi ?? '', satuan: item.satuan, ohpPct: item.ohpPct }}
          onClose={() => setEditHeader(false)}
          onSave={async (vals) => {
            if (!updateMeta) { alert('updateMeta not available'); return; }
            await updateMeta.mutateAsync({ id, ...vals });
            setEditHeader(false);
          }}
        />
      )}

      {/* INPUTS / PARAMETERS */}
      <InputsTable
        ahspItemId={id}
        rows={rawInputs}
        editable={isEditable}
        addMut={addInput}
        updateMut={updateInput}
        deleteMut={deleteInput}
      />

      {/* KOEFISIEN / PRODUCTIVITY */}
      <KoefTable
        ahspItemId={id}
        rows={koefisien}
        editable={isEditable}
        addMut={addKoefisien}
        updateMut={updateKoefisien}
        deleteMut={deleteKoefisien}
      />

      {/* SECTIONS A / B / C */}
      {CATS.map(cat => (
        <CategoryBlock
          key={cat}
          cat={cat}
          ahspItemId={id}
          letter={CAT_META[cat].letter}
          title={CAT_META[cat].title}
          rows={sections[cat].rows}
          subtotal={sections[cat].total}
          editable={isEditable}
          rawRows={resources.filter(r => r.category === cat)}
          addMut={addResource}
          updateMut={updateResource}
          deleteMut={deleteResource}
        />
      ))}

      {/* SUMMARY CARD */}
      <div className="border-2 border-[var(--color-ink)] bg-[var(--color-ink)] text-white p-6 shadow-[8px_8px_0_var(--color-brand)]">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mb-3">RINGKASAN HARGA SATUAN</div>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm">
          <SumRow label="A · TENAGA KERJA" value={fmtIDR(sections.tenaga.total)} />
          <SumRow label="B · BAHAN" value={fmtIDR(sections.bahan.total)} />
          <SumRow label="C · PERALATAN" value={fmtIDR(sections.peralatan.total)} />
          <SumRow label="JUMLAH (A + B + C)" value={fmtIDR(totals.abcSubtotal)} bold />
          <SumRow label={`D · OHP (${item.ohpPct}%)`} value={fmtIDR(totals.ohpAmount)} />
        </div>
        <div className="mt-5 pt-5 border-t border-white/30 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-white/60">HARGA SATUAN PER {item.satuan}</div>
            <div className="font-mono text-xs text-white/60 mt-1">A + B + C + D</div>
          </div>
          <div className="text-4xl font-display font-bold text-[var(--color-brand)] tabular-nums">
            {fmtIDR(totals.unitRate)}
          </div>
        </div>
      </div>

      {showHistory && (
        <HistoryDrawer
          ahspItemId={id}
          onClose={() => setShowHistory(false)}
          onRestore={async (versionId) => {
            if (!restoreVersion) { alert('restoreVersion not available'); return; }
            if (!confirm('Restore this version? Current state will be saved as a snapshot first.')) return;
            await restoreVersion.mutateAsync({ versionId });
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
}

function NavBtn({ disabled, onClick, icon, label, right }: { disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string; right?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 font-mono text-xs px-2 py-1.5 border border-neutral-300 hover:border-[var(--color-ink)] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {!right && icon}
      {label}
      {right && icon}
    </button>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <div className={bold ? 'font-bold' : 'text-white/80'}>{label}</div>
      <div className={`text-right tabular-nums ${bold ? 'font-bold' : 'text-white/80'}`}>{value}</div>
    </>
  );
}

// ─── HEADER EDIT MODAL ────────────────────────────────────────────────────────
function HeaderEditModal({
  initial, onClose, onSave,
}: {
  initial: { jenis: string; deskripsi: string; satuan: string; ohpPct: number };
  onClose: () => void;
  onSave: (vals: { jenis: string; deskripsi?: string; satuan: string; ohpPct: number }) => Promise<void> | void;
}) {
  const [vals, setVals] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <ModalShell title="EDIT AHSP HEADER" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Jenis</Label>
          <Input value={vals.jenis} onChange={e => setVals({ ...vals, jenis: e.target.value })} />
        </div>
        <div>
          <Label>Deskripsi</Label>
          <Input value={vals.deskripsi} onChange={e => setVals({ ...vals, deskripsi: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Satuan</Label>
            <Input value={vals.satuan} onChange={e => setVals({ ...vals, satuan: e.target.value })} />
          </div>
          <div>
            <Label>OHP %</Label>
            <Input type="number" step="any" value={vals.ohpPct} onChange={e => setVals({ ...vals, ohpPct: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="font-mono text-xs px-3 py-2 border-2 border-neutral-300 hover:border-[var(--color-ink)]">CANCEL</button>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                jenis: vals.jenis,
                deskripsi: vals.deskripsi || undefined,
                satuan: vals.satuan,
                ohpPct: Number(vals.ohpPct),
              });
            } finally { setSaving(false); }
          }}
          className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-2 bg-[var(--color-brand)] text-white hover:bg-[var(--color-ink)]"
        >
          <Save size={14} /> {saving ? 'SAVING…' : 'SAVE'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className={`bg-white border-2 border-[var(--color-ink)] shadow-[8px_8px_0_var(--color-brand)] ${wide ? 'max-w-2xl' : 'max-w-lg'} w-full`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
          <span>{title}</span>
          <button onClick={onClose} className="hover:text-[var(--color-brand)]"><X size={14} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── INPUTS TABLE ─────────────────────────────────────────────────────────────
type InputRow = {
  id: string;
  kode: string;
  variable: string | null;
  uraian: string;
  nilai: string | null;
  satuan: string | null;
  sumber: string | null;
};

function InputsTable({
  ahspItemId, rows, editable, addMut, updateMut, deleteMut,
}: {
  ahspItemId: string;
  rows: InputRow[];
  editable: boolean;
  addMut: any; updateMut: any; deleteMut: any;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0 && !editable) return null;

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>INPUTS · PRODUCTIVITY PARAMETERS</span>
        {editable && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
            <Plus size={12} /> ADD ROW
          </button>
        )}
      </div>
      {rows.length > 0 ? (
        <table className="w-full font-mono text-xs">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-1.5 w-24">KODE</th>
              <th className="text-left px-3 py-1.5 w-32">VARIABEL</th>
              <th className="text-left px-3 py-1.5">URAIAN</th>
              <th className="text-right px-3 py-1.5 w-28">NILAI</th>
              <th className="text-left px-3 py-1.5 w-20">SAT</th>
              <th className="text-left px-3 py-1.5 w-40">SUMBER</th>
              {editable && <th className="w-20"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              editingId === p.id ? (
                <InputRowEdit
                  key={p.id}
                  initial={p}
                  onCancel={() => setEditingId(null)}
                  onSave={async vals => {
                    if (!updateMut) return alert('updateInput not available');
                    await updateMut.mutateAsync({ id: p.id, ...vals });
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={p.id} className="border-b border-neutral-100 group hover:bg-orange-50/40">
                  <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{p.kode}</td>
                  <td className="px-3 py-1.5">{p.variable ?? '—'}</td>
                  <td className="px-3 py-1.5">{p.uraian}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.nilai ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.satuan ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.sumber ?? '—'}</td>
                  {editable && (
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingId(p.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!deleteMut) return alert('deleteInput not available');
                            if (!confirm(`Delete input "${p.kode}"?`)) return;
                            await deleteMut.mutateAsync({ id: p.id });
                          }}
                          title="Delete"
                          className="p-1 hover:bg-red-50 text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
            {adding && (
              <InputRowAdd
                onCancel={() => setAdding(false)}
                onSave={async vals => {
                  if (!addMut) return alert('addInput not available');
                  await addMut.mutateAsync({ ahspItemId, ...vals });
                  setAdding(false);
                }}
              />
            )}
          </tbody>
        </table>
      ) : adding ? (
        <table className="w-full font-mono text-xs"><tbody>
          <InputRowAdd
            onCancel={() => setAdding(false)}
            onSave={async vals => {
              if (!addMut) return alert('addInput not available');
              await addMut.mutateAsync({ ahspItemId, ...vals });
              setAdding(false);
            }}
          />
        </tbody></table>
      ) : (
        <div className="px-3 py-6 text-center text-neutral-400 font-mono text-xs">No inputs.</div>
      )}
    </div>
  );
}

function InputRowEdit({ initial, onCancel, onSave }: {
  initial: InputRow;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
}) {
  const [v, setV] = useState({
    kode: initial.kode,
    variable: initial.variable ?? '',
    uraian: initial.uraian,
    nilai: initial.nilai ?? '',
    satuan: initial.satuan ?? '',
    sumber: initial.sumber ?? '',
  });
  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.sumber} onChange={e => setV({ ...v, sumber: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" className="p-1 text-[var(--color-brand)] hover:bg-orange-100" onClick={() => onSave({
            kode: v.kode,
            variable: v.variable || undefined,
            uraian: v.uraian,
            nilai: v.nilai === '' ? null : Number(v.nilai),
            satuan: v.satuan || undefined,
            sumber: v.sumber || undefined,
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function InputRowAdd({ onCancel, onSave }: { onCancel: () => void; onSave: (vals: any) => Promise<void> | void }) {
  const [v, setV] = useState({ kode: '', variable: '', uraian: '', nilai: '', satuan: '', sumber: '' });
  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" placeholder="P01" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="V_x" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Uraian" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" placeholder="0" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="m3" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="SNI..." value={v.sumber} onChange={e => setV({ ...v, sumber: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" className="p-1 text-[var(--color-brand)] hover:bg-orange-100" disabled={!v.kode || !v.uraian} onClick={() => onSave({
            kode: v.kode,
            variable: v.variable || undefined,
            uraian: v.uraian,
            nilai: v.nilai === '' ? undefined : Number(v.nilai),
            satuan: v.satuan || undefined,
            sumber: v.sumber || undefined,
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── KOEFISIEN TABLE ──────────────────────────────────────────────────────────
type KoefRow = {
  id: string;
  kode: string;
  variable: string | null;
  uraian: string | null;
  nilai: string | null;
  satuan: string | null;
  formula: string | null;
};

function KoefTable({
  ahspItemId, rows, editable, addMut, updateMut, deleteMut,
}: {
  ahspItemId: string;
  rows: KoefRow[];
  editable: boolean;
  addMut: any; updateMut: any; deleteMut: any;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0 && !editable) return null;

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>KOEFISIEN · PRODUKTIVITAS</span>
        {editable && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
            <Plus size={12} /> ADD ROW
          </button>
        )}
      </div>
      {rows.length > 0 || adding ? (
        <table className="w-full font-mono text-xs">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-1.5 w-24">KODE</th>
              <th className="text-left px-3 py-1.5 w-32">VARIABEL</th>
              <th className="text-left px-3 py-1.5">URAIAN</th>
              <th className="text-right px-3 py-1.5 w-28">NILAI</th>
              <th className="text-left px-3 py-1.5 w-20">SAT</th>
              <th className="text-left px-3 py-1.5 w-40">FORMULA</th>
              {editable && <th className="w-20"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(k => (
              editingId === k.id ? (
                <KoefRowEdit
                  key={k.id}
                  initial={k}
                  onCancel={() => setEditingId(null)}
                  onSave={async vals => {
                    if (!updateMut) return alert('updateKoefisien not available');
                    await updateMut.mutateAsync({ id: k.id, ...vals });
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={k.id} className="border-b border-neutral-100 group hover:bg-orange-50/40">
                  <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{k.kode}</td>
                  <td className="px-3 py-1.5">{k.variable ?? '—'}</td>
                  <td className="px-3 py-1.5">{k.uraian ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{k.nilai ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{k.satuan ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{k.formula ?? '—'}</td>
                  {editable && (
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingId(k.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!deleteMut) return alert('deleteKoefisien not available');
                            if (!confirm(`Delete koefisien "${k.kode}"?`)) return;
                            await deleteMut.mutateAsync({ id: k.id });
                          }}
                          title="Delete"
                          className="p-1 hover:bg-red-50 text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}
            {adding && (
              <KoefRowAdd
                onCancel={() => setAdding(false)}
                onSave={async vals => {
                  if (!addMut) return alert('addKoefisien not available');
                  await addMut.mutateAsync({ ahspItemId, ...vals });
                  setAdding(false);
                }}
              />
            )}
          </tbody>
        </table>
      ) : (
        <div className="px-3 py-6 text-center text-neutral-400 font-mono text-xs">No koefisien.</div>
      )}
    </div>
  );
}

function KoefRowEdit({ initial, onCancel, onSave }: {
  initial: KoefRow;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
}) {
  const [v, setV] = useState({
    kode: initial.kode,
    variable: initial.variable ?? '',
    uraian: initial.uraian ?? '',
    nilai: initial.nilai ?? '',
    satuan: initial.satuan ?? '',
    formula: initial.formula ?? '',
  });
  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.formula} onChange={e => setV({ ...v, formula: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" className="p-1 text-[var(--color-brand)] hover:bg-orange-100" onClick={() => onSave({
            kode: v.kode,
            variable: v.variable || undefined,
            uraian: v.uraian || undefined,
            nilai: v.nilai === '' ? null : Number(v.nilai),
            satuan: v.satuan || undefined,
            formula: v.formula || undefined,
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function KoefRowAdd({ onCancel, onSave }: { onCancel: () => void; onSave: (vals: any) => Promise<void> | void }) {
  const [v, setV] = useState({ kode: '', variable: '', uraian: '', nilai: '', satuan: '', formula: '' });
  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" placeholder="K01" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="V_x" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Uraian" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" placeholder="0" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="m3" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="A*B" value={v.formula} onChange={e => setV({ ...v, formula: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" className="p-1 text-[var(--color-brand)] hover:bg-orange-100" disabled={!v.kode} onClick={() => onSave({
            kode: v.kode,
            variable: v.variable || undefined,
            uraian: v.uraian || undefined,
            nilai: v.nilai === '' ? undefined : Number(v.nilai),
            satuan: v.satuan || undefined,
            formula: v.formula || undefined,
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── CATEGORY BLOCK (TENAGA / BAHAN / PERALATAN) ──────────────────────────────
type ResRow = {
  id: string;
  ahspItemId: string;
  category: string;
  ordinal: number;
  resourceCode: string;
  uraian: string;
  satuan: string | null;
  koefisien: string;
  hsd: string;
};

function CategoryBlock({
  cat, ahspItemId, letter, title, rows, subtotal, editable, rawRows, addMut, updateMut, deleteMut,
}: {
  cat: Cat;
  ahspItemId: string;
  letter: string;
  title: string;
  rows: { id: string; code: string; uraian: string; satuan: string | null; koefisien: number; hsd: number; subtotal: number }[];
  subtotal: number;
  editable: boolean;
  rawRows: ResRow[];
  addMut: any; updateMut: any; deleteMut: any;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const rawMap = useMemo(() => new Map(rawRows.map(r => [r.id, r])), [rawRows]);

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>
          <span className="text-[var(--color-brand)]">{letter}</span> · {title}
        </span>
        {editable && !adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
            <Plus size={12} /> ADD ROW
          </button>
        )}
      </div>
      <table className="w-full font-mono text-xs">
        <thead className="bg-neutral-100">
          <tr>
            <th className="text-left px-3 py-1.5 w-28">KODE</th>
            <th className="text-left px-3 py-1.5">URAIAN</th>
            <th className="text-left px-3 py-1.5 w-20">SATUAN</th>
            <th className="text-right px-3 py-1.5 w-28">KOEFISIEN</th>
            <th className="text-right px-3 py-1.5 w-32">HSD (Rp)</th>
            <th className="text-right px-3 py-1.5 w-36">SUBTOTAL Rp</th>
            {editable && <th className="w-20"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !adding && (
            <tr>
              <td colSpan={editable ? 7 : 6} className="px-3 py-6 text-center text-neutral-400">No lines.</td>
            </tr>
          )}
          {rows.map(l => {
            const raw = rawMap.get(l.id);
            if (editingId === l.id && raw) {
              return (
                <ResRowEdit
                  key={l.id}
                  cat={cat}
                  initial={raw}
                  onCancel={() => setEditingId(null)}
                  onSave={async vals => {
                    if (!updateMut) return alert('updateResource not available');
                    await updateMut.mutateAsync({ id: raw.id, ...vals });
                    setEditingId(null);
                  }}
                />
              );
            }
            return (
              <tr key={l.id} className="border-b border-neutral-100 group hover:bg-orange-50/40">
                <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{l.code}</td>
                <td className="px-3 py-1.5">{l.uraian}</td>
                <td className="px-3 py-1.5 text-neutral-500">{l.satuan ?? '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.koefisien.toLocaleString('id-ID', { maximumFractionDigits: 6 })}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtIDR(l.hsd)}</td>
                <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(l.subtotal)}</td>
                {editable && (
                  <td className="px-2 py-1 text-right">
                    <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setEditingId(l.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!deleteMut) return alert('deleteResource not available');
                          if (!confirm(`Delete row "${l.code}"?`)) return;
                          await deleteMut.mutateAsync({ id: l.id });
                        }}
                        title="Delete"
                        className="p-1 hover:bg-red-50 text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {editable && adding && (
            <ResRowAdd
              cat={cat}
              onCancel={() => setAdding(false)}
              onSave={async vals => {
                if (!addMut) return alert('addResource not available');
                await addMut.mutateAsync({ ahspItemId, category: cat, ...vals });
                setAdding(false);
              }}
            />
          )}
          <tr className="bg-neutral-100">
            <td colSpan={5} className="px-3 py-2 text-right font-bold">
              SUBTOTAL {letter} · {title}
            </td>
            <td className="px-3 py-2 text-right font-bold text-[var(--color-brand)] tabular-nums text-sm">{fmtIDR(subtotal)}</td>
            {editable && <td></td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ResRowEdit({ cat: _cat, initial, onCancel, onSave }: {
  cat: Cat;
  initial: ResRow;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
}) {
  const [v, setV] = useState({
    uraian: initial.uraian,
    satuan: initial.satuan ?? '',
    koefisien: String(initial.koefisien ?? '0'),
    hsd: String(initial.hsd ?? '0'),
  });
  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-3 py-1.5 font-bold text-[var(--color-brand)] font-mono text-xs">{initial.resourceCode}</td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.koefisien} onChange={e => setV({ ...v, koefisien: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.hsd} onChange={e => setV({ ...v, hsd: e.target.value })} /></td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(Number(v.koefisien) * Number(v.hsd))}</td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" className="p-1 text-[var(--color-brand)] hover:bg-orange-100" onClick={() => onSave({
            uraian: v.uraian,
            satuan: v.satuan || undefined,
            koefisien: Number(v.koefisien),
            hsd: Number(v.hsd),
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ResRowAdd({ cat, onCancel, onSave }: {
  cat: Cat;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
}) {
  const [kode, setKode] = useState('');
  const [uraian, setUraian] = useState('');
  const [satuan, setSatuan] = useState('');
  const [koef, setKoef] = useState('0');
  const [hsd, setHsd] = useState('0');
  const [showSuggest, setShowSuggest] = useState(false);
  const debouncedKode = useDebounced(kode, 200);

  // Master resource autocomplete — silently no-op if procedure unavailable.
  const rmQuery = (trpc as any).resourceMaster?.list?.useQuery?.(
    { category: cat, q: debouncedKode },
    { enabled: debouncedKode.length >= 1 },
  );
  const suggestions: any[] = rmQuery?.data ?? [];

  const pickSuggestion = (s: any) => {
    setKode(s.kode);
    setUraian(s.nama ?? '');
    setSatuan(s.satuan ?? '');
    if (s.defaultHsd != null) setHsd(String(s.defaultHsd));
    setShowSuggest(false);
  };

  return (
    <tr className="border-b border-neutral-200 bg-orange-50">
      <td className="px-2 py-1 relative">
        <Input
          className="text-xs py-1 font-mono"
          placeholder="L01 / B01 …"
          value={kode}
          onChange={e => { setKode(e.target.value); setShowSuggest(true); }}
          onFocus={() => setShowSuggest(true)}
        />
        {showSuggest && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-72 max-h-56 overflow-y-auto bg-white border-2 border-[var(--color-ink)] shadow-lg">
            {suggestions.slice(0, 10).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="w-full text-left px-2 py-1.5 hover:bg-orange-100 border-b border-neutral-100 last:border-0"
              >
                <div className="font-mono text-xs font-bold text-[var(--color-brand)]">{s.kode}</div>
                <div className="text-xs">{s.nama}</div>
                <div className="text-[10px] text-neutral-500">{s.satuan} · Rp {Number(s.defaultHsd ?? 0).toLocaleString('id-ID')}</div>
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Uraian" value={uraian} onChange={e => setUraian(e.target.value)} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Jam/m3" value={satuan} onChange={e => setSatuan(e.target.value)} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={koef} onChange={e => setKoef(e.target.value)} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={hsd} onChange={e => setHsd(e.target.value)} /></td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(Number(koef) * Number(hsd))}</td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save" disabled={!kode || !uraian} className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" onClick={() => onSave({
            kode, uraian, satuan: satuan || undefined, koefisien: Number(koef), hsd: Number(hsd),
          })}>
            <Check size={14} />
          </button>
          <button title="Cancel" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ─── HISTORY DRAWER ───────────────────────────────────────────────────────────
function HistoryDrawer({
  ahspItemId, onClose, onRestore,
}: {
  ahspItemId: string;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}) {
  const versionsQ = (trpc.ahsp as any).versions?.useQuery?.({ ahspItemId, limit: 50 });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-md h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center sticky top-0">
          <span>VERSION HISTORY</span>
          <button onClick={onClose} className="hover:text-[var(--color-brand)]"><X size={14} /></button>
        </div>
        <div className="p-4">
          {!versionsQ?.data ? (
            <div className="font-mono text-xs text-neutral-500">Loading…</div>
          ) : versionsQ.data.length === 0 ? (
            <div className="font-mono text-xs text-neutral-400 text-center py-8">No version history yet.</div>
          ) : (
            <div className="space-y-2">
              {versionsQ.data.map((v: any) => (
                <div key={v.id} className="border border-neutral-200 hover:border-[var(--color-ink)] p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-mono text-xs font-bold text-[var(--color-brand)]">v{v.versionNumber}</div>
                    <div className="font-mono text-[10px] text-neutral-500">
                      {v.createdAt ? new Date(v.createdAt).toLocaleString('id-ID') : ''}
                    </div>
                  </div>
                  <div className="font-mono text-xs mt-1">{v.changeSummary ?? '—'}</div>
                  <div className="font-mono text-[10px] text-neutral-500 mt-1">
                    by {v.changedByName ?? v.changedByEmail ?? 'unknown'}
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => onRestore(v.id)}
                      className="font-mono text-[10px] px-2 py-1 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white tracking-wider"
                    >
                      RESTORE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
