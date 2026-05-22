'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SecurityPage() {
  // Current user info via better-auth session — for now show settings hint
  // Active sessions list via auth.api would go here when wired
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
          <p className="font-mono text-[10px] text-neutral-500 mt-2">
            Endpoint: <code>POST /api/auth/two-factor/enable</code> (Better Auth)
          </p>
        </div>
      </section>

      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          ACTIVE SESSIONS
        </h2>
        <div className="p-4 space-y-3">
          <p className="font-mono text-xs text-neutral-700 leading-relaxed">
            View + revoke active sessions across devices. Coming soon — wire via
            <code className="bg-neutral-200 px-1 mx-1">auth.api.listSessions()</code>.
          </p>
        </div>
      </section>

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
