'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusResp { ok: boolean; ts: number; checks: Record<string, { ok: boolean; latency?: number; error?: string }> }

export default function StatusPage() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/status`);
      setData(await res.json());
    } catch { setData({ ok: false, ts: Date.now(), checks: { network: { ok: false, error: 'Unreachable' } } }); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="bg-[var(--color-ink)] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="font-mono text-sm tracking-[0.2em] text-[var(--color-brand)] font-bold">◣ SITELOG</div>
          <div className="font-mono text-xs text-neutral-400">STATUS</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">SYSTEM</p>
          <h1 className="font-display text-5xl font-bold tracking-tight mt-2">
            {!data ? 'Checking...' : data.ok ? 'All Systems Operational' : 'Service Degraded'}
          </h1>
        </div>

        <div className={`border-2 p-6 ${data?.ok ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
          <div className="flex items-center gap-3">
            {data?.ok ? <CheckCircle2 size={32} className="text-green-600" /> : <AlertCircle size={32} className="text-red-600" />}
            <div>
              <div className="font-display text-xl font-bold">{data?.ok ? 'Operational' : 'Issues Detected'}</div>
              <div className="font-mono text-xs text-neutral-600">Updated {data ? new Date(data.ts).toLocaleString('id-ID') : '—'}</div>
            </div>
          </div>
        </div>

        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">COMPONENTS</div>
          <div className="divide-y divide-neutral-200">
            {data ? Object.entries(data.checks).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center p-3 font-mono text-sm">
                <div className="flex items-center gap-2">
                  {v.ok ? <CheckCircle2 size={14} className="text-green-600" /> : <AlertCircle size={14} className="text-red-600" />}
                  <strong className="uppercase tracking-wider text-xs">{k}</strong>
                </div>
                <div className="text-xs text-neutral-500">
                  {v.ok ? (v.latency !== undefined ? `${v.latency}ms` : 'OK') : (v.error ?? 'fail')}
                </div>
              </div>
            )) : <div className="p-8 text-center text-neutral-500">Loading...</div>}
          </div>
        </div>

        <button onClick={fetchStatus} disabled={loading} className="font-mono text-xs text-[var(--color-brand)] hover:underline">
          {loading ? '⟳ refreshing...' : '↻ refresh now'}
        </button>
      </main>
    </div>
  );
}
