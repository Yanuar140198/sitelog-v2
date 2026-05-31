'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, RotateCcw, Plus, GitCompare } from 'lucide-react';

export function BoqVersionPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const list = trpc.boqVersion.list.useQuery({ projectId });
  const utils = trpc.useUtils();
  const snapshot = trpc.boqVersion.snapshot.useMutation({
    onSuccess: () => { utils.boqVersion.list.invalidate({ projectId }); setLabel(''); setNotes(''); },
  });
  const restore = trpc.boqVersion.restore.useMutation({
    onSuccess: () => { utils.boq.list.invalidate({ projectId }); onClose(); },
  });
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null]);
  const diff = trpc.boqVersion.diff.useQuery(
    { versionAId: compareIds[0]!, versionBId: compareIds[1]! },
    { enabled: !!(compareIds[0] && compareIds[1]) },
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-2xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">REVISIONS</div>
            <h2 className="font-display text-xl font-bold mt-1">BOQ Versions</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5 border-b border-neutral-200 bg-neutral-50">
          <form onSubmit={e => { e.preventDefault(); snapshot.mutate({ projectId, label: label || undefined, notes: notes || undefined }); }}
            className="space-y-3">
            <div><Label>Label (optional)</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Bid v1.2 Submission" /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tender submitted to client" /></div>
            <Button type="submit" variant="primary" disabled={snapshot.isPending}>
              <Plus size={14} /> {snapshot.isPending ? 'SAVING...' : 'SNAPSHOT CURRENT BOQ'}
            </Button>
          </form>
        </div>

        <div className="p-5 space-y-2">
          {list.data?.length === 0 && (
            <div className="text-center py-12 text-neutral-500 font-mono text-sm">No versions yet. Snapshot first.</div>
          )}
          {list.data?.map(v => (
            <div key={v.id} className="border-2 border-[var(--color-ink)] p-4 flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="bg-[var(--color-brand)] text-white px-2 py-0.5 font-mono text-xs font-bold">v{v.versionNumber}</span>
                  <strong className="font-display text-sm">{v.label}</strong>
                </div>
                {v.notes && <div className="font-mono text-xs text-neutral-600 mt-1">{v.notes}</div>}
                <div className="font-mono text-[10px] text-neutral-500 mt-2">
                  {new Date(v.createdAt).toLocaleString('id-ID')}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setCompareIds([v.id, compareIds[1]])}
                    className={`text-[10px] font-mono px-2 py-1 ${compareIds[0] === v.id ? 'bg-[var(--color-brand)] text-white' : 'border border-neutral-300'}`}>A</button>
                  <button onClick={() => setCompareIds([compareIds[0], v.id])}
                    className={`text-[10px] font-mono px-2 py-1 ${compareIds[1] === v.id ? 'bg-[var(--color-brand)] text-white' : 'border border-neutral-300'}`}>B</button>
                </div>
              </div>
              <Button onClick={() => confirm(`Restore v${v.versionNumber}? Current BOQ will be replaced.`) && restore.mutate({ versionId: v.id })}
                disabled={restore.isPending}>
                <RotateCcw size={12} /> RESTORE
              </Button>
            </div>
          ))}
          {compareIds[0] && compareIds[1] && diff.data && (
            <div className="mt-4 border-2 border-[var(--color-brand)] bg-orange-50 p-4">
              <div className="font-mono text-xs font-bold mb-2 flex items-center gap-2">
                <GitCompare size={14} /> DIFF v{diff.data.a.versionNumber} → v{diff.data.b.versionNumber}
              </div>
              <div className="font-mono text-xs flex gap-3 mb-3">
                <span className="text-green-700">+ {diff.data.counts.added} added</span>
                <span className="text-red-700">− {diff.data.counts.removed} removed</span>
                <span className="text-orange-700">~ {diff.data.counts.changed} changed</span>
                <span className="text-neutral-500">= {diff.data.counts.same} same</span>
              </div>
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs bg-white border border-[var(--color-ink)] p-2">
                <div><div className="text-[9px] text-neutral-500">A SUBTOTAL</div><div className="font-bold">Rp {diff.data.totals.subtotalA.toLocaleString('id-ID')}</div></div>
                <div><div className="text-[9px] text-neutral-500">B SUBTOTAL</div><div className="font-bold">Rp {diff.data.totals.subtotalB.toLocaleString('id-ID')}</div></div>
                <div><div className="text-[9px] text-neutral-500">DELTA</div>
                  <div className={`font-bold ${diff.data.totals.delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {diff.data.totals.delta >= 0 ? '+' : ''}Rp {Math.abs(diff.data.totals.delta).toLocaleString('id-ID')} ({diff.data.totals.deltaPct >= 0 ? '+' : ''}{diff.data.totals.deltaPct}%)
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] font-mono text-[10px]">
                <thead><tr className="border-b border-neutral-300">
                  <th className="text-left px-1 py-1">STATUS</th>
                  <th className="text-left px-1 py-1">AHSP ID</th>
                  <th className="text-right px-1 py-1">A QTY</th>
                  <th className="text-right px-1 py-1">B QTY</th>
                  <th className="text-right px-1 py-1">A RATE</th>
                  <th className="text-right px-1 py-1">B RATE</th>
                </tr></thead>
                <tbody>{diff.data.lines.filter(l => l.status !== 'same').map(l => (
                  <tr key={l.ahspItemId} className={
                    l.status === 'added' ? 'bg-green-100' : l.status === 'removed' ? 'bg-red-100' : 'bg-orange-100'
                  }>
                    <td className="px-1 py-0.5 uppercase font-bold">{l.status}</td>
                    <td className="px-1 py-0.5">{l.ahspItemId.slice(0, 8)}</td>
                    <td className="px-1 py-0.5 text-right">{l.a?.quantity ?? '—'}</td>
                    <td className="px-1 py-0.5 text-right">{l.b?.quantity ?? '—'}</td>
                    <td className="px-1 py-0.5 text-right">{l.a?.unitRateOverride ?? '—'}</td>
                    <td className="px-1 py-0.5 text-right">{l.b?.unitRateOverride ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
