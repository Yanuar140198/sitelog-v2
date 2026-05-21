'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { ArrowLeft, MapPin, Clock, Users, CloudSun, Camera, Sparkles } from 'lucide-react';
import { Lightbox } from '@/components/photo/lightbox';
import { PhotoAiPanel } from '@/components/photo/photo-ai-panel';

export default function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = trpc.entry.detail.useQuery({ id });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [aiPhotoUrl, setAiPhotoUrl] = useState<string | null>(null);
  if (!detail.data) return <div className="p-8 font-mono text-sm">Loading...</div>;
  const e = detail.data;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Link href="/app/entries" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> BACK
      </Link>
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">DAILY ENTRY</p>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-1">{new Date(e.entryDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Meta icon={Clock} label="SHIFT" value={e.shift.toUpperCase()} />
        <Meta icon={CloudSun} label="WEATHER" value={e.weather?.toUpperCase() ?? '—'} />
        <Meta icon={Clock} label="HOURS" value={e.effectiveHours ?? '—'} />
        <Meta icon={Users} label="WORKFORCE" value={e.workforce ?? '—'} />
      </div>

      {e.notes && (
        <Section title="NOTES">
          <p className="font-mono text-sm whitespace-pre-wrap">{e.notes}</p>
        </Section>
      )}

      <Section title={`ACTIVITIES (${e.activities.length})`}>
        {e.activities.length === 0 ? <Empty /> : (
          <table className="w-full font-mono text-xs">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left px-2 py-1.5">DESCRIPTION</th>
              <th className="text-right px-2 py-1.5">QUANTITY</th>
              <th className="text-left px-2 py-1.5">SATUAN</th>
              <th className="text-left px-2 py-1.5">STATION</th>
            </tr></thead>
            <tbody>{e.activities.map(a => (
              <tr key={a.id} className="border-b border-neutral-100">
                <td className="px-2 py-1.5">{a.description}</td>
                <td className="px-2 py-1.5 text-right font-bold">{a.quantity}</td>
                <td className="px-2 py-1.5">{a.satuan ?? '—'}</td>
                <td className="px-2 py-1.5">{a.station ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section title={`EQUIPMENT (${e.equipment.length})`}>
        {e.equipment.length === 0 ? <Empty /> : (
          <table className="w-full font-mono text-xs">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left px-2 py-1.5">UNIT</th>
              <th className="text-right px-2 py-1.5">HM WORK</th>
              <th className="text-right px-2 py-1.5">HM IDLE</th>
              <th className="text-right px-2 py-1.5">FUEL (L)</th>
              <th className="text-right px-2 py-1.5">ODO (km)</th>
              <th className="text-right px-2 py-1.5">TRIPS</th>
            </tr></thead>
            <tbody>{e.equipment.map(eq => (
              <tr key={eq.id} className="border-b border-neutral-100">
                <td className="px-2 py-1.5">{eq.unitId?.slice(0,8) ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{eq.hmWork ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{eq.hmIdle ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{eq.fuelLiters ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{eq.odometerKm ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{eq.trips ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section title={`PHOTOS (${e.photos.length})`}>
        {e.photos.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {e.photos.map((p: any, idx) => {
              const aiTags = (() => { try { return JSON.parse(p.aiTags ?? '[]'); } catch { return []; } })();
              return (
                <div key={p.id} className="border-2 border-[var(--color-ink)] aspect-square bg-neutral-100 relative overflow-hidden hover:shadow-[3px_3px_0_var(--color-brand)] transition group">
                  <button onClick={() => setLightbox(idx)} className="absolute inset-0 cursor-zoom-in">
                    {p.url ? <img src={p.url} alt={p.aiCaption ?? p.caption ?? ''} className="w-full h-full object-cover" />
                      : <div className="absolute inset-0 flex items-center justify-center text-neutral-400"><Camera size={32} /></div>}
                  </button>
                  {p.aiAnalyzedAt && (
                    <div className="absolute top-1 left-1 bg-[var(--color-brand)] text-white px-1.5 py-0.5 font-mono text-[8px] font-bold flex items-center gap-0.5 pointer-events-none">
                      <Sparkles size={8} /> AI
                    </div>
                  )}
                  {p.aiProgressPct !== null && p.aiProgressPct !== undefined && (
                    <div className="absolute top-1 right-1 bg-black/80 text-white px-1.5 py-0.5 font-mono text-[8px] font-bold pointer-events-none">
                      {Number(p.aiProgressPct).toFixed(0)}%
                    </div>
                  )}
                  {(p.aiCaption || p.caption) && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white p-2 font-mono text-[10px] text-left pointer-events-none">
                      {p.aiCaption ?? p.caption}
                      {aiTags.length > 0 && <div className="mt-1 text-[8px] text-white/70">{aiTags.slice(0, 3).map((t: string) => `#${t}`).join(' ')}</div>}
                    </div>
                  )}
                  {p.url && (
                    <button onClick={(ev) => { ev.stopPropagation(); setAiPhotoUrl(p.url!); }}
                      className="absolute bottom-1 right-1 bg-[var(--color-brand)] text-white p-1 opacity-0 group-hover:opacity-100 transition z-10"
                      title="AI re-analyze">
                      <Sparkles size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
      {lightbox !== null && (
        <Lightbox photos={e.photos.map(p => ({ url: p.url, caption: p.caption, lat: p.lat as any, lng: p.lng as any }))}
          startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
      {aiPhotoUrl && <PhotoAiPanel imageUrl={aiPhotoUrl} context={`Entry date: ${e.entryDate}, shift ${e.shift}`} onClose={() => setAiPhotoUrl(null)} />}

      {e.submittedAtLat && e.submittedAtLng && (
        <div className="font-mono text-xs text-neutral-500 flex items-center gap-1">
          <MapPin size={12} /> {e.submittedAtLat}, {e.submittedAtLng} · v{e.appVersion} · submitted {new Date(e.submittedAt).toLocaleString('id-ID')}
        </div>
      )}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white p-3">
      <div className="font-mono text-[9px] tracking-wider text-neutral-500 flex items-center gap-1"><Icon size={10} /> {label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Empty() { return <div className="text-center py-8 text-neutral-500 font-mono text-xs">No data</div>; }
