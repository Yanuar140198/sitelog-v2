'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SuperAdminDashboard() {
  const stats = trpc.admin.stats.useQuery();
  if (stats.error) {
    return <div className="bg-red-900 border-2 border-red-600 text-red-200 p-6 font-mono">
      {stats.error.message} — Add your email to SITELOG_ADMIN_EMAILS env var.
    </div>;
  }
  const s = stats.data;
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Super Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="ORGANIZATIONS" value={s?.orgs ?? 0} sub={s?.recency?.orgs7d ? `+${s.recency.orgs7d} last 7d` : undefined} />
        <Kpi label="USERS" value={s?.users ?? 0} sub={s?.recency?.users7d ? `+${s.recency.users7d} last 7d` : undefined} />
        <Kpi label="PROJECTS" value={s?.projects ?? 0} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="ENTRIES (24h)"     value={s?.recency?.entries24h ?? 0} />
        <Kpi label="ENTRIES (7d)"       value={s?.recency?.entries7d ?? 0} />
        <Kpi label="AUDIT (24h)"        value={s?.recency?.audit24h ?? 0} />
        <Kpi label="WEBHOOKS ACTIVE"    value={s?.recency?.webhooksActive ?? 0} />
      </div>

      <div className="border-2 border-white/20 bg-black/50 p-6">
        <h2 className="font-display text-xl font-bold">Subscriptions by plan</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(s?.bySubscriptionPlan ?? {}).map(([plan, count]) => (
            <div key={plan} className="border border-white/30 p-4 font-mono">
              <div className="text-[10px] tracking-wider text-[var(--color-brand)]">{plan.toUpperCase()}</div>
              <div className="text-3xl font-bold mt-1">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border-2 border-white/30 bg-black/50 p-6">
      <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)]">{label}</div>
      <div className="font-display text-4xl font-bold mt-2">{value.toLocaleString()}</div>
      {sub && <div className="font-mono text-[10px] text-white/50 mt-1">{sub}</div>}
    </div>
  );
}
