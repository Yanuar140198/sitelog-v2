'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Bell, Check } from 'lucide-react';

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = trpc.notification.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const list = trpc.notification.list.useQuery({ limit: 20 }, { enabled: open });
  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });
  const markAll = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });

  function open_(href: string | null, id: string) {
    markRead.mutate({ id });
    setOpen(false);
    if (href) router.push(href as any);
  }

  const count = unread.data?.count ?? 0;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-neutral-100" aria-label="Notifications">
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute top-0 right-0 bg-[var(--color-brand)] text-white font-mono text-[9px] min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border-2 border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)] z-40 max-h-[480px] overflow-auto">
            <div className="flex justify-between items-center p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50">
              <strong className="font-display text-sm">Notifications</strong>
              <button onClick={() => markAll.mutate()} className="font-mono text-[10px] tracking-wider hover:text-[var(--color-brand)]">
                <Check size={12} className="inline" /> MARK ALL READ
              </button>
            </div>
            {!list.data?.length ? (
              <div className="p-8 text-center font-mono text-xs text-neutral-500">No notifications</div>
            ) : (
              list.data.map(n => (
                <button key={n.id} onClick={() => open_(n.href, n.id)}
                  className={`w-full text-left px-3 py-3 border-b border-neutral-100 hover:bg-neutral-50 ${n.readAt ? 'opacity-60' : ''}`}>
                  <div className="flex gap-2">
                    {!n.readAt && <div className="w-2 h-2 bg-[var(--color-brand)] mt-1.5 flex-shrink-0" />}
                    <div className="flex-1">
                      <div className="font-display text-sm font-bold">{n.title}</div>
                      {n.body && <div className="font-mono text-xs text-neutral-600 mt-0.5">{n.body}</div>}
                      <div className="font-mono text-[10px] text-neutral-400 mt-1">
                        {new Date(n.createdAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
