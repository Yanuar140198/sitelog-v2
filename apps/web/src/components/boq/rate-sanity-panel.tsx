'use client';
import { useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { fmtIDR } from '@/lib/utils';

export function RateSanityPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const check = trpc.ai.rateSanity.useMutation();
  useEffect(() => { check.mutate({ projectId }); /* eslint-disable-next-line */ }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-2xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">VALIDATION</div>
            <h2 className="font-display text-xl font-bold mt-1">Rate Sanity Check</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>
        <div className="p-5">
          {check.isPending && <div className="font-mono text-xs text-neutral-500 py-8 text-center">Checking BOQ rates...</div>}
          {check.data && (
            <>
              <div className="font-mono text-xs text-neutral-600 mb-3">
                Checked {check.data.totalChecked} scopes · {check.data.flagged} flagged
              </div>
              {check.data.flags.length === 0 ? (
                <div className="text-center py-12 text-green-700 font-mono text-sm">✓ All rates within 10% of AHSP baseline.</div>
              ) : (
                <div className="space-y-2">
                  {check.data.flags.map((f, i) => {
                    const Icon = f.severity === 'error' ? AlertCircle : f.severity === 'warning' ? AlertTriangle : Info;
                    const color = f.severity === 'error' ? 'text-red-600 bg-red-50 border-red-600'
                      : f.severity === 'warning' ? 'text-orange-600 bg-orange-50 border-orange-600'
                      : 'text-blue-600 bg-blue-50 border-blue-600';
                    return (
                      <div key={i} className={`border-2 p-3 ${color}`}>
                        <div className="flex items-start gap-2">
                          <Icon size={16} className="mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-mono text-sm font-bold">{f.kode} · {f.jenis}</div>
                            <div className="font-mono text-xs mt-1">{f.note}</div>
                            <div className="font-mono text-[10px] text-neutral-600 mt-1">
                              Rate {fmtIDR(f.rate)} vs baseline {fmtIDR(f.baseline)} ({f.deviationPct > 0 ? '+' : ''}{f.deviationPct}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
