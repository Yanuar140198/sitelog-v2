'use client';
import { trpc } from '@sitelog/api-client/react';

function Bar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const unlimited = limit <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const colorClass = pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-amber-500' : 'bg-[var(--color-brand)]';
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs">
        <span className="text-neutral-700">{label}</span>
        <span className="text-neutral-900 font-bold">
          {used.toLocaleString()} {unit}
          {!unlimited && <> · <span className="text-neutral-500">/ {limit.toLocaleString()} {unit}</span></>}
          {unlimited && <span className="text-green-700"> · unlimited</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-neutral-200 overflow-hidden">
          <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function UsagePage() {
  const usage = trpc.usage.current.useQuery(undefined, { retry: false });

  if (usage.isLoading) return <p className="font-mono text-xs text-neutral-500">Loading…</p>;
  if (usage.error) return <div className="bg-red-100 border-2 border-red-600 p-4 font-mono text-xs text-red-900">{usage.error.message}</div>;
  if (!usage.data) return null;

  const { plan, metrics, limits } = usage.data as any;
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="font-mono text-xs">
        <span className="text-neutral-500">Current plan: </span>
        <strong className="uppercase text-[var(--color-brand)]">{plan}</strong>
      </div>

      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          THIS MONTH
        </h2>
        <div className="p-4 space-y-4">
          <Bar label="AI calls" used={metrics.aiCalls ?? 0} limit={limits.aiCallsPerMonth} unit="calls" />
          <Bar label="Storage (photos)" used={metrics.photosMB ?? 0} limit={limits.storageGb * 1024} unit="MB" />
          <Bar label="API calls" used={metrics.apiCalls ?? 0} limit={-1} unit="" />
          <Bar label="Daily entries submitted" used={metrics.entries ?? 0} limit={-1} unit="" />
        </div>
      </section>

      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          PLAN LIMITS
        </h2>
        <table className="w-full font-mono text-xs">
          <tbody>
            <tr className="border-t border-neutral-200"><td className="px-4 py-2 text-neutral-500">Projects</td><td className="px-4 py-2 font-bold">{limits.projects === -1 ? 'unlimited' : limits.projects}</td></tr>
            <tr className="border-t border-neutral-200"><td className="px-4 py-2 text-neutral-500">Seats</td><td className="px-4 py-2 font-bold">{limits.seats === -1 ? 'unlimited' : limits.seats}</td></tr>
            <tr className="border-t border-neutral-200"><td className="px-4 py-2 text-neutral-500">Storage</td><td className="px-4 py-2 font-bold">{limits.storageGb === -1 ? 'unlimited' : `${limits.storageGb} GB`}</td></tr>
            <tr className="border-t border-neutral-200"><td className="px-4 py-2 text-neutral-500">AI calls / month</td><td className="px-4 py-2 font-bold">{limits.aiCallsPerMonth === -1 ? 'unlimited' : limits.aiCallsPerMonth.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
