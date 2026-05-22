'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Calculator, Truck, ClipboardList, BarChart3, Settings, ShieldCheck, FileStack, Wrench, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/projects', label: 'Projects', icon: FolderKanban },
  { href: '/app/boq', label: 'BOQ Editor', icon: Calculator },
  { href: '/app/ahsp', label: 'AHSP Catalog', icon: Calculator },
  { href: '/app/templates', label: 'Templates', icon: FileStack },
  { href: '/app/fleet', label: 'Fleet', icon: Truck },
  { href: '/app/crew', label: 'Crew', icon: HardHat },
  { href: '/app/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/app/entries', label: 'Daily Entries', icon: ClipboardList },
  { href: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/app/audit', label: 'Audit Log', icon: ShieldCheck },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="row-span-2 bg-[var(--color-ink)] text-white border-r-2 border-[var(--color-ink)] flex flex-col">
      <div className="h-14 px-5 border-b border-white/10 flex items-center">
        <Link href="/app" className="font-mono text-sm tracking-[0.2em] text-[var(--color-brand)] font-bold">
          ◣ SITELOG
        </Link>
      </div>
      <nav className="flex-1 py-4">
        {NAV.map(item => {
          const active = path === item.href || (item.href !== '/app' && path.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-sm font-mono tracking-wide transition-colors',
                active
                  ? 'bg-[var(--color-brand)] text-white border-l-4 border-white pl-4'
                  : 'text-neutral-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent',
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-white/10 font-mono text-[10px] text-neutral-500">
        v2.0.0 · 2026
      </div>
    </aside>
  );
}
