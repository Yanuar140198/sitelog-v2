'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SuperAdminWebhooks() {
  const list = trpc.admin.recentWebhookDeliveries.useQuery({ limit: 100 }, { retry: false });

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Webhook Activity</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Last 100 delivery attempts across all org webhooks.</p>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50 min-w-[720px]">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">TIME</th>
            <th className="text-left px-3 py-2 tracking-wider">ORG</th>
            <th className="text-left px-3 py-2 tracking-wider">EVENT</th>
            <th className="text-left px-3 py-2 tracking-wider">URL</th>
            <th className="text-right px-3 py-2 tracking-wider">STATUS</th>
            <th className="text-right px-3 py-2 tracking-wider">ATTEMPTS</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(d => {
            const ok = d.responseStatus != null && d.responseStatus >= 200 && d.responseStatus < 300;
            return (
              <tr key={d.id} className="border-b border-white/10 hover:bg-white/5">
                <td className="px-3 py-2 text-white/70">{new Date(d.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-[var(--color-brand)] truncate max-w-[120px]" title={d.organizationId}>{d.organizationId.slice(0, 8)}…</td>
                <td className="px-3 py-2"><strong>{d.event}</strong></td>
                <td className="px-3 py-2 text-white/70 truncate max-w-xs" title={d.endpointUrl}>{d.endpointUrl}</td>
                <td className={`px-3 py-2 text-right font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>{d.responseStatus ?? '—'}</td>
                <td className="px-3 py-2 text-right">{d.attempts}</td>
              </tr>
            );
          })}
          {list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-white/50">No deliveries yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
