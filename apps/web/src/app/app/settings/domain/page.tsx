'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, CheckCircle2, AlertCircle, Globe } from 'lucide-react';

export default function DomainSettings() {
  const status = trpc.domain.status.useQuery();
  const utils = trpc.useUtils();
  const request = trpc.domain.request.useMutation({ onSuccess: () => utils.domain.status.invalidate() });
  const verify = trpc.domain.verify.useMutation({ onSuccess: () => utils.domain.status.invalidate() });
  const remove = trpc.domain.remove.useMutation({ onSuccess: () => utils.domain.status.invalidate() });
  const [newDomain, setNewDomain] = useState('');

  const s = status.data;
  const verified = !!s?.customDomainVerifiedAt;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex items-center gap-2">
          <Globe size={12} /> CUSTOM DOMAIN
        </div>
        <div className="p-5 space-y-4">
          {!s?.customDomain ? (
            <form onSubmit={e => { e.preventDefault(); request.mutate({ domain: newDomain }); }} className="space-y-3">
              <p className="font-mono text-xs text-neutral-600">
                Point a custom domain (e.g. <code>app.your-company.com</code>) at Sitelog. Enterprise plan only.
              </p>
              <Label>Domain</Label>
              <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="app.your-company.com" required />
              <Button type="submit" variant="primary" disabled={request.isPending}>REQUEST</Button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-neutral-500">DOMAIN</div>
                  <div className="font-display text-lg font-bold">{s.customDomain}</div>
                </div>
                {verified ? (
                  <span className="bg-green-200 text-green-700 px-3 py-1 font-mono text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> VERIFIED
                  </span>
                ) : (
                  <span className="bg-yellow-200 text-yellow-700 px-3 py-1 font-mono text-xs font-bold flex items-center gap-1">
                    <AlertCircle size={14} /> PENDING
                  </span>
                )}
              </div>

              {!verified && request.data && (
                <div className="border-2 border-[var(--color-brand)] bg-orange-50 p-4 space-y-3">
                  <div className="font-mono text-xs font-bold">⓵ Add this DNS TXT record at your registrar:</div>
                  <div className="bg-white p-3 font-mono text-xs space-y-1">
                    <div><strong>Type:</strong> TXT</div>
                    <div><strong>Name:</strong> <code>{request.data.recordName}</code></div>
                    <div className="flex gap-2 items-center">
                      <strong>Value:</strong>
                      <code className="flex-1 truncate">{request.data.recordValue}</code>
                      <button onClick={() => navigator.clipboard.writeText(request.data!.recordValue)} className="p-1 border border-[var(--color-ink)]"><Copy size={12} /></button>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold">⓶ Add CNAME for traffic:</div>
                  <div className="bg-white p-3 font-mono text-xs space-y-1">
                    <div><strong>Type:</strong> CNAME</div>
                    <div><strong>Name:</strong> <code>{request.data.domain}</code></div>
                    <div><strong>Target:</strong> <code>{request.data.cnameTarget}</code></div>
                  </div>
                </div>
              )}

              {verify.error && (
                <div className="bg-red-50 border border-red-600 text-red-700 px-3 py-2 text-xs font-mono">{verify.error.message}</div>
              )}

              <div className="flex gap-2">
                {!verified && <Button onClick={() => verify.mutate()} variant="primary" disabled={verify.isPending}>VERIFY DNS</Button>}
                <Button onClick={() => confirm('Remove domain?') && remove.mutate()} variant="danger">REMOVE</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
