'use client';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Calculator, ArrowRight, FolderPlus } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  planning: 'text-neutral-500',
  active: 'text-green-600',
  on_hold: 'text-amber-600',
  completed: 'text-blue-600',
  archived: 'text-neutral-400',
};

export default function BoqEditorPage() {
  const projects = trpc.project.list.useQuery();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">ESTIMATE</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">BOQ Editor</h1>
          <p className="text-sm text-neutral-500 mt-1">Pilih proyek untuk menyusun Bill of Quantities-nya.</p>
        </div>
        <Link href="/app/projects/new" className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)] px-4 py-2 font-mono text-sm hover:bg-[var(--color-ink)] hover:text-white transition-colors">
          <FolderPlus className="w-4 h-4" /> PROYEK BARU
        </Link>
      </div>

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
            return (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className="group flex items-center justify-between border-2 border-[var(--color-ink)] p-4 hover:bg-[var(--color-paper-2,#fafafa)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-0.5 border border-[var(--color-ink)]">{p.code}</span>
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className={`font-mono text-[11px] uppercase ${STATUS_COLOR[p.status] ?? 'text-neutral-500'}`}>{p.status}</span>
                  </div>
                  <div className="font-mono text-xs text-neutral-500 mt-1 truncate">
                    {[p.client, p.location].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 pl-4">
                  <div className="text-right">
                    <div className="font-mono text-[10px] text-neutral-400 uppercase">Grand Total</div>
                    <div className="font-mono text-sm font-semibold">{grand > 0 ? fmtIDR(grand) : '—'}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-[var(--color-brand)] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
