'use client';
import { trpc } from '@sitelog/api-client/react';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from './notification-bell';
import { MobileNav } from './mobile-nav';

export function Topbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const orgList = trpc.org.list.useQuery();
  const current = trpc.org.current.useQuery();
  const [open, setOpen] = useState(false);

  function switchOrg(orgId: string) {
    if (typeof window !== 'undefined') localStorage.setItem('sl_org', orgId);
    location.reload();
  }

  return (
    <header className="md:col-start-2 h-14 bg-white border-b-2 border-[var(--color-ink)] flex items-center justify-between gap-2 px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger + drawer (mobile only) */}
        <MobileNav />
        {current.data && (
          <div className="relative">
            <button onClick={() => setOpen(!open)}
              className="flex items-center gap-2 px-3 py-1.5 border-2 border-[var(--color-ink)] font-mono text-sm hover:bg-[var(--color-ink)] hover:text-white transition max-w-[40vw] md:max-w-none">
              <span className="font-bold truncate">{current.data.name}</span>
              <span className="hidden sm:inline text-[10px] text-neutral-500 uppercase">{current.data.role}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
            {open && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border-2 border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)] z-50">
                {orgList.data?.map(({ org, role }) => (
                  <button key={org.id} onClick={() => switchOrg(org.id)}
                    className="w-full text-left px-3 py-2 font-mono text-sm hover:bg-[var(--color-brand)] hover:text-white">
                    <div className="font-bold">{org.name}</div>
                    <div className="text-[10px] uppercase opacity-70">{role}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell />
        <div className="hidden md:block font-mono text-xs text-neutral-600">{session?.user?.email}</div>
        <button
          onClick={async () => { await signOut(); router.push('/login'); }}
          className="p-2 hover:bg-neutral-100" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
