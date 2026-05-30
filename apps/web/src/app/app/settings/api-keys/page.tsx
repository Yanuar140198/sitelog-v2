'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Plus, X, KeyRound } from 'lucide-react';

export default function ApiKeysPage() {
  const list = trpc.apiKeys.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (r: any) => { setNewKey(r.key); utils.apiKeys.list.invalidate(); setName(''); setShow(false); },
  });
  const revoke = trpc.apiKeys.revoke.useMutation({ onSuccess: () => utils.apiKeys.list.invalidate() });
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write' | 'admin'>('read');
  const [newKey, setNewKey] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 justify-between items-end">
        <p className="font-mono text-xs text-neutral-600">API keys for programmatic access. Send as `Authorization: Bearer sk_live_...`.</p>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW KEY</Button>
      </div>

      {newKey && (
        <div className="border-2 border-[var(--color-brand)] bg-orange-50 p-4">
          <div className="font-mono text-xs font-bold mb-2">⚠ COPY NOW — shown only once</div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-white p-2 font-mono text-xs break-all">{newKey}</code>
            <button onClick={() => navigator.clipboard.writeText(newKey)} className="p-2 border border-[var(--color-ink)]"><Copy size={14} /></button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 font-mono text-[10px] text-neutral-600 hover:text-[var(--color-brand)]">DISMISS</button>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)] min-w-[720px]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">NAME</th>
            <th className="text-left px-3 py-2 tracking-wider">PREFIX</th>
            <th className="text-left px-3 py-2 tracking-wider">SCOPE</th>
            <th className="text-left px-3 py-2 tracking-wider">LAST USED</th>
            <th className="text-left px-3 py-2 tracking-wider">STATUS</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(k => (
            <tr key={k.id} className="border-b border-neutral-100">
              <td className="px-3 py-2 font-bold">{k.name}</td>
              <td className="px-3 py-2"><code>{k.prefix}...</code></td>
              <td className="px-3 py-2 uppercase">{k.scope}</td>
              <td className="px-3 py-2 text-neutral-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('id-ID') : 'Never'}</td>
              <td className="px-3 py-2">
                {k.revokedAt ? <span className="px-2 py-0.5 bg-red-200 text-red-700 text-[10px] font-bold">REVOKED</span>
                  : <span className="px-2 py-0.5 bg-green-200 text-green-700 text-[10px] font-bold">ACTIVE</span>}
              </td>
              <td className="px-3 py-2 text-center">
                {!k.revokedAt && (
                  <button onClick={() => confirm('Revoke?') && revoke.mutate({ id: k.id })} className="p-1 text-red-600 hover:bg-red-50"><X size={14} /></button>
                )}
              </td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-neutral-500">No API keys yet. Create one for CI integration, Zapier, scripts.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-4 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_var(--color-brand)]">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={20} className="text-[var(--color-brand)]" />
              <h2 className="font-display text-2xl font-bold">New API Key</h2>
            </div>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ name, scope }); }} className="space-y-3">
              <div><Label>Name *</Label><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Production CI" /></div>
              <div><Label>Scope</Label>
                <select value={scope} onChange={e => setScope(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                  <option value="read">read (viewer)</option>
                  <option value="write">write (estimator)</option>
                  <option value="admin">admin (org admin)</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
