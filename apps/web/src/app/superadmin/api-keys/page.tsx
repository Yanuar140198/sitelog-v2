'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SuperAdminApiKeys() {
  const list = trpc.admin.listApiKeys.useQuery({ limit: 200 }, { retry: false });
  const utils = trpc.useUtils();
  const revoke = trpc.admin.revokeApiKey.useMutation({
    onSuccess: () => utils.admin.listApiKeys.invalidate(),
  });

  if (list.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{list.error.message}</div>;

  const active = list.data?.filter(k => !k.revokedAt) ?? [];
  const revoked = list.data?.filter(k => k.revokedAt) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PLATFORM</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">API Keys</h1>
        <p className="font-mono text-xs text-white/60 mt-2">All keys across all orgs. Revoke immediately on compromise.</p>
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">ACTIVE ({active.length})</h2>
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[640px]">
          <thead className="text-white/50"><tr>
            <th className="text-left py-1">NAME</th><th className="text-left">PREFIX</th><th className="text-left">SCOPE</th>
            <th className="text-left">ORG</th><th className="text-left">LAST USED</th><th className="text-right"></th>
          </tr></thead>
          <tbody>
            {active.map(k => (
              <tr key={k.id} className="border-t border-white/10">
                <td className="py-1">{k.name ?? '—'}</td>
                <td className="text-[var(--color-brand)]">{k.prefix}…</td>
                <td className="uppercase">{k.scope}</td>
                <td className="text-white/70 truncate max-w-[100px]" title={k.organizationId}>{k.organizationId.slice(0, 8)}…</td>
                <td className="text-white/60">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</td>
                <td className="text-right">
                  <button
                    onClick={() => confirm(`Revoke ${k.prefix}…?`) && revoke.mutate({ keyId: k.id })}
                    className="text-red-400 hover:text-red-200 text-[10px] underline"
                  >REVOKE</button>
                </td>
              </tr>
            ))}
            {active.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-white/50">No active keys.</td></tr>}
          </tbody>
        </table>
        </div>
      </section>

      <section className="border-2 border-white/20 bg-black/30 p-4">
        <h2 className="font-mono text-xs tracking-wider text-white/60 mb-3">REVOKED ({revoked.length})</h2>
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[480px]">
          <tbody>
            {revoked.slice(0, 20).map(k => (
              <tr key={k.id} className="border-t border-white/10 text-white/50">
                <td className="py-1">{k.name ?? '—'}</td>
                <td className="text-white/40">{k.prefix}…</td>
                <td className="uppercase">{k.scope}</td>
                <td>revoked {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
