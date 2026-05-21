'use client';
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { fmtIDR } from '@/lib/utils';

export default function ProjectsPage() {
  const projects = trpc.project.list.useQuery();
  const utils = trpc.useUtils();
  const bulkArchive = trpc.project.bulkArchive.useMutation({ onSuccess: () => { utils.project.list.invalidate(); setSelected(new Set()); } });
  const bulkStatus = trpc.project.bulkUpdateStatus.useMutation({ onSuccess: () => { utils.project.list.invalidate(); setSelected(new Set()); } });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (selected.size === projects.data?.length) setSelected(new Set());
    else setSelected(new Set((projects.data ?? []).map(p => p.id)));
  }
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CATALOG</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Projects</h1>
        </div>
        <div className="flex gap-2 items-center">
          {selected.size > 0 && (
            <>
              <span className="font-mono text-xs text-neutral-600">{selected.size} selected</span>
              <select onChange={e => { if (e.target.value) bulkStatus.mutate({ ids: [...selected], status: e.target.value as any }); e.target.value = ''; }}
                className="px-2 py-1 border-2 border-[var(--color-ink)] font-mono text-xs">
                <option value="">SET STATUS</option>
                <option value="planning">PLANNING</option>
                <option value="active">ACTIVE</option>
                <option value="on_hold">ON HOLD</option>
                <option value="completed">COMPLETED</option>
              </select>
              <Button variant="danger" onClick={() => confirm(`Archive ${selected.size} projects?`) && bulkArchive.mutate({ ids: [...selected] })}>
                ARCHIVE
              </Button>
              <Button onClick={() => setSelected(new Set())}>CLEAR</Button>
            </>
          )}
          <Link href="/app/projects/new" className="inline-block">
            <Button variant="primary">+ NEW PROJECT</Button>
          </Link>
        </div>
      </div>
      {(projects.data ?? []).length > 0 && (
        <label className="flex items-center gap-2 font-mono text-xs text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={selected.size > 0 && selected.size === projects.data?.length}
            onChange={toggleAll} />
          Select all
        </label>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.data?.map(p => (
          <div key={p.id} className={`border-2 ${selected.has(p.id) ? 'border-[var(--color-brand)] shadow-[4px_4px_0_var(--color-brand)]' : 'border-[var(--color-ink)]'} bg-white relative`}>
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)}
              onClick={e => e.stopPropagation()}
              className="absolute top-2 left-2 z-10 w-4 h-4 accent-[var(--color-brand)]" />
            <Link href={`/app/projects/${p.id}` as any}
              className="block p-5 hover:shadow-[4px_4px_0_var(--color-brand)] transition">
            <div className="flex items-center justify-between pl-6">
              <span className="font-mono text-xs text-[var(--color-brand)] font-bold">{p.code}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-100">{p.status}</span>
            </div>
            <h3 className="font-display text-lg font-bold mt-2">{p.name}</h3>
            <div className="font-mono text-xs text-neutral-600 mt-1">{p.client ?? '—'}</div>
            <div className="mt-4 pt-4 border-t border-neutral-200 font-mono text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Plan Cut</span><span>{p.planCutSoil} m³</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Plan Fill</span><span>{p.planFill} m³</span></div>
              <div className="flex justify-between mt-2 text-[var(--color-brand)] font-bold"><span>Grand Total</span><span>{fmtIDR(Number(p.cachedGrandTotal))}</span></div>
            </div>
            </Link>
          </div>
        ))}
      </div>
      {projects.data?.length === 0 && (
        <div className="text-center py-24 border-2 border-dashed border-neutral-300">
          <p className="font-mono text-sm text-neutral-500 mb-4">No projects yet.</p>
          <Link href="/app/projects/new">
            <Button variant="primary" size="lg">+ CREATE FIRST PROJECT</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
