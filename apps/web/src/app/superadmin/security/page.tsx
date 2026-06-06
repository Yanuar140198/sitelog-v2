'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

export default function SuperAdminSecurity() {
  const [since, setSince] = useState<'24h' | '7d' | '30d'>('24h');
  const list = trpc.admin.recentFailedLogins.useQuery({ limit: 200, since }, { retry: false });
  const utils = trpc.useUtils();
  const killSessions = trpc.admin.killUserSessions.useMutation();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [killError, setKillError] = useState<string | null>(null);

  // Failed-login rows only carry an email; killUserSessions needs a userId.
  // Resolve email -> userId via the existing searchUsers query, then kill.
  async function handleKill(email: string) {
    if (!confirm(`Kill all sessions for ${email}? They will be force-logged-out everywhere.`)) return;
    setKillError(null);
    setBusyEmail(email);
    try {
      const matches = await utils.admin.searchUsers.fetch({ q: email, limit: 5 });
      const target = matches.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!target) throw new Error(`No user account found for ${email} (cannot kill sessions).`);
      const res = await killSessions.mutateAsync({ userId: target.id });
      await utils.admin.recentFailedLogins.invalidate();
      alert(`Killed ${res.revoked} session(s) for ${email}.`);
    } catch (e) {
      setKillError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyEmail(null);
    }
  }

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  // Aggregate by IP for top offenders
  const ipCounts = new Map<string, number>();
  for (const r of list.data ?? []) {
    const ip = r.ip_address ?? 'unknown';
    ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
  }
  const topIps = [...ipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">SECURITY</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Failed Logins</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Monitor brute-force + credential-stuffing attempts.</p>
      </div>

      <div className="flex gap-2 font-mono text-xs">
        {(['24h', '7d', '30d'] as const).map(s => (
          <button key={s} onClick={() => setSince(s)}
            className={`px-4 py-2 border-2 ${since === s ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-white/30 text-white/70 hover:border-white'}`}>
            LAST {s.toUpperCase()}
          </button>
        ))}
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">TOP OFFENDER IPS ({topIps.length})</h2>
        {topIps.length === 0 && <p className="font-mono text-xs text-white/50">No failed logins in window.</p>}
        {topIps.map(([ip, count]) => (
          <div key={ip} className="flex justify-between py-1 border-t border-white/10 font-mono text-xs">
            <span className="text-white/70">{ip}</span>
            <strong className={count > 10 ? 'text-red-400' : count > 3 ? 'text-amber-400' : 'text-white'}>{count} attempts</strong>
          </div>
        ))}
      </section>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">RECENT FAILURES ({list.data?.length ?? 0})</h2>
        {killError && (
          <div className="bg-red-900 border-2 border-red-600 p-3 mb-3 font-mono text-xs text-red-200">{killError}</div>
        )}
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[640px]">
          <thead className="text-white/50"><tr>
            <th className="text-left py-1">TIME</th>
            <th className="text-left">EMAIL</th>
            <th className="text-left">REASON</th>
            <th className="text-left">IP</th>
            <th className="text-left">USER-AGENT</th>
            <th className="text-right">ACTIONS</th>
          </tr></thead>
          <tbody>
            {list.data?.map(r => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="py-1 text-white/70">{new Date(r.created_at).toLocaleString()}</td>
                <td className="text-white">{r.email}</td>
                <td className="text-amber-400">{r.reason ?? '—'}</td>
                <td className="text-white/70">{r.ip_address ?? '—'}</td>
                <td className="text-white/50 truncate max-w-xs" title={r.user_agent ?? ''}>{(r.user_agent ?? '—').slice(0, 50)}</td>
                <td className="text-right">
                  <button
                    onClick={() => handleKill(r.email)}
                    disabled={busyEmail === r.email}
                    className="text-red-400 hover:text-red-200 disabled:text-white/30 disabled:no-underline text-[10px] underline"
                    title="Resolve this email to its account and revoke all sessions (force re-login)"
                  >
                    {busyEmail === r.email ? 'KILLING…' : 'KILL SESSIONS'}
                  </button>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-white/50">No failures in window — clean.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
