'use client';
import { useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { X, Sparkles, TrendingUp, Wrench, Tag } from 'lucide-react';

export function PhotoAiPanel({ imageUrl, context, onClose }: { imageUrl: string; context?: string; onClose: () => void }) {
  const analyze = trpc.ai.analyzePhoto.useMutation();

  useEffect(() => {
    analyze.mutate({ imageUrl, context });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-2xl max-h-[90vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold flex items-center gap-1">
              <Sparkles size={10} /> AI VISION ANALYSIS
            </div>
            <h2 className="font-display text-xl font-bold mt-1">Photo Analysis</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5">
          <img src={imageUrl} alt="" className="w-full max-h-64 object-contain border-2 border-[var(--color-ink)]" />
        </div>

        <div className="px-5 pb-5 space-y-4">
          {analyze.isPending && (
            <div className="text-center py-8 font-mono text-xs text-neutral-500">
              <Sparkles size={32} className="mx-auto text-[var(--color-brand)] mb-3 animate-pulse" />
              Claude is analyzing photo...
            </div>
          )}

          {analyze.error && (
            <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono">
              {analyze.error.message}
            </div>
          )}

          {analyze.data && (
            <>
              {analyze.data.caption && (
                <Section title="DESCRIPTION" icon={Sparkles}>
                  <p className="font-mono text-sm">{analyze.data.caption}</p>
                </Section>
              )}

              {analyze.data.detectedEquipment.length > 0 && (
                <Section title="DETECTED EQUIPMENT" icon={Wrench}>
                  <div className="flex flex-wrap gap-1">
                    {analyze.data.detectedEquipment.map((eq: string, i: number) => (
                      <span key={i} className="bg-[var(--color-ink)] text-white px-2 py-1 font-mono text-xs">{eq}</span>
                    ))}
                  </div>
                </Section>
              )}

              {analyze.data.progressEstimate !== null && (
                <Section title="PROGRESS ESTIMATE" icon={TrendingUp}>
                  <div className="font-display text-3xl font-bold text-[var(--color-brand)]">{analyze.data.progressEstimate}%</div>
                  <div className="h-3 bg-neutral-200 border border-[var(--color-ink)] mt-2">
                    <div className="h-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, analyze.data.progressEstimate)}%` }} />
                  </div>
                </Section>
              )}

              {analyze.data.tags.length > 0 && (
                <Section title="TAGS" icon={Tag}>
                  <div className="flex flex-wrap gap-1">
                    {analyze.data.tags.map((t: string, i: number) => (
                      <span key={i} className="border border-[var(--color-ink)] px-2 py-0.5 font-mono text-xs">#{t}</span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-3 py-2 bg-neutral-50 border-b border-[var(--color-ink)] font-mono text-xs tracking-[0.15em] flex items-center gap-2">
        <Icon size={12} className="text-[var(--color-brand)]" /> {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
