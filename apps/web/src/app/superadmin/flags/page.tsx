'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SuperAdminFlags() {
  const list = trpc.featureFlag.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const setFlag = trpc.featureFlag.set.useMutation({
    onSuccess: () => utils.featureFlag.list.invalidate(),
  });

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Feature Flags</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Toggle global enable or set rollout %. Per-org overrides via /superadmin/orgs/[slug]. Order: override → rollout pct (deterministic per org) → global.</p>
      </div>

      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">KEY</th>
            <th className="text-left px-3 py-2 tracking-wider">DESCRIPTION</th>
            <th className="text-center px-3 py-2 tracking-wider">GLOBAL</th>
            <th className="text-center px-3 py-2 tracking-wider">ROLLOUT %</th>
            <th className="text-right px-3 py-2 tracking-wider"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(f => (
            <FlagRow key={f.key} flag={f} onSave={(payload) => setFlag.mutate(payload)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlagRow({ flag, onSave }: { flag: any; onSave: (p: any) => void }) {
  return (
    <tr className="border-b border-white/10 hover:bg-white/5">
      <td className="px-3 py-2 text-[var(--color-brand)] font-bold">{flag.key}</td>
      <td className="px-3 py-2 text-white/70">{flag.description ?? '—'}</td>
      <td className="px-3 py-2 text-center">
        <ToggleButton
          value={flag.enabledGlobally}
          onChange={(v) => onSave({ key: flag.key, enabledGlobally: v, rolloutPct: flag.rolloutPct })}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="number" min={0} max={100} defaultValue={flag.rolloutPct}
          onBlur={(e) => {
            const pct = Number(e.target.value);
            if (pct !== flag.rolloutPct) onSave({ key: flag.key, enabledGlobally: flag.enabledGlobally, rolloutPct: pct });
          }}
          className="w-16 bg-black border border-white/30 px-2 py-1 text-center text-white"
        />
      </td>
      <td className="px-3 py-2 text-right text-white/40">{new Date(flag.updatedAt).toLocaleDateString()}</td>
    </tr>
  );
}

function ToggleButton({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-3 py-1 text-[10px] font-bold ${value ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-300'}`}
    >
      {value ? 'ON' : 'OFF'}
    </button>
  );
}
