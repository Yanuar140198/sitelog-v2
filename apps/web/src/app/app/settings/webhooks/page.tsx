'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Plus, Trash2, History } from 'lucide-react';

const EVENTS = ['*', 'project.created', 'project.updated', 'boq.changed', 'entry.submitted', 'fleet.assigned', 'invite.created'] as const;

export default function WebhooksPage() {
  const list = trpc.webhooks.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.webhooks.create.useMutation({
    onSuccess: (r) => { setNewSecret(r.secret); utils.webhooks.list.invalidate(); reset(); },
  });
  const toggle = trpc.webhooks.toggle.useMutation({ onSuccess: () => utils.webhooks.list.invalidate() });
  const del = trpc.webhooks.delete.useMutation({ onSuccess: () => utils.webhooks.list.invalidate() });

  const [show, setShow] = useState(false);
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [events, setEvents] = useState<string[]>(['*']);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const deliveries = trpc.webhooks.deliveries.useQuery(
    { endpointId: historyFor!, limit: 20 },
    { enabled: !!historyFor, retry: false },
  );
  function reset() { setUrl(''); setDesc(''); setEvents(['*']); setShow(false); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <p className="font-mono text-xs text-neutral-600">Outgoing webhooks dispatched on org events. Payload signed with HMAC-SHA256.</p>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW WEBHOOK</Button>
      </div>

      {newSecret && (
        <div className="border-2 border-[var(--color-brand)] bg-orange-50 p-4">
          <div className="font-mono text-xs font-bold mb-2">⚠ SAVE THIS SECRET — shown only once</div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-white p-2 font-mono text-xs break-all">{newSecret}</code>
            <button onClick={() => { navigator.clipboard.writeText(newSecret); }} className="p-2 border border-[var(--color-ink)]"><Copy size={14} /></button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-2 font-mono text-[10px] text-neutral-600 hover:text-[var(--color-brand)]">DISMISS</button>
        </div>
      )}

      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">URL</th>
            <th className="text-left px-3 py-2 tracking-wider">EVENTS</th>
            <th className="text-left px-3 py-2 tracking-wider">STATUS</th>
            <th className="text-left px-3 py-2 tracking-wider">LAST</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(w => (
            <tr key={w.id} className="border-b border-neutral-100">
              <td className="px-3 py-2 break-all">{w.url}</td>
              <td className="px-3 py-2">{w.events}</td>
              <td className="px-3 py-2">
                <button onClick={() => toggle.mutate({ id: w.id, active: !w.active })}
                  className={`px-2 py-0.5 text-[10px] font-bold ${w.active ? 'bg-green-600 text-white' : 'bg-neutral-300'}`}>
                  {w.active ? 'ACTIVE' : 'PAUSED'}
                </button>
              </td>
              <td className="px-3 py-2 text-neutral-500">
                {w.lastFiredAt ? `${new Date(w.lastFiredAt).toLocaleString('id-ID')} · ${w.lastStatus ?? '—'}` : 'Never'}
              </td>
              <td className="px-3 py-2 text-center">
                <button onClick={() => setHistoryFor(w.id)} className="p-1 mr-1 text-neutral-700 hover:bg-neutral-100" aria-label="History"><History size={14} /></button>
                <button onClick={() => confirm('Delete?') && del.mutate({ id: w.id })} className="p-1 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={5} className="text-center py-12 text-neutral-500">No webhooks. Add one to integrate with Zapier, n8n, custom systems.</td></tr>
          )}
        </tbody>
      </table>

      {historyFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setHistoryFor(null); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-3xl w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-1">Delivery History</h2>
            <p className="font-mono text-xs text-neutral-500 mb-4">Last 20 attempts. 2xx = delivered, anything else = retry queued.</p>
            <table className="w-full font-mono text-xs">
              <thead><tr className="text-neutral-500 border-b border-neutral-200">
                <th className="text-left py-1">TIME</th>
                <th className="text-left">EVENT</th>
                <th className="text-left">STATUS</th>
                <th className="text-left">ATTEMPTS</th>
                <th className="text-left">RESPONSE</th>
              </tr></thead>
              <tbody>
                {deliveries.data?.map(d => (
                  <tr key={d.id} className="border-b border-neutral-100">
                    <td className="py-1">{new Date(d.createdAt).toLocaleString('id-ID')}</td>
                    <td><strong>{d.event}</strong></td>
                    <td className={d.responseStatus && d.responseStatus < 300 ? 'text-green-700' : 'text-red-700'}>
                      {d.responseStatus ?? '—'}
                    </td>
                    <td>{d.attempts}</td>
                    <td className="text-neutral-600 max-w-xs truncate" title={d.responseBody ?? ''}>{(d.responseBody ?? '').slice(0, 80)}</td>
                  </tr>
                ))}
                {deliveries.data?.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-neutral-500">No deliveries yet.</td></tr>
                )}
              </tbody>
            </table>
            <div className="mt-4 text-right">
              <Button type="button" onClick={() => setHistoryFor(null)}>CLOSE</Button>
            </div>
          </div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-lg w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">New Webhook</h2>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ url, description: desc, events: events as any }); }}
              className="space-y-3">
              <div><Label>Endpoint URL *</Label><Input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://hooks.example.com/sitelog" /></div>
              <div><Label>Description</Label><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Sales CRM sync" /></div>
              <div>
                <Label>Events</Label>
                <div className="grid grid-cols-2 gap-1">
                  {EVENTS.map(e => (
                    <label key={e} className="flex gap-2 items-center font-mono text-xs">
                      <input type="checkbox" checked={events.includes(e)}
                        onChange={ev => setEvents(ev.target.checked ? [...events, e] : events.filter(x => x !== e))} />
                      {e}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit" variant="primary" disabled={create.isPending || !url}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
