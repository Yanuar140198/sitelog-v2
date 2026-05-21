'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, X, Plus } from 'lucide-react';

export function AiSuggestPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const project = trpc.project.get.useQuery({ id: projectId });
  const utils = trpc.useUtils();
  const suggest = trpc.ai.suggestBoq.useMutation();
  const upsert = trpc.boq.upsert.useMutation({ onSuccess: () => utils.boq.list.invalidate({ projectId }) });
  const ahsp = trpc.ahsp.catalog.useQuery();
  const [projectType, setProjectType] = useState('mining_dt');

  function run() {
    const p = project.data;
    suggest.mutate({
      projectType,
      planVolumes: {
        cutSoil: Number(p?.planCutSoil ?? 0),
        cutRock: Number(p?.planCutRock ?? 0),
        fill: Number(p?.planFill ?? 0),
        landClearing: Number(p?.planLandClearing ?? 0),
      },
    });
  }

  async function addSuggestion(ahspKode: string, qty: number) {
    const item = (ahsp.data ?? []).find(a => a.kode === ahspKode);
    if (!item) { alert(`AHSP ${ahspKode} not found in catalog`); return; }
    await upsert.mutateAsync({ projectId, ahspItemId: item.id, quantity: qty });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold flex items-center gap-1">
              <Sparkles size={10} /> AI SUGGESTIONS
            </div>
            <h2 className="font-display text-xl font-bold mt-1">Recommended Scopes</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5 border-b border-neutral-200 bg-neutral-50">
          <div className="flex gap-2 items-end">
            <div className="flex-1"><Label>Project type</Label>
              <select value={projectType} onChange={e => setProjectType(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                <option value="mining_dt">Mining (Dump Truck)</option>
                <option value="mining_adt">Mining (Articulated DT)</option>
                <option value="civil_road">Civil Road</option>
                <option value="drainage">Drainage</option>
                <option value="building">Building</option>
              </select>
            </div>
            <Button onClick={run} variant="primary" disabled={suggest.isPending}>
              <Sparkles size={14} /> {suggest.isPending ? 'THINKING...' : 'GET SUGGESTIONS'}
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-2">
          {suggest.data?.suggestions.map((s, i) => (
            <div key={i} className="border-2 border-[var(--color-ink)] p-3 flex justify-between items-start">
              <div className="flex-1">
                <div className="font-mono"><strong className="text-[var(--color-brand)]">{s.ahspKode}</strong> · qty {s.defaultQty}</div>
                <div className="font-mono text-xs text-neutral-600 mt-1">{s.reason}</div>
              </div>
              <Button onClick={() => addSuggestion(s.ahspKode, s.defaultQty)} disabled={upsert.isPending}>
                <Plus size={12} /> ADD
              </Button>
            </div>
          ))}
          {suggest.isPending && <div className="font-mono text-xs text-neutral-500 text-center py-8">AI is analyzing project...</div>}
          {!suggest.data && !suggest.isPending && (
            <div className="font-mono text-xs text-neutral-500 text-center py-8">Click GET SUGGESTIONS to start.</div>
          )}
        </div>
      </div>
    </div>
  );
}
