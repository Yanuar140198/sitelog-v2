'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { evalFormula } from '@sitelog/shared/formula';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, ChevronLeft, History, Pencil, Plus, Printer, Copy,
  Save, Trash2, X, Check, AlertTriangle, Edit3, Eye, Zap,
} from 'lucide-react';

const CATS = ['tenaga', 'bahan', 'peralatan'] as const;
type Cat = typeof CATS[number];

// Format a koefisien value the Indonesian way (comma decimals), up to 4 dp.
function fmtKoef(n: number, maxDp = 4): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: maxDp });
}
const CAT_META: Record<Cat, { letter: string; title: string }> = {
  tenaga:    { letter: 'A', title: 'TENAGA KERJA' },
  bahan:     { letter: 'B', title: 'BAHAN' },
  peralatan: { letter: 'C', title: 'PERALATAN' },
};

// Category color map for header badge
const CATEGORY_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  galian:      { bg: '#7c4a1e', fg: 'white',  label: 'GALIAN' },
  timbunan:    { bg: '#c9a875', fg: 'black',  label: 'TIMBUNAN' },
  drainase:    { bg: '#2563eb', fg: 'white',  label: 'DRAINASE' },
  struktur:    { bg: '#525252', fg: 'white',  label: 'STRUKTUR' },
  perkerasan:  { bg: '#171717', fg: 'white',  label: 'PERKERASAN' },
  pembersihan: { bg: '#16a34a', fg: 'white',  label: 'PEMBERSIHAN' },
  haul:        { bg: '#0891b2', fg: 'white',  label: 'HAUL' },
  finishing:   { bg: '#9333ea', fg: 'white',  label: 'FINISHING' },
  overhead:    { bg: '#a16207', fg: 'white',  label: 'OVERHEAD' },
  'lain-lain': { bg: '#737373', fg: 'white',  label: 'LAIN-LAIN' },
};

