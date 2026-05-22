'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Search, FolderKanban, Calculator, Truck, ClipboardList, Settings, BarChart3 } from 'lucide-react';

const ACTIONS = [
  { label: 'Dashboard', href: '/app', icon: BarChart3, kind: 'page' as const },
  { label: 'Projects', href: '/app/projects', icon: FolderKanban, kind: 'page' as const },
  { label: 'New project', href: '/app/projects/new', icon: FolderKanban, kind: 'action' as const },
  { label: 'BOQ Editor', href: '/app/boq', icon: Calculator, kind: 'page' as const },
  { label: 'AHSP Catalog', href: '/app/ahsp', icon: Calculator, kind: 'page' as const },
  { label: 'Fleet', href: '/app/fleet', icon: Truck, kind: 'page' as const },
  { label: 'Daily Entries', href: '/app/entries', icon: ClipboardList, kind: 'page' as const },
  { label: 'Settings', href: '/app/settings', icon: Settings, kind: 'page' as const },
  { label: 'Members', href: '/app/settings/members', icon: Settings, kind: 'page' as const },
  { label: 'Billing', href: '/app/settings/billing', icon: Settings, kind: 'page' as const },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  const projects = trpc.project.list.useQuery(undefined, { enabled: open });
  const ahsp = trpc.ahsp.catalog.useQuery(undefined, { enabled: open });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); setQ(''); setIdx(0); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ql = q.toLowerCase();
  const matchedActions = ACTIONS.filter(a => !q || a.label.toLowerCase().includes(ql));
  const matchedProjects = (projects.data ?? []).filter(p => !q || (p.code + ' ' + p.name).toLowerCase().includes(ql)).slice(0, 5);
  const matchedAhsp = (ahsp.data ?? []).filter(a => !q || (a.kode + ' ' + a.jenis).toLowerCase().includes(ql)).slice(0, 5);

  const items: Array<{ label: string; sub?: string; href: string; icon?: any }> = [
    ...matchedActions.map(a => ({ label: a.label, sub: a.kind === 'action' ? 'Action' : 'Page', href: a.href, icon: a.icon })),
    ...matchedProjects.map(p => ({ label: `${p.code} · ${p.name}`, sub: 'Project', href: `/app/projects/${p.id}`, icon: FolderKanban })),
    ...matchedAhsp.map(a => ({ label: `${a.kode} · ${a.jenis}`, sub: 'AHSP', href: `/app/ahsp/${a.id}`, icon: Calculator })),
  ];

  function navigate(href: string) {
    setOpen(false);
    router.push(href as any);
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && items[idx]) navigate(items[idx].href);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-32"
      onClick={() => setOpen(false)}>
      <div className="bg-white border-2 border-[var(--color-ink)] shadow-[6px_6px_0_var(--color-brand)] w-full max-w-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-[var(--color-ink)] px-4 py-3">
          <Search size={16} className="text-neutral-400" />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} onKeyDown={onSearchKey}
            placeholder="Search projects, AHSP, actions..."
            className="flex-1 outline-none font-mono text-sm bg-transparent" />
          <span className="font-mono text-[10px] text-neutral-400">ESC</span>
        </div>
        <div className="max-h-[400px] overflow-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-neutral-500">No results</div>
          ) : items.map((it, i) => {
            const Icon = it.icon ?? Search;
            return (
              <button key={i} onClick={() => navigate(it.href)}
                onMouseEnter={() => setIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${idx === i ? 'bg-[var(--color-brand)] text-white' : 'hover:bg-neutral-50'}`}>
                <Icon size={14} className={idx === i ? 'text-white' : 'text-neutral-400'} />
                <span className="flex-1 font-mono text-sm">{it.label}</span>
                {it.sub && <span className={`font-mono text-[10px] ${idx === i ? 'text-white/70' : 'text-neutral-400'}`}>{it.sub}</span>}
              </button>
            );
          })}
        </div>
        <div className="border-t-2 border-[var(--color-ink)] px-4 py-2 font-mono text-[10px] text-neutral-400 flex gap-3">
          <span>↑↓ navigate</span><span>↵ open</span><span className="ml-auto">⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
