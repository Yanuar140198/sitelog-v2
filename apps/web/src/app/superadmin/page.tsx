'use client';
import { trpc } from '@sitelog/api-client/react';

const LINKS: Array<{ href: string; label: string; desc: string }> = [
  { href: '/superadmin/orgs', label: 'ORGANIZATIONS', desc: 'All customer orgs, plans + counts' },
  { href: '/superadmin/users', label: 'USERS', desc: 'Search users platform-wide' },
  { href: '/superadmin/api-keys', label: 'API KEYS', desc: 'List + revoke keys' },
  { href: '/superadmin/webhooks', label: 'WEBHOOKS', desc: 'Recent deliveries across orgs' },
  { href: '/superadmin/audit', label: 'AUDIT', desc: 'Platform-wide audit events' },
  { href: '/superadmin/errors', label: 'ERRORS', desc: 'Captured error logs' },
  { href: '/superadmin/security', label: 'SECURITY', desc: 'Failed logins + top offenders' },
  { href: '/superadmin/flags', label: 'FLAGS', desc: 'Feature flag controls' },
  { href: '/superadmin/announcements', label: 'ANNOUNCEMENTS', desc: 'Broadcast platform notices' },
  { href: '/superadmin/database', label: 'DATABASE', desc: 'Table sizes + connections' },
];

export default function SuperAdminDashboard() {
  const stats = trpc.admin.stats.useQuery();
  const failed = trpc.admin.recentFailedLogins.useQuery(
    { limit: 8, since: '24h' },
    { retry: false },
  );

  if (stats.error) {
    return (
      <div className="bg-red-900 border-2 border-red-600 text-red-200 p-6 font-mono">
        {stats.error.message} — Add your email to SITELOG_ADMIN_EMAILS env var.
      </div>
    );
  }

  const s = stats.data;
  const loading = stats.isLoading;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Super Admin</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Live platform overview. Ops-only.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="ORGANIZATIONS" value={s?.orgs} loading={loading} sub={s?.recency?.orgs7d ? `+${s.recency.orgs7d} last 7d` : undefined} />
        <Kpi label="USERS" value={s?.users} loading={loading} sub={s?.recency?.users7d ? `+${s.recency.users7d} last 7d` : undefined} />
        <Kpi label="PROJECTS" value={s?.projects} loading={loading} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Kpi label="ENTRIES (24h)" value={s?.recency?.entries24h} loading={loading} />
        <Kpi label="ENTRIES (7d)" value={s?.recency?.entries7d} loading={loading} />
        <Kpi label="AUDIT (24h)" value={s?.recency?.audit24h} loading={loading} />
        <Kpi label="API KEYS ACTIVE" value={s?.recency?.apiKeysActive} loading={loading} />
        <Kpi label="WEBHOOKS ACTIVE" value={s?.recency?.webhooksActive} loading={loading} />
        <Kpi label="FAILED LOGINS (24h)" value={failed.data?.length} loading={failed.isLoading} alert={(failed.data?.length ?? 0) > 0} />
      </div>

      <div className="border-2 border-white/20 bg-black/50 p-6">
        <h2 className="font-display text-xl font-bold">Subscriptions by plan</h2>
        {loading ? (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="border border-white/30 p-4 h-[72px] animate-pulse bg-white/5" />
            ))}
          </div>
        ) : Object.keys(s?.bySubscriptionPlan ?? {}).length === 0 ? (
          <p className="mt-4 font-mono text-xs text-white/50">No subscriptions yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(s?.bySubscriptionPlan ?? {}).map(([plan, count]) => (
              <div key={plan} className="border border-white/30 p-4 font-mono">
                <div className="text-[10px] tracking-wider text-[var(--color-brand)]">{plan.toUpperCase()}</div>
                <div className="text-3xl font-bold mt-1">{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)]">RECENT FAILED LOGINS (24h)</h2>
          <a href="/superadmin/security" className="font-mono text-[10px] text-white/60 hover:text-white hover:underline">VIEW ALL →</a>
        </div>
        {failed.error ? (
          <p className="font-mono text-xs text-red-400">{failed.error.message}</p>
        ) : failed.isLoading ? (
          <p className="font-mono text-xs text-white/50">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs min-w-[560px]">
              <thead className="text-white/50"><tr>
                <th className="text-left py-1">TIME</th>
                <th className="text-left">EMAIL</th>
                <th className="text-left">REASON</th>
                <th className="text-left">IP</th>
              </tr></thead>
              <tbody>
                {failed.data?.map(r => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="py-1 text-white/70">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="text-white">{r.email}</td>
                    <td className="text-amber-400">{r.reason ?? '—'}</td>
                    <td className="text-white/70">{r.ip_address ?? '—'}</td>
                  </tr>
                ))}
                {failed.data?.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-white/50">No failures in last 24h — clean.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">CONSOLE</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {LINKS.map(l => (
            <a key={l.href} href={l.href}
              className="block border-2 border-white/30 bg-black/50 p-4 hover:border-[var(--color-brand)] transition-colors">
              <div className="font-mono text-xs tracking-wider text-[var(--color-brand)]">{l.label}</div>
              <div className="font-mono text-[10px] text-white/50 mt-1 leading-snug">{l.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, loading, alert }: { label: string; value?: number; sub?: string; loading?: boolean; alert?: boolean }) {
  return (
    <div className={`border-2 bg-black/50 p-6 ${alert ? 'border-red-600' : 'border-white/30'}`}>
      <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)]">{label}</div>
      {loading ? (
        <div className="h-10 mt-2 animate-pulse bg-white/10 w-2/3" />
      ) : (
        <div className={`font-display text-4xl font-bold mt-2 ${alert ? 'text-red-400' : ''}`}>{(value ?? 0).toLocaleString()}</div>
      )}
      {sub && !loading && <div className="font-mono text-[10px] text-white/50 mt-1">{sub}</div>}
    </div>
  );
}