// ─── TOAST CONTEXT ────────────────────────────────────────────────────────────
type Toast = { id: number; kind: 'success' | 'error'; msg: string };
let _toastId = 0;
type ToastFn = (kind: 'success' | 'error', msg: string) => void;

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto px-3 py-2 font-mono text-xs border-2 shadow-[4px_4px_0_var(--color-brand)] flex items-center gap-2 min-w-[180px] ${
            t.kind === 'success'
              ? 'bg-white border-[var(--color-ink)] text-[var(--color-ink)]'
              : 'bg-red-50 border-red-600 text-red-700'
          }`}
        >
          {t.kind === 'success' ? <Check size={14} className="text-[var(--color-brand)]" /> : <AlertTriangle size={14} />}
          <span className="flex-1">{t.msg}</span>
          {t.kind === 'error' && (
            <button onClick={() => dismiss(t.id)} className="hover:text-red-900"><X size={12} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);
  const push: ToastFn = useCallback((kind, msg) => {
    const id = ++_toastId;
    setToasts(ts => [...ts, { id, kind, msg }]);
    if (kind === 'success') {
      setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 2000);
    }
  }, []);
  return { toasts, push, dismiss };
}

// Inline "Are you sure?" delete confirm button
function DeleteConfirm({ label, onConfirm }: { label?: string; onConfirm: () => void | Promise<void> }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        title={label ?? 'Delete'}
        className="p-1 hover:bg-red-50 text-red-600"
      >
        <Trash2 size={12} />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-red-100 border border-red-400 px-1.5 py-0.5">
      <span className="font-mono text-[10px] text-red-700">SURE?</span>
      <button
        onClick={async () => { setArmed(false); await onConfirm(); }}
        className="text-red-700 hover:text-red-900 font-mono text-[10px] font-bold"
        title="Yes, delete"
      >
        YES
      </button>
      <button
        onClick={() => setArmed(false)}
        className="text-neutral-600 hover:text-neutral-900"
        title="Cancel"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// Keyboard handler factory for inline-edit rows
function rowKeyHandler(opts: { onSave: () => void; onCancel: () => void; rowEl?: HTMLElement | null }) {
  return (e: React.KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { e.preventDefault(); opts.onCancel(); return; }
    if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); opts.onSave(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input') { e.preventDefault(); opts.onSave(); return; }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const row = (e.target as HTMLElement).closest('tr');
      if (!row) return;
      const sibling = (e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling) as HTMLElement | null;
      if (!sibling) return;
      // try same column index
      const cellIdx = Array.from(row.children).indexOf((e.target as HTMLElement).closest('td') as Element);
      const cell = sibling.children[cellIdx] as HTMLElement | undefined;
      const inp = cell?.querySelector('input,select,button') as HTMLElement | null;
      if (inp) { e.preventDefault(); inp.focus(); }
    }
  };
}

export default function AhspDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const breakdown = trpc.ahsp.detailBreakdown.useQuery({ ahspItemId: id });
  const detail = trpc.ahsp.detail.useQuery({ id });
  const catalog = trpc.ahsp.catalog.useQuery();
  const utils = trpc.useUtils();
  const { toasts, push: toast, dismiss } = useToasts();
  const [dirtyCount, setDirtyCount] = useState(0);
  const bumpDirty = useCallback((delta: number) => setDirtyCount(c => Math.max(0, c + delta)), []);

  const refresh = () => {
    utils.ahsp.detail.invalidate({ id });
    utils.ahsp.detailBreakdown.invalidate({ ahspItemId: id });
  };

  const mkOpts = (label: string) => ({
    onSuccess: () => { refresh(); toast('success', `${label} saved`); },
    onError: (e: any) => toast('error', `${label}: ${e?.message ?? 'failed'}`),
  });

  // Mutations — use loose casts so the page still compiles if a procedure isn't
  // yet wired in some environments.
  const ahspMut = trpc.ahsp as any;
  const updateMeta = ahspMut.updateMeta?.useMutation(mkOpts('Header'));
  const addResource = ahspMut.addResource?.useMutation(mkOpts('Resource added'));
  const updateResource = ahspMut.updateResource?.useMutation(mkOpts('Resource'));
  const deleteResource = ahspMut.deleteResource?.useMutation(mkOpts('Resource deleted'));
  const resourceUpsert = ahspMut.resourceUpsert?.useMutation(mkOpts('Formula'));
  const addInput = ahspMut.addInput?.useMutation(mkOpts('Input added'));
  const updateInput = ahspMut.updateInput?.useMutation(mkOpts('Input'));
  const deleteInput = ahspMut.deleteInput?.useMutation(mkOpts('Input deleted'));
  const addKoefisien = ahspMut.addKoefisien?.useMutation(mkOpts('Koefisien added'));
  const updateKoefisien = ahspMut.updateKoefisien?.useMutation(mkOpts('Koefisien'));
  const deleteKoefisien = ahspMut.deleteKoefisien?.useMutation(mkOpts('Koefisien deleted'));
  const restoreVersion = ahspMut.restoreVersion?.useMutation(mkOpts('Version restored'));
  const cloneMut = ahspMut.clone?.useMutation();

  const [editHeader, setEditHeader] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editMode, setEditMode] = useState(true); // default ON for editable
  const lastSectionRef = useRef<Cat | 'inputs' | 'koef'>('tenaga');
  const addRequestRef = useRef<{ target: Cat | 'inputs' | 'koef' | null; ts: number }>({ target: null, ts: 0 });
  const [addNonce, setAddNonce] = useState(0);

  const requestAdd = useCallback((target: Cat | 'inputs' | 'koef') => {
    lastSectionRef.current = target;
    addRequestRef.current = { target, ts: Date.now() };
    setAddNonce(n => n + 1);
  }, []);

  // Global keyboard shortcuts: Cmd/Ctrl+N (new row), Esc handled by children
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        requestAdd(lastSectionRef.current as any);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestAdd]);

  if (!breakdown.data || !detail.data) {
    return <div className="p-8 font-mono text-sm">Loading...</div>;
  }
  const { item, sections, totals, inputs: breakdownInputs } = breakdown.data;
  const { resources, koefisien, inputs: rawInputs, item: rawItem } = detail.data;
  const isEditable = Boolean(rawItem.organizationId);

  // Variables usable inside resource formulas, derived from the item's inputs.
  // Only inputs with a non-empty `variable` and a numeric `nilai` participate.
  const formulaVars: Record<string, number> = {};
  for (const i of breakdownInputs ?? []) {
    if (i.variable && i.nilai != null && Number.isFinite(Number(i.nilai))) {
      formulaVars[i.variable] = Number(i.nilai);
    }
  }
  const varEntries = Object.entries(formulaVars);

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
        <div className="border-2 border-amber-500 bg-amber-50 p-5 flex items-center gap-4">
          <AlertTriangle className="text-amber-600 shrink-0" size={28} />
          <div className="flex-1">
            <div className="font-mono text-sm tracking-[0.2em] text-amber-800 font-bold">GLOBAL CATALOG · READ-ONLY</div>
            <div className="font-mono text-xs text-amber-700 mt-1">
              This is a shared global AHSP item. Clone it to your organization to edit lines, coefficients, and unit rates.
            </div>
          </div>
          <button
            onClick={handleClone}
            className="inline-flex items-center gap-2 font-mono text-sm font-bold tracking-wider px-5 py-3 bg-[var(--color-brand)] text-white border-2 border-[var(--color-brand)] hover:bg-[var(--color-ink)] hover:border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)] hover:shadow-[2px_2px_0_var(--color-ink)] transition-all"
          >
            <Copy size={18} /> CLONE TO EDIT
          </button>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-5">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">
          {item.kode}
          {item.deskripsi ? <span className="ml-3 text-neutral-400">· {item.deskripsi}</span> : null}
        </div>
        <div className="flex items-start justify-between gap-4 mt-1">
          <h1 className="font-display text-3xl font-bold flex-1 min-w-0">{item.jenis}</h1>
          <div className="text-right shrink-0">
            <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">RATE PER {item.satuan}</div>
            <div className="font-display text-3xl font-bold text-[var(--color-brand)] tabular-nums">
              {fmtIDR(totals.unitRate)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="font-mono text-xs px-2 py-1 bg-[var(--color-ink)] text-white tracking-wider">
            SATUAN · {item.satuan}
          </span>
          {(() => {
            const c = (rawItem.category ?? '').toLowerCase();
            const meta = CATEGORY_COLORS[c];
            if (!meta) return null;
            return (
              <span
                className="font-mono text-xs px-2 py-1 tracking-wider"
                style={{ backgroundColor: meta.bg, color: meta.fg }}
              >
                {meta.label}
              </span>
            );
          })()}
          <span className="font-mono text-xs px-2 py-1 border border-[var(--color-ink)] tracking-wider">
            OHP · {item.ohpPct}%
          </span>
          {isEditable && (
            <>
              <span className="w-px h-5 bg-neutral-300 mx-1" />
              <button
                onClick={() => setEditMode(m => !m)}
                className={`inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1 border-2 tracking-wider ${
                  editMode
                    ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                    : 'border-neutral-300 hover:border-[var(--color-ink)]'
                }`}
                title="Toggle edit mode (rows show inline inputs)"
              >
                {editMode ? <Edit3 size={12} /> : <Eye size={12} />}
                EDIT MODE · {editMode ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setEditHeader(true)}
                className="font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)] inline-flex items-center gap-1 px-2 py-1"
                title="Edit header metadata"
              >
                <Pencil size={12} /> HEADER
              </button>
              {dirtyCount > 0 && (
                <span className="font-mono text-[10px] px-2 py-1 bg-amber-100 border border-amber-400 text-amber-800 tracking-wider animate-pulse">
                  UNSAVED CHANGES · {dirtyCount}
                </span>
              )}
            </>
          )}
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
        editMode={editMode}
        addMut={addInput}
        updateMut={updateInput}
        deleteMut={deleteInput}
        onDirty={bumpDirty}
        addSignal={addRequestRef.current.target === 'inputs' ? addNonce : 0}
        onFocusSection={() => { lastSectionRef.current = 'inputs'; }}
      />

      {/* KOEFISIEN / PRODUCTIVITY */}
      <KoefTable
        ahspItemId={id}
        rows={koefisien}
        editable={isEditable}
        editMode={editMode}
        addMut={addKoefisien}
        updateMut={updateKoefisien}
        deleteMut={deleteKoefisien}
        onDirty={bumpDirty}
        addSignal={addRequestRef.current.target === 'koef' ? addNonce : 0}
        onFocusSection={() => { lastSectionRef.current = 'koef'; }}
      />

      {/* FORMULA LEGEND — discoverability for the formula feature */}
      {isEditable && <FormulaLegend varEntries={varEntries} />}

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
          editMode={editMode}
          rawRows={resources.filter(r => r.category === cat)}
          formulaVars={formulaVars}
          addMut={addResource}
          updateMut={updateResource}
          deleteMut={deleteResource}
          upsertMut={resourceUpsert}
          onDirty={bumpDirty}
          addSignal={addRequestRef.current.target === cat ? addNonce : 0}
          onFocusSection={() => { lastSectionRef.current = cat; }}
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
            if (!restoreVersion) { toast('error', 'restoreVersion not available'); return; }
            if (!confirm('Restore this version? Current state will be saved as a snapshot first.')) return;
            await restoreVersion.mutateAsync({ versionId });
            setShowHistory(false);
          }}
        />
      )}

      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* Keyboard shortcut hint footer */}
      {isEditable && editMode && (
        <div className="font-mono text-[10px] text-neutral-500 tracking-wider flex flex-wrap gap-3 pt-2">
          <span><kbd className="px-1 border border-neutral-300">Ctrl/Cmd+N</kbd> new row</span>
          <span><kbd className="px-1 border border-neutral-300">Ctrl/Cmd+S</kbd> save</span>
          <span><kbd className="px-1 border border-neutral-300">Esc</kbd> cancel</span>
          <span><kbd className="px-1 border border-neutral-300">Tab</kbd> next field</span>
          <span><kbd className="px-1 border border-neutral-300">↑/↓</kbd> navigate rows</span>
        </div>
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
  ahspItemId, rows, editable, editMode, addMut, updateMut, deleteMut, onDirty, addSignal, onFocusSection,
}: {
  ahspItemId: string;
  rows: InputRow[];
  editable: boolean;
  editMode: boolean;
  addMut: any; updateMut: any; deleteMut: any;
  onDirty: (delta: number) => void;
  addSignal: number;
  onFocusSection: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // External add request (Ctrl+N or top-level Add button)
  useEffect(() => {
    if (addSignal && editable) { setAdding(true); }
  }, [addSignal, editable]);

  if (rows.length === 0 && !editable) return null;

  // When editMode is ON, treat every row as inline-editable by default
  const rowIsEditing = (rid: string) => editingId === rid || (editable && editMode);

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white" onFocus={onFocusSection}>
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>INPUTS · PRODUCTIVITY PARAMETERS</span>
        {editable && !adding && (
          <button onClick={() => { onFocusSection(); setAdding(true); }} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
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
              rowIsEditing(p.id) ? (
                <InputRowEdit
                  key={p.id}
                  initial={p}
                  onCancel={() => setEditingId(null)}
                  onDirty={onDirty}
                  onDelete={async () => {
                    if (!deleteMut) return;
                    await deleteMut.mutateAsync({ id: p.id });
                  }}
                  onSave={async vals => {
                    if (!updateMut) return;
                    await updateMut.mutateAsync({ id: p.id, ...vals });
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={p.id} className="border-b border-neutral-100 hover:bg-orange-50/40">
                  <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{p.kode}</td>
                  <td className="px-3 py-1.5">{p.variable ?? '—'}</td>
                  <td className="px-3 py-1.5">{p.uraian}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.nilai ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.satuan ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.sumber ?? '—'}</td>
                  {editable && (
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditingId(p.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                          <Pencil size={12} />
                        </button>
                        <DeleteConfirm
                          label={`Delete input ${p.kode}`}
                          onConfirm={async () => { if (deleteMut) await deleteMut.mutateAsync({ id: p.id }); }}
                        />
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

function InputRowEdit({ initial, onCancel, onSave, onDirty, onDelete }: {
  initial: InputRow;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
  onDirty?: (delta: number) => void;
  onDelete?: () => Promise<void> | void;
}) {
  const [v, setV] = useState({
    kode: initial.kode,
    variable: initial.variable ?? '',
    uraian: initial.uraian,
    nilai: initial.nilai ?? '',
    satuan: initial.satuan ?? '',
    sumber: initial.sumber ?? '',
  });
  const dirtyRef = useRef(false);
  const isDirty =
    v.kode !== initial.kode ||
    v.variable !== (initial.variable ?? '') ||
    v.uraian !== initial.uraian ||
    String(v.nilai) !== String(initial.nilai ?? '') ||
    v.satuan !== (initial.satuan ?? '') ||
    v.sumber !== (initial.sumber ?? '');
  useEffect(() => {
    if (isDirty && !dirtyRef.current) { dirtyRef.current = true; onDirty?.(+1); }
    if (!isDirty && dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  }, [isDirty, onDirty]);
  useEffect(() => () => { if (dirtyRef.current) onDirty?.(-1); }, [onDirty]);

  const doSave = () => {
    onSave({
      kode: v.kode,
      variable: v.variable || undefined,
      uraian: v.uraian,
      nilai: v.nilai === '' ? null : Number(v.nilai),
      satuan: v.satuan || undefined,
      sumber: v.sumber || undefined,
    });
    if (dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  };
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });
  return (
    <tr className={`border-b border-neutral-200 ${isDirty ? 'bg-orange-50' : 'hover:bg-orange-50/40'}`} onKeyDown={onKey}>
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.sumber} onChange={e => setV({ ...v, sumber: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1 items-center">
          <button title="Save (Enter / Ctrl+S)" className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" disabled={!isDirty} onClick={doSave}>
            <Check size={14} />
          </button>
          <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
          {onDelete && (
            <DeleteConfirm label={`Delete input ${initial.kode}`} onConfirm={onDelete} />
          )}
        </div>
      </td>
    </tr>
  );
}

function InputRowAdd({ onCancel, onSave }: { onCancel: () => void; onSave: (vals: any) => Promise<void> | void }) {
  const [v, setV] = useState({ kode: '', variable: '', uraian: '', nilai: '', satuan: '', sumber: '' });
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const canSave = !!v.kode && !!v.uraian;
  const doSave = () => {
    if (!canSave) return;
    onSave({
      kode: v.kode,
      variable: v.variable || undefined,
      uraian: v.uraian,
      nilai: v.nilai === '' ? undefined : Number(v.nilai),
      satuan: v.satuan || undefined,
      sumber: v.sumber || undefined,
    });
  };
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });
  return (
    <tr className="border-b-2 border-[var(--color-brand)] bg-orange-100" onKeyDown={onKey}>
      <td className="px-2 py-1"><Input ref={firstRef as any} className="text-xs py-1 font-mono" placeholder="P01" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="V_x" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Uraian" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" placeholder="0" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="m3" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="SNI..." value={v.sumber} onChange={e => setV({ ...v, sumber: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save (Enter / Ctrl+S)" className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" disabled={!canSave} onClick={doSave}>
            <Check size={14} />
          </button>
          <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
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
  ahspItemId, rows, editable, editMode, addMut, updateMut, deleteMut, onDirty, addSignal, onFocusSection,
}: {
  ahspItemId: string;
  rows: KoefRow[];
  editable: boolean;
  editMode: boolean;
  addMut: any; updateMut: any; deleteMut: any;
  onDirty: (delta: number) => void;
  addSignal: number;
  onFocusSection: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (addSignal && editable) { setAdding(true); }
  }, [addSignal, editable]);

  if (rows.length === 0 && !editable) return null;

  const rowIsEditing = (rid: string) => editingId === rid || (editable && editMode);

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white" onFocus={onFocusSection}>
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>KOEFISIEN · PRODUKTIVITAS</span>
        {editable && !adding && (
          <button onClick={() => { onFocusSection(); setAdding(true); }} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
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
              rowIsEditing(k.id) ? (
                <KoefRowEdit
                  key={k.id}
                  initial={k}
                  onCancel={() => setEditingId(null)}
                  onDirty={onDirty}
                  onDelete={async () => { if (deleteMut) await deleteMut.mutateAsync({ id: k.id }); }}
                  onSave={async vals => {
                    if (!updateMut) return;
                    await updateMut.mutateAsync({ id: k.id, ...vals });
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={k.id} className="border-b border-neutral-100 hover:bg-orange-50/40">
                  <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{k.kode}</td>
                  <td className="px-3 py-1.5">{k.variable ?? '—'}</td>
                  <td className="px-3 py-1.5">{k.uraian ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{k.nilai ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{k.satuan ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{k.formula ?? '—'}</td>
                  {editable && (
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditingId(k.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                          <Pencil size={12} />
                        </button>
                        <DeleteConfirm
                          label={`Delete koefisien ${k.kode}`}
                          onConfirm={async () => { if (deleteMut) await deleteMut.mutateAsync({ id: k.id }); }}
                        />
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

function KoefRowEdit({ initial, onCancel, onSave, onDirty, onDelete }: {
  initial: KoefRow;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
  onDirty?: (delta: number) => void;
  onDelete?: () => Promise<void> | void;
}) {
  const [v, setV] = useState({
    kode: initial.kode,
    variable: initial.variable ?? '',
    uraian: initial.uraian ?? '',
    nilai: initial.nilai ?? '',
    satuan: initial.satuan ?? '',
    formula: initial.formula ?? '',
  });
  const dirtyRef = useRef(false);
  const isDirty =
    v.kode !== initial.kode ||
    v.variable !== (initial.variable ?? '') ||
    v.uraian !== (initial.uraian ?? '') ||
    String(v.nilai) !== String(initial.nilai ?? '') ||
    v.satuan !== (initial.satuan ?? '') ||
    v.formula !== (initial.formula ?? '');
  useEffect(() => {
    if (isDirty && !dirtyRef.current) { dirtyRef.current = true; onDirty?.(+1); }
    if (!isDirty && dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  }, [isDirty, onDirty]);
  useEffect(() => () => { if (dirtyRef.current) onDirty?.(-1); }, [onDirty]);

  const doSave = () => {
    onSave({
      kode: v.kode,
      variable: v.variable || undefined,
      uraian: v.uraian || undefined,
      nilai: v.nilai === '' ? null : Number(v.nilai),
      satuan: v.satuan || undefined,
      formula: v.formula || undefined,
    });
    if (dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  };
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });
  return (
    <tr className={`border-b border-neutral-200 ${isDirty ? 'bg-orange-50' : 'hover:bg-orange-50/40'}`} onKeyDown={onKey}>
      <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.formula} onChange={e => setV({ ...v, formula: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1 items-center">
          <button title="Save (Enter / Ctrl+S)" className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" disabled={!isDirty} onClick={doSave}>
            <Check size={14} />
          </button>
          <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
          {onDelete && (
            <DeleteConfirm label={`Delete koefisien ${initial.kode}`} onConfirm={onDelete} />
          )}
        </div>
      </td>
    </tr>
  );
}

function KoefRowAdd({ onCancel, onSave }: { onCancel: () => void; onSave: (vals: any) => Promise<void> | void }) {
  const [v, setV] = useState({ kode: '', variable: '', uraian: '', nilai: '', satuan: '', formula: '' });
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const canSave = !!v.kode;
  const doSave = () => {
    if (!canSave) return;
    onSave({
      kode: v.kode,
      variable: v.variable || undefined,
      uraian: v.uraian || undefined,
      nilai: v.nilai === '' ? undefined : Number(v.nilai),
      satuan: v.satuan || undefined,
      formula: v.formula || undefined,
    });
  };
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });
  return (
    <tr className="border-b-2 border-[var(--color-brand)] bg-orange-100" onKeyDown={onKey}>
      <td className="px-2 py-1"><Input ref={firstRef as any} className="text-xs py-1 font-mono" placeholder="K01" value={v.kode} onChange={e => setV({ ...v, kode: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="V_x" value={v.variable} onChange={e => setV({ ...v, variable: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Uraian" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" placeholder="0" value={v.nilai} onChange={e => setV({ ...v, nilai: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="m3" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="A*B" value={v.formula} onChange={e => setV({ ...v, formula: e.target.value })} /></td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1">
          <button title="Save (Enter / Ctrl+S)" className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" disabled={!canSave} onClick={doSave}>
            <Check size={14} />
          </button>
          <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
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
  cat, ahspItemId, letter, title, rows, subtotal, editable, editMode, rawRows, formulaVars, addMut, updateMut, deleteMut, upsertMut, onDirty, addSignal, onFocusSection,
}: {
  cat: Cat;
  ahspItemId: string;
  letter: string;
  title: string;
  rows: { id: string; code: string; uraian: string; satuan: string | null; koefisien: number; formula: string | null; hsd: number; subtotal: number }[];
  subtotal: number;
  editable: boolean;
  editMode: boolean;
  rawRows: ResRow[];
  formulaVars: Record<string, number>;
  addMut: any; updateMut: any; deleteMut: any; upsertMut: any;
  onDirty: (delta: number) => void;
  addSignal: number;
  onFocusSection: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const rawMap = useMemo(() => new Map(rawRows.map(r => [r.id, r])), [rawRows]);
  // Map id -> formula from the breakdown (rawRows/ResRow don't carry formula).
  const formulaMap = useMemo(() => new Map(rows.map(r => [r.id, r.formula])), [rows]);

  useEffect(() => {
    if (addSignal && editable) { setAdding(true); }
  }, [addSignal, editable]);

  const rowIsEditing = (rid: string) => editingId === rid || (editable && editMode);

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white" onFocus={onFocusSection}>
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>
          <span className="text-[var(--color-brand)]">{letter}</span> · {title}
        </span>
        {editable && !adding && (
          <button onClick={() => { onFocusSection(); setAdding(true); }} className="inline-flex items-center gap-1 text-[var(--color-brand)] hover:text-white">
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
            if (rowIsEditing(l.id) && raw) {
              return (
                <ResRowEdit
                  key={l.id}
                  cat={cat}
                  ahspItemId={ahspItemId}
                  initial={raw}
                  initialFormula={formulaMap.get(l.id) ?? null}
                  formulaVars={formulaVars}
                  onCancel={() => setEditingId(null)}
                  onDirty={onDirty}
                  onDelete={async () => { if (deleteMut) await deleteMut.mutateAsync({ id: raw.id }); }}
                  onSave={async vals => {
                    // When a formula is present, save through resourceUpsert so the
                    // server recomputes + stores the koefisien from the formula.
                    if (vals.formula && upsertMut) {
                      await upsertMut.mutateAsync({
                        ahspItemId,
                        id: raw.id,
                        category: raw.category,
                        ordinal: raw.ordinal,
                        resourceCode: raw.resourceCode,
                        uraian: vals.uraian,
                        koefisien: vals.koefisien,
                        formula: vals.formula,
                        satuan: vals.satuan,
                        hsd: vals.hsd,
                      });
                      setEditingId(null);
                      return;
                    }
                    if (!updateMut) return;
                    await updateMut.mutateAsync({ id: raw.id, uraian: vals.uraian, satuan: vals.satuan, koefisien: vals.koefisien, hsd: vals.hsd });
                    setEditingId(null);
                  }}
                />
              );
            }
            return (
              <tr key={l.id} className="border-b border-neutral-100 hover:bg-orange-50/40 align-top">
                <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{l.code}</td>
                <td className="px-3 py-1.5">
                  <div>{l.uraian}</div>
                  {/* Explicit line math: koefisien × HSD = subtotal */}
                  <div className="text-[10px] text-neutral-400 tabular-nums mt-0.5">
                    {fmtKoef(l.koefisien, 6)} × {fmtIDR(l.hsd)} = {fmtIDR(l.subtotal)}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-neutral-500">{l.satuan ?? '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {l.formula ? (
                    <div className="leading-tight">
                      <div className="text-[10px] text-neutral-400 font-normal break-words">{l.formula} =</div>
                      <div className="font-bold">{fmtKoef(l.koefisien, 6)}</div>
                    </div>
                  ) : (
                    fmtKoef(l.koefisien, 6)
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtIDR(l.hsd)}</td>
                <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(l.subtotal)}</td>
                {editable && (
                  <td className="px-2 py-1 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditingId(l.id)} title="Edit" className="p-1 hover:bg-neutral-200">
                        <Pencil size={12} />
                      </button>
                      <DeleteConfirm
                        label={`Delete row ${l.code}`}
                        onConfirm={async () => { if (deleteMut) await deleteMut.mutateAsync({ id: l.id }); }}
                      />
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

// ─── FORMULA LEGEND ───────────────────────────────────────────────────────────
function FormulaLegend({ varEntries }: { varEntries: [string, number][] }) {
  return (
    <div className="border-2 border-dashed border-neutral-300 bg-neutral-50 p-3 font-mono text-xs">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tracking-[0.2em] text-neutral-500">VARIABEL FORMULA</span>
        {varEntries.length > 0 ? (
          varEntries.map(([name, val]) => (
            <span key={name} className="px-1.5 py-0.5 bg-white border border-neutral-300 tabular-nums">
              <span className="font-bold text-[var(--color-brand)]">{name}</span>
              <span className="text-neutral-400"> = </span>
              <span>{fmtKoef(val, 6)}</span>
            </span>
          ))
        ) : (
          <span className="text-neutral-400">
            Belum ada variabel — tambahkan baris INPUTS dengan kolom VARIABEL + NILAI.
          </span>
        )}
      </div>
      <div className="text-[10px] text-neutral-500 mt-2">
        Gunakan <span className="text-neutral-700">+ - × ÷ ( )</span> dan variabel di atas. Contoh:{' '}
        <span className="text-neutral-700">1 / (Q1 × n)</span>
      </div>
    </div>
  );
}

function ResRowEdit({ cat: _cat, ahspItemId: _ahspItemId, initial, initialFormula, formulaVars, onCancel, onSave, onDirty, onDelete }: {
  cat: Cat;
  ahspItemId: string;
  initial: ResRow;
  initialFormula: string | null;
  formulaVars: Record<string, number>;
  onCancel: () => void;
  onSave: (vals: any) => Promise<void> | void;
  onDirty?: (delta: number) => void;
  onDelete?: () => Promise<void> | void;
}) {
  const [v, setV] = useState({
    uraian: initial.uraian,
    satuan: initial.satuan ?? '',
    koefisien: String(initial.koefisien ?? '0'),
    hsd: String(initial.hsd ?? '0'),
    formula: initialFormula ?? '',
  });
  const dirtyRef = useRef(false);
  const isDirty =
    v.uraian !== initial.uraian ||
    v.satuan !== (initial.satuan ?? '') ||
    v.koefisien !== String(initial.koefisien ?? '0') ||
    v.hsd !== String(initial.hsd ?? '0') ||
    v.formula !== (initialFormula ?? '');
  useEffect(() => {
    if (isDirty && !dirtyRef.current) { dirtyRef.current = true; onDirty?.(+1); }
    if (!isDirty && dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  }, [isDirty, onDirty]);
  useEffect(() => () => { if (dirtyRef.current) onDirty?.(-1); }, [onDirty]);

  // Live preview of the formula against the item's input variables.
  const hasFormula = v.formula.trim().length > 0;
  const preview = hasFormula ? evalFormula(v.formula, formulaVars) : null;
  // Effective koefisien: derived from formula when valid, else the manual value.
  const effKoef = preview?.ok ? preview.value : Number(v.koefisien);

  const doSave = () => {
    // If a formula is typed but invalid, block the save (server would reject anyway).
    if (hasFormula && preview && !preview.ok) return;
    onSave({
      uraian: v.uraian,
      satuan: v.satuan || undefined,
      koefisien: effKoef,
      hsd: Number(v.hsd),
      formula: hasFormula ? v.formula.trim() : undefined,
    });
    if (dirtyRef.current) { dirtyRef.current = false; onDirty?.(-1); }
  };
  const saveDisabled = !isDirty || (hasFormula && !!preview && !preview.ok);
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });
  return (
    <tr className={`border-b border-neutral-200 align-top ${isDirty ? 'bg-orange-50' : 'hover:bg-orange-50/40'}`} onKeyDown={onKey}>
      <td className="px-3 py-1.5 font-bold text-[var(--color-brand)] font-mono text-xs">{initial.resourceCode}</td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.uraian} onChange={e => setV({ ...v, uraian: e.target.value })} /></td>
      <td className="px-2 py-1"><Input className="text-xs py-1" value={v.satuan} onChange={e => setV({ ...v, satuan: e.target.value })} /></td>
      <td className="px-2 py-1">
        <Input
          className="text-xs py-1 text-right tabular-nums disabled:opacity-60"
          type="number"
          step="any"
          value={hasFormula && preview?.ok ? String(preview.value) : v.koefisien}
          disabled={hasFormula}
          title={hasFormula ? 'Dihitung dari formula' : undefined}
          onChange={e => setV({ ...v, koefisien: e.target.value })}
        />
        {/* Formula input + live preview */}
        <Input
          className="text-xs py-1 mt-1 font-mono"
          placeholder="formula, mis. 1 / (Q1 × n)"
          value={v.formula}
          onChange={e => setV({ ...v, formula: e.target.value })}
        />
        {hasFormula && preview && (
          preview.ok ? (
            <div className="text-[10px] text-[var(--color-brand)] tabular-nums mt-0.5 text-right">
              = {fmtKoef(preview.value, 6)}
            </div>
          ) : (
            <div className="text-[10px] text-red-600 mt-0.5 text-right break-words">
              {preview.error ?? 'Formula tidak valid'}
            </div>
          )
        )}
      </td>
      <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={v.hsd} onChange={e => setV({ ...v, hsd: e.target.value })} /></td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(effKoef * Number(v.hsd))}</td>
      <td className="px-2 py-1 text-right">
        <div className="inline-flex gap-1 items-center">
          <button title="Save (Enter / Ctrl+S)" className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" disabled={saveDisabled} onClick={doSave}>
            <Check size={14} />
          </button>
          <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
            <X size={14} />
          </button>
          {onDelete && (
            <DeleteConfirm label={`Delete row ${initial.resourceCode}`} onConfirm={onDelete} />
          )}
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
  const kodeInputRef = useRef<HTMLInputElement>(null);
  const koefInputRef = useRef<HTMLInputElement>(null);

  // Typed-query autocomplete
  const rmQuery = (trpc as any).resourceMaster?.list?.useQuery?.(
    { category: cat, q: debouncedKode },
    { enabled: debouncedKode.length >= 1 },
  );
  const suggestions: any[] = rmQuery?.data ?? [];

  // QUICK PICK: full catalog for this category (loaded once)
  const quickQuery = (trpc as any).resourceMaster?.list?.useQuery?.({ category: cat });
  const quickList: any[] = quickQuery?.data ?? [];

  const applyResource = (s: any) => {
    setKode(s.kode);
    setUraian(s.nama ?? '');
    setSatuan(s.satuan ?? '');
    if (s.defaultHsd != null) setHsd(String(s.defaultHsd));
    setShowSuggest(false);
    // Focus koefisien — user typically only needs to set this
    setTimeout(() => koefInputRef.current?.focus(), 0);
  };

  const canSave = !!kode && !!uraian;
  const doSave = () => {
    if (!canSave) return;
    onSave({ kode, uraian, satuan: satuan || undefined, koefisien: Number(koef), hsd: Number(hsd) });
  };
  const onKey = rowKeyHandler({ onSave: doSave, onCancel });

  useEffect(() => { kodeInputRef.current?.focus(); }, []);

  return (
    <>
      {quickList.length > 0 && (
        <tr className="bg-orange-50/60">
          <td colSpan={7} className="px-2 py-1.5 border-b border-orange-200">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--color-brand)] tracking-wider">
                <Zap size={11} /> QUICK PICK
              </span>
              <select
                className="font-mono text-xs px-2 py-1 border border-neutral-300 bg-white max-w-md"
                defaultValue=""
                onChange={e => {
                  const s = quickList.find(x => x.id === e.target.value);
                  if (s) applyResource(s);
                  e.currentTarget.value = '';
                }}
              >
                <option value="">— pick from resource master —</option>
                {quickList.slice(0, 200).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.kode} · {s.nama} · {s.satuan} · Rp {Number(s.defaultHsd ?? 0).toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
              <span className="font-mono text-[10px] text-neutral-500">or type kode manually →</span>
            </div>
          </td>
        </tr>
      )}
      <tr className="border-b-2 border-[var(--color-brand)] bg-orange-100" onKeyDown={onKey}>
        <td className="px-2 py-1 relative">
          <Input
            ref={kodeInputRef as any}
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
                  onClick={() => applyResource(s)}
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
        <td className="px-2 py-1"><Input ref={koefInputRef as any} className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={koef} onChange={e => setKoef(e.target.value)} /></td>
        <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={hsd} onChange={e => setHsd(e.target.value)} /></td>
        <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(Number(koef) * Number(hsd))}</td>
        <td className="px-2 py-1 text-right">
          <div className="inline-flex gap-1">
            <button title="Save (Enter / Ctrl+S)" disabled={!canSave} className="p-1 text-[var(--color-brand)] hover:bg-orange-100 disabled:opacity-30" onClick={doSave}>
              <Check size={14} />
            </button>
            <button title="Cancel (Esc)" className="p-1 hover:bg-neutral-200" onClick={onCancel}>
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
    </>
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
