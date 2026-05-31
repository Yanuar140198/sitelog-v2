'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

export default function SuperAdminUsers() {
  const [q, setQ] = useState('');
  const list = trpc.admin.searchUsers.useQuery({ q, limit: 50 }, { retry: false });
  const killSessions = trpc.admin.killUserSessions.useMutation();

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Users</h1>
        <p className="font-mono text-xs text-white/60 mt-2">Search by email or name (case-insensitive). Last 50 matches.</p>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search email or name..."
        className="w-full bg-black border-2 border-white/30 px-4 py-3 font-mono text-sm text-white placeholder-white/40"
      />

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50 min-w-[720px]">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">EMAIL</th>
            <th className="text-left px-3 py-2 tracking-wider">NAME</th>
            <th className="text-right px-3 py-2 tracking-wider">ORGS</th>
            <th className="text-left px-3 py-2 tracking-wider">CREATED</th>
            <th className="text-left px-3 py-2 tracking-wider">LAST LOGIN</th>
            <th className="text-right px-3 py-2 tracking-wider">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(u => (
            <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
              <td className="px-3 py-2 text-[var(--color-brand)]">{u.email}</td>
              <td className="px-3 py-2">{u.name ?? '—'}</td>
              <td className="px-3 py-2 text-right font-bold">{u.org_count}</td>
              <td className="px-3 py-2 text-white/70">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-white/70">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => confirm(`Kill all sessions for ${u.email}?`) && killSessions.mutate({ userId: u.id })}
                  className="text-red-400 hover:text-red-200 text-[10px] underline"
                  title="Revoke all sessions (force re-login)"
                >
                  KILL SESSIONS
                </button>
              </td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-white/50">No matches.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
