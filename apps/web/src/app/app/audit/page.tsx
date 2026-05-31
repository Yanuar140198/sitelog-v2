'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Search } from 'lucide-react';

export default function AuditPage() {
  const [filter, setFilter] = useState({ q: '', action: '', resource: '' });
  const list = trpc.audit.list.useQuery({
    q: filter.q || undefined,
    action: filter.action || undefined,
    resource: filter.resource || undefined,
    limit: 200,
  });
  const exportCsv = trpc.audit.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap gap-2 justify-between items-end">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">COMPLIANCE</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Audit Log</h1>
        </div>
        <Button onClick={() => exportCsv.mutate({
          q: filter.q || undefined, action: filter.action || undefined, resource: filter.resource || undefined,
        })} disabled={exportCsv.isPending}>
          <Download size={14} /> EXPORT CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <Label>Search</Label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-3 text-neutral-400" />
            <Input value={filter.q} onChange={e => setFilter(p => ({ ...p, q: e.target.value }))} placeholder="action / resource / id" className="pl-7" />
          </div>
        </div>
        <div><Label>Action</Label><Input value={filter.action} onChange={e => setFilter(p => ({ ...p, action: e.target.value }))} placeholder="project.create" /></div>
        <div><Label>Resource</Label><Input value={filter.resource} onChange={e => setFilter(p => ({ ...p, resource: e.target.value }))} placeholder="project" /></div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)] min-w-[720px]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">TIME</th>
            <th className="text-left px-3 py-2 tracking-wider">ACTOR</th>
            <th className="text-left px-3 py-2 tracking-wider">ACTION</th>
            <th className="text-left px-3 py-2 tracking-wider">RESOURCE</th>
            <th className="text-left px-3 py-2 tracking-wider">IP</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(r => (
            <tr key={r.log.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 text-neutral-500">{new Date(r.log.createdAt).toLocaleString('id-ID')}</td>
              <td className="px-3 py-2">{r.actorName ?? r.actorEmail ?? '—'}</td>
              <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{r.log.action}</td>
              <td className="px-3 py-2">{r.log.resource}{r.log.resourceId ? ` · ${r.log.resourceId.slice(0,8)}` : ''}</td>
              <td className="px-3 py-2 text-neutral-500">{r.log.ipAddress ?? '—'}</td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={5} className="text-center py-12 text-neutral-500">No audit entries match filter.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
