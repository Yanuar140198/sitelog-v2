'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

export default function AnnouncementsAdmin() {
  const list = trpc.announcement.listAll.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const create = trpc.announcement.create.useMutation({
    onSuccess: () => { utils.announcement.invalidate(); reset(); },
  });
  const del = trpc.announcement.delete.useMutation({
    onSuccess: () => utils.announcement.invalidate(),
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [endsAt, setEndsAt] = useState('');
  const [dismissible, setDismissible] = useState(true);

  function reset() {
    setTitle(''); setBody(''); setSeverity('info'); setEndsAt(''); setDismissible(true);
  }

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Announcements</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Broadcast a banner to every authenticated user across all orgs.</p>
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">NEW ANNOUNCEMENT</h2>
        <div className="grid gap-3 font-mono text-xs">
          <label className="grid gap-1">
            <span className="text-white/50">Title (≤120 chars)</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
              className="bg-black border-2 border-white/30 px-3 py-2 text-white" />
          </label>
          <label className="grid gap-1">
            <span className="text-white/50">Body (≤2000 chars)</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={3}
              className="bg-black border-2 border-white/30 px-3 py-2 text-white font-sans" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="grid gap-1">
              <span className="text-white/50">Severity</span>
              <select value={severity} onChange={e => setSeverity(e.target.value as any)}
                className="bg-black border-2 border-white/30 px-3 py-2 text-white">
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-white/50">Ends at (UTC, blank = forever)</span>
              <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
                className="bg-black border-2 border-white/30 px-3 py-2 text-white" />
            </label>
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={dismissible} onChange={e => setDismissible(e.target.checked)} />
              <span className="text-white/80">Dismissible</span>
            </label>
          </div>
          <button
            disabled={!title || !body || create.isPending}
            onClick={() => create.mutate({
              title, body, severity, dismissible,
              endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
            })}
            className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed self-start"
          >
            {create.isPending ? 'PUBLISHING…' : '+ PUBLISH'}
          </button>
          {create.error && <p className="text-red-400">{create.error.message}</p>}
        </div>
      </section>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">ALL ANNOUNCEMENTS ({list.data?.length ?? 0})</h2>
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[560px]">
          <thead className="text-white/50">
            <tr>
              <th className="text-left py-1">TITLE</th>
              <th className="text-left">SEVERITY</th>
              <th className="text-left">STARTS</th>
              <th className="text-left">ENDS</th>
              <th className="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map(a => (
              <tr key={a.id} className="border-t border-white/10">
                <td className="py-2"><strong>{a.title}</strong><br/><span className="text-white/60 font-sans">{a.body.slice(0, 80)}{a.body.length > 80 ? '…' : ''}</span></td>
                <td className="uppercase">{a.severity}</td>
                <td className="text-white/70">{new Date(a.startsAt).toLocaleString()}</td>
                <td className="text-white/70">{a.endsAt ? new Date(a.endsAt).toLocaleString() : '—'}</td>
                <td className="text-right">
                  <button onClick={() => del.mutate({ id: a.id })}
                    className="text-red-400 hover:text-red-200 text-lg leading-none" aria-label="Delete">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
