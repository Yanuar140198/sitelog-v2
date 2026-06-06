'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

type Source = 'client' | 'trpc' | 'rest' | 'server';
const SOURCES: Source[] = ['client', 'trpc', 'rest', 'server'];

const RANGES: { label: string; hours: number | undefined }[] = [
  { label: '1H', hours: 1 },
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: 'ALL', hours: undefined },
];

const SOURCE_COLORS: Record<string, string> = {
  client: 'bg-blue-600',
  trpc: 'bg-purple-600',
  rest: 'bg-emerald-600',
  server: 'bg-amber-600',
};

export default function SuperAdminErrors() {
  const [source, setSource] = useState<Source | undefined>(undefined);
  const [sinceHours, setSinceHours] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const stats = trpc.errorLog.stats.useQuery(undefined, { retry: false });
  const recent = trpc.errorLog.recent.useQuery({ limit: 100, source, sinceHours }, { retry: false });

  const clear = trpc.errorLog.clear.useMutation({
    onSuccess: () => {
      utils.errorLog.recent.invalidate();
      utils.errorLog.stats.invalidate();
    },
  });

  const queryError = stats.error ?? recent.error;
  if (queryError) {
    return (
      <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">
        {queryError.message} — super-admin access required (add your email to SITELOG_ADMIN_EMAILS).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Error Log</h1>
          <p className="font-mono text-xs text-white/60 mt-2">
            Captured client, tRPC, REST and server errors across all orgs.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              utils.errorLog.recent.invalidate();
              utils.errorLog.stats.invalidate();
            }}
            className="border-2 border-white/30 px-4 py-2 font-mono text-xs tracking-wider hover:bg-white/10"
          >
            REFRESH
          </button>
          <button
            onClick={() => {
              if (confirm('Delete ALL error logs? This cannot be undone.')) clear.mutate();
            }}
            disabled={clear.isPending}
            className="border-2 border-red-600 text-red-400 px-4 py-2 font-mono text-xs tracking-wider hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            {clear.isPending ? 'CLEARING…' : 'CLEAR ALL'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border-2 border-white/30 bg-black/50 p-4">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)]">TOTAL (24h)</div>
          <div className="font-display text-3xl font-bold mt-1">{stats.data?.total ?? 0}</div>
        </div>
        {SOURCES.map(s => {
          const n = stats.data?.bySource.find(r => r.source === s)?.n ?? 0;
          return (
            <div key={s} className="border border-white/20 bg-black/50 p-4 font-mono">
              <div className="text-[10px] tracking-wider text-white/60">{s.toUpperCase()}</div>
              <div className="text-2xl font-bold mt-1">{n}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Source filter */}
        <div className="flex gap-2 flex-wrap font-mono text-xs">
          <FilterBtn label="ALL" active={source === undefined} onClick={() => setSource(undefined)} />
          {SOURCES.map(s => (
            <FilterBtn key={s} label={s.toUpperCase()} active={source === s} onClick={() => setSource(s)} />
          ))}
        </div>

        {/* Time-range filter */}
        <div className="flex gap-2 flex-wrap font-mono text-xs">
          {RANGES.map(r => (
            <FilterBtn
              key={r.label}
              label={r.label}
              active={sinceHours === r.hours}
              onClick={() => setSinceHours(r.hours)}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50 min-w-[720px]">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">TIME</th>
            <th className="text-left px-3 py-2 tracking-wider">SOURCE</th>
            <th className="text-left px-3 py-2 tracking-wider">LEVEL</th>
            <th className="text-left px-3 py-2 tracking-wider">MESSAGE</th>
            <th className="text-left px-3 py-2 tracking-wider">PATH / URL</th>
            <th className="text-left px-3 py-2 tracking-wider">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {recent.isLoading && (
            <tr><td colSpan={6} className="text-center py-8 text-white/50">Loading…</td></tr>
          )}
          {recent.data?.map(e => {
            const open = expanded === e.id;
            return (
              <tr
                key={e.id}
                className="border-b border-white/10 hover:bg-white/5 cursor-pointer align-top"
                onClick={() => setExpanded(open ? null : e.id)}
              >
                <td className="px-3 py-2 text-white/70 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-white text-[10px] ${SOURCE_COLORS[e.source] ?? 'bg-neutral-600'}`}>
                    {e.source}
                  </span>
                </td>
                <td className="px-3 py-2 text-white/70">{e.level}</td>
                <td className="px-3 py-2 text-white/90">
                  <div className={open ? '' : 'truncate max-w-[360px]'} title={e.message}>{e.message}</div>
                  {open && e.stack && (
                    <pre className="mt-2 p-2 bg-black border border-white/20 text-[10px] text-white/60 whitespace-pre-wrap overflow-x-auto max-h-64">
                      {e.stack}
                    </pre>
                  )}
                  {open && e.context != null && (
                    <pre className="mt-2 p-2 bg-black border border-white/20 text-[10px] text-white/60 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(e.context, null, 2)}
                    </pre>
                  )}
                </td>
                <td className="px-3 py-2 text-white/60 truncate max-w-[200px]" title={e.url ?? e.path ?? ''}>
                  {e.path ?? e.url ?? '—'}
                </td>
                <td className="px-3 py-2 text-white/70">{e.status ?? '—'}</td>
              </tr>
            );
          })}
          {recent.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-white/50">No errors logged.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 border-2 tracking-wider ${
        active ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-white/30 text-white/70 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}
