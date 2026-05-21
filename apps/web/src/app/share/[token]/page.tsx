'use client';
import { use } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const view = trpc.share.view.useQuery({ token });

  if (view.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-red-600">LINK INVALID</p>
          <h1 className="font-display text-3xl font-bold mt-3">{view.error.message}</h1>
        </div>
      </div>
    );
  }
  if (!view.data) return <div className="p-8 font-mono text-sm">Loading...</div>;
  const { project, kpi, share } = view.data;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="bg-[var(--color-ink)] text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="font-mono text-sm tracking-[0.2em] text-[var(--color-brand)] font-bold">◣ SITELOG</div>
          <div className="font-mono text-[10px] text-neutral-400">PUBLIC SHARE · READ ONLY</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8 space-y-6">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">{project.code}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-2">{project.name}</h1>
          <div className="font-mono text-sm text-neutral-600 mt-2">
            {project.client ?? '—'} · {project.location ?? '—'} · status: <strong className="uppercase">{project.status}</strong>
          </div>
          {project.startDate && (
            <div className="font-mono text-xs text-neutral-500 mt-1">
              {project.startDate} → {project.finishDate ?? '—'}
            </div>
          )}
        </div>

        {kpi && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card label="BOQ SCOPES" value={String(kpi.scopeCount)} />
            <Card label="BOQ SUBTOTAL" value={fmtIDR(kpi.subtotal)} />
            <Card label="EARNED VALUE" value={fmtIDR(kpi.earned)} />
            <Card label="PROGRESS" value={`${kpi.progressPct}%`} highlight />
          </div>
        )}

        {kpi && (
          <section className="border-2 border-[var(--color-ink)] bg-white p-6">
            <h2 className="font-display text-lg font-bold">Progress vs Plan</h2>
            <div className="mt-4">
              <div className="flex justify-between font-mono text-xs"><span>Earned</span><span>{fmtIDR(kpi.earned)} of {fmtIDR(kpi.subtotal)}</span></div>
              <div className="h-4 bg-neutral-200 border-2 border-[var(--color-ink)] mt-1">
                <div className="h-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, kpi.progressPct)}%` }} />
              </div>
            </div>
          </section>
        )}

        <footer className="font-mono text-[10px] text-neutral-400 text-center pt-12">
          Shared via Sitelog · {new Date(share.createdAt).toLocaleDateString('id-ID')} · {share.label ?? 'untitled'}
        </footer>
      </main>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border-2 border-[var(--color-ink)] p-5 ${highlight ? 'bg-[var(--color-brand)] text-white' : 'bg-white'}`}>
      <div className="font-mono text-[10px] tracking-[0.2em] opacity-70">{label}</div>
      <div className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</div>
    </div>
  );
}
