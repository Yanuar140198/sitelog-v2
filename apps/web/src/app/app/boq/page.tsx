'use client';
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Calculator, ArrowRight, FolderPlus, Download, Archive, CheckSquare, Square } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  planning: 'text-neutral-500',
  active: 'text-green-600',
  on_hold: 'text-amber-600',
  completed: 'text-blue-600',
  archived: 'text-neutral-400',
};

const STATUS_OPTIONS = ['planning', 'active', 'on_hold', 'completed', 'archived'] as const;

export default function BoqEditorPage() {
  const projects = trpc.project.list.useQuery();
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const exportXlsx = trpc.export.boqXlsx.useMutation({
    onSuccess: (data) => {
      setActionError(null);
      const blob = new Blob([Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0))], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setActionError(e.message),
  });

  const clearSelection = () => setSelected(new Set());

  const bulkStatus = trpc.project.bulkUpdateStatus.useMutation({
    onSuccess: () => { setActionError(null); clearSelection(); void utils.project.list.invalidate(); },
    onError: (e) => setActionError(e.message),
  });
  const bulkArchive = trpc.project.bulkArchive.useMutation({
    onSuccess: () => { setActionError(null); clearSelection(); void utils.project.list.invalidate(); },
    onError: (e) => setActionError(e.message),
  });

  const busy = exportXlsx.isPending || bulkStatus.isPending || bulkArchive.isPending;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const ids = [...selected];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">ESTIMATE</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">BOQ Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">Pilih proyek untuk menyusun Bill of Quantities-nya.</p>
        </div>
        <Link href="/app/projects/new" className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)] px-4 py-2 font-mono text-sm hover:bg-[var(--color-ink)] hover:text-white transition-colors">
          <FolderPlus className="w-4 h-4" /> PROYEK BARU
        </Link>
      </div>

      {actionError && (
        <div className="border-2 border-red-500 bg-red-50 p-4 font-mono text-sm text-red-700">
          {actionError}
        </div>
      )}

      {ids.length > 0 && (
        <div className="border-2 border-[var(--color-ink)] bg-[var(--color-paper-2,#fafafa)] p-3 flex items-center flex-wrap gap-2">
          <span className="font-mono text-xs font-bold mr-1">{ids.length} DIPILIH</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => bulkStatus.mutate({ ids, status: s })}
              className={`font-mono text-[11px] uppercase border border-[var(--color-ink)] px-2 py-1 hover:bg-[var(--color-ink)] hover:text-white transition-colors disabled:opacity-50 ${STATUS_COLOR[s] ?? ''}`}
            >
              {s}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => { if (confirm(`Arsipkan ${ids.length} proyek?`)) bulkArchive.mutate({ ids }); }}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase border border-red-500 text-red-600 px-2 py-1 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <Archive className="w-3 h-3" /> Arsipkan
          </button>
          <button
            disabled={busy}
            onClick={clearSelection}
            className="font-mono text-[11px] uppercase px-2 py-1 text-neutral-500 hover:text-[var(--color-ink)] transition-colors disabled:opacity-50"
          >
            Batal
          </button>
        </div>
      )}

      {projects.isLoading && <div className="font-mono text-sm text-neutral-500">Loading…</div>}
      {projects.isError && (
        <div className="border-2 border-red-500 bg-red-50 p-4 font-mono text-sm text-red-700">
          Gagal memuat proyek: {projects.error.message}
        </div>
      )}

      {projects.data && projects.data.length === 0 && (
        <div className="border-2 border-dashed border-neutral-300 p-10 text-center">
          <Calculator className="w-8 h-8 mx-auto text-neutral-400" />
          <p className="font-mono text-sm text-neutral-500 mt-3">Belum ada proyek.</p>
          <Link href="/app/projects/new" className="inline-block mt-4 border-2 border-[var(--color-ink)] px-4 py-2 font-mono text-sm hover:bg-[var(--color-ink)] hover:text-white transition-colors">
            Buat proyek pertama →
          </Link>
        </div>
      )}

      {projects.data && projects.data.length > 0 && (
        <div className="grid gap-3">
          {projects.data.map((p) => {
            const grand = Number(p.cachedGrandTotal ?? 0);
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={`group flex items-center justify-between border-2 border-[var(--color-ink)] p-4 transition-colors ${isSelected ? 'bg-[var(--color-paper-2,#fafafa)]' : 'hover:bg-[var(--color-paper-2,#fafafa)]'}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  title={isSelected ? 'Batal pilih' : 'Pilih'}
                  className="shrink-0 mr-3 p-1 text-neutral-400 hover:text-[var(--color-brand)] transition-colors"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 text-[var(--color-brand)]" /> : <Square className="w-5 h-5" />}
                </button>
                <Link href={`/app/projects/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-0.5 border border-[var(--color-ink)]">{p.code}</span>
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className={`font-mono text-[11px] uppercase ${STATUS_COLOR[p.status] ?? 'text-neutral-500'}`}>{p.status}</span>
                  </div>
                  <div className="font-mono text-xs text-neutral-500 mt-1 truncate">
                    {[p.client, p.location].filter(Boolean).join(' · ') || '—'}
                  </div>
                </Link>
                <div className="flex items-center gap-4 shrink-0 pl-4">
                  <div className="text-right">
                    <div className="font-mono text-[10px] text-neutral-400 uppercase">Grand Total</div>
                    <div className="font-mono text-sm font-semibold">{grand > 0 ? fmtIDR(grand) : '—'}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => exportXlsx.mutate({ projectId: p.id })}
                    title="Export XLSX"
                    className="p-2 border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <Link href={`/app/projects/${p.id}`} className="inline-flex">
                    <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-[var(--color-brand)] transition-colors" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
