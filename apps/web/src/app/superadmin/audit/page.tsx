'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

export default function SuperAdminAudit() {
  const [prefix, setPrefix] = useState('');
  const list = trpc.admin.recentAudit.useQuery(
    { limit: 100, actionPrefix: prefix || undefined },
    { retry: false },
  );

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Audit Log</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Last 100 events across all orgs. Filter by action prefix (e.g. <code>project.</code>, <code>entry.</code>).</p>
      </div>

      <input
        value={prefix}
        onChange={e => setPrefix(e.target.value)}
        placeholder="Filter action prefix (project. / entry. / boq. / ...)"
        className="w-full bg-black border-2 border-white/30 px-4 py-3 font-mono text-sm text-white placeholder-white/40"
      />

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50 min-w-[720px]">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">TIME</th>
            <th className="text-left px-3 py-2 tracking-wider">ORG</th>
            <th className="text-left px-3 py-2 tracking-wider">ACTOR</th>
            <th className="text-left px-3 py-2 tracking-wider">ACTION</th>
            <th className="text-left px-3 py-2 tracking-wider">RESOURCE</th>
            <th className="text-left px-3 py-2 tracking-wider">IP</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(a => (
            <tr key={a.id} className="border-b border-white/10 hover:bg-white/5">
              <td className="px-3 py-2 text-white/70">{new Date(a.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2 text-[var(--color-brand)] truncate max-w-[120px]" title={a.organizationId ?? ''}>{(a.organizationId ?? '—').slice(0, 8)}…</td>
              <td className="px-3 py-2 text-white/60 truncate max-w-[120px]" title={a.actorId ?? ''}>{a.actorId ? a.actorId.slice(0, 8) + '…' : '—'}</td>
              <td className="px-3 py-2"><strong>{a.action}</strong></td>
              <td className="px-3 py-2 text-white/70">{a.resource}{a.resourceId ? ` · ${a.resourceId.slice(0, 8)}…` : ''}</td>
              <td className="px-3 py-2 text-white/70">{a.ipAddress ?? '—'}</td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-white/50">No events match.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
