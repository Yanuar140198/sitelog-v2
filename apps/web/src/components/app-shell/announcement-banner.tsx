'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'sl_dismissed_announcements';

function getDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'); } catch { return []; }
}

function setDismissed(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

const SEVERITY_STYLES: Record<string, string> = {
  info:     'bg-blue-50 border-blue-500 text-blue-900',
  warning:  'bg-amber-50 border-amber-500 text-amber-900',
  critical: 'bg-red-100 border-red-600 text-red-900',
};

export function AnnouncementBanner() {
  const active = trpc.announcement.active.useQuery(undefined, { refetchInterval: 5 * 60_000, retry: false });
  const [dismissed, setLocal] = useState<string[]>([]);

  useEffect(() => { setLocal(getDismissed()); }, []);

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])];
    setLocal(next);
    setDismissed(next);
  }

  const visible = (active.data ?? []).filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-2">
      {visible.map(a => (
        <div key={a.id}
          role="alert"
          className={`border-l-4 px-4 py-3 font-mono text-xs flex justify-between gap-3 ${SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info}`}>
          <div>
            <strong className="tracking-wider uppercase">{a.title}</strong>
            <p className="mt-1 font-sans text-sm leading-relaxed">{a.body}</p>
          </div>
          {a.dismissible && (
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss announcement"
              className="text-current opacity-60 hover:opacity-100 px-2 py-1 font-bold"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
