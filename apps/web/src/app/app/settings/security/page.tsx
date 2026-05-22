'use client';
import { trpc } from '@sitelog/api-client/react';

function ActiveSessions() {
  const list = trpc.session.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const revoke = trpc.session.revoke.useMutation({ onSuccess: () => utils.session.list.invalidate() });
  const revokeOthers = trpc.session.revokeOthers.useMutation({ onSuccess: () => utils.session.list.invalidate() });

  return (
    <section className="border-2 border-[var(--color-ink)]">
      <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3 flex justify-between">
        <span>ACTIVE SESSIONS</span>
        {(list.data?.length ?? 0) > 1 && (
          <button
            onClick={() => revokeOthers.mutate()}
            className="text-[10px] underline hover:text-[var(--color-brand)]"
          >
            REVOKE ALL OTHERS
          </button>
        )}
      </h2>
      <div className="p-4 space-y-2 font-mono text-xs">
        {list.isLoading && <p className="text-neutral-500">Loading…</p>}
        {list.error && <p className="text-red-600">{list.error.message}</p>}
        {list.data?.map(s => (
          <div key={s.id} className="flex justify-between items-center py-2 border-b border-neutral-200 last:border-0">
            <div>
              <div>
                <strong>{(s.userAgent ?? 'Unknown agent').slice(0, 60)}</strong>
                {s.current && <span className="ml-2 bg-green-600 text-white px-2 py-0.5 text-[10px] font-bold">CURRENT</span>}
              </div>
              <div className="text-neutral-500 text-[10px] mt-1">
                {s.ipAddress ?? '—'} · created {new Date(s.createdAt).toLocaleString()} · expires {new Date(s.expiresAt).toLocaleDateString()}
              </div>
            </div>
            {!s.current && (
              <button
                onClick={() => revoke.mutate({ id: s.id })}
                className="text-red-600 hover:text-red-800 text-xs px-3 py-1 border border-red-300"
              >
                REVOKE
              </button>
            )}
          </div>
        ))}
        {list.data?.length === 0 && <p className="text-neutral-500">No active sessions.</p>}
      </div>
    </section>
  );
}

export default function SecurityPage() {
  const me = trpc.org.current.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          TWO-FACTOR AUTHENTICATION
        </h2>
        <div className="p-4 space-y-3">
          <p className="font-mono text-xs text-neutral-700 leading-relaxed">
            Tambah lapisan keamanan ekstra: TOTP (Google Authenticator / 1Password / Authy).
            Setelah aktif, login butuh kode 6-digit dari aplikasi authenticator Anda.
          </p>
          <a
            href={(process.env.NEXT_PUBLIC_API_URL ?? '') + '/api/auth/two-factor/enable'}
            className="inline-block bg-[var(--color-brand)] text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)]"
          >
            ENABLE 2FA →
          </a>
        </div>
      </section>

      <ActiveSessions />

      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          ORG INFO
        </h2>
        <div className="p-4 font-mono text-xs space-y-1">
          {me.data ? (
            <>
              <div><span className="text-neutral-500">Name:</span> {me.data.name}</div>
              <div><span className="text-neutral-500">Slug:</span> {me.data.slug}</div>
              <div><span className="text-neutral-500">Plan:</span> {me.data.plan}</div>
            </>
          ) : (
            <div className="text-neutral-500">Loading…</div>
          )}
        </div>
      </section>
    </div>
  );
}
