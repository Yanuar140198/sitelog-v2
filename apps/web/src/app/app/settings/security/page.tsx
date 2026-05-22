'use client';
import { useState } from 'react';
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

function TwoFactorSection() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const status = trpc.session.twoFactorStatus.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const enabled = status.data?.enabled === true;

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(apiUrl + '/api/auth/two-factor/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Enable failed (${res.status})`);
      setMsg({ ok: true, text: 'Scan QR di authenticator app, lalu verify via halaman login.' });
      setShowPwd(false); setPassword('');
      utils.session.twoFactorStatus.invalidate();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(apiUrl + '/api/auth/two-factor/disable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Disable failed (${res.status})`);
      setMsg({ ok: true, text: '2FA dinonaktifkan.' });
      setShowPwd(false); setPassword('');
      utils.session.twoFactorStatus.invalidate();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-[var(--color-ink)]">
      <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3 flex justify-between items-center">
        <span>TWO-FACTOR AUTHENTICATION</span>
        {enabled && <span className="bg-green-500 text-white px-2 py-0.5 text-[10px] font-bold">✓ 2FA ENABLED</span>}
      </h2>
      <div className="p-4 space-y-3">
        <p className="font-mono text-xs text-neutral-700 leading-relaxed">
          {enabled
            ? 'Akun Anda dilindungi TOTP. Login butuh kode 6-digit dari authenticator app.'
            : 'Tambah lapisan keamanan ekstra: TOTP (Google Authenticator / 1Password / Authy). Setelah aktif, login butuh kode 6-digit dari aplikasi authenticator Anda.'}
        </p>

        {status.isLoading && <p className="font-mono text-xs text-neutral-500">Loading status…</p>}

        {!status.isLoading && !showPwd && (
          <button
            onClick={() => setShowPwd(true)}
            className={
              enabled
                ? 'inline-block bg-red-600 text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-red-800'
                : 'inline-block bg-[var(--color-brand)] text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)]'
            }
          >
            {enabled ? 'DISABLE 2FA' : 'ENABLE 2FA →'}
          </button>
        )}

        {showPwd && (
          <div className="space-y-2">
            <label className="block font-mono text-[10px] tracking-wider text-neutral-600">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                disabled={busy || !password}
                onClick={enabled ? disable : enable}
                className="bg-[var(--color-brand)] text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)] disabled:opacity-50"
              >
                {busy ? 'WORKING…' : enabled ? 'CONFIRM DISABLE' : 'CONFIRM ENABLE'}
              </button>
              <button
                disabled={busy}
                onClick={() => { setShowPwd(false); setPassword(''); setMsg(null); }}
                className="border-2 border-[var(--color-ink)] px-6 py-2 font-mono text-xs tracking-wider hover:bg-neutral-100"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p className={`font-mono text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}

function ChangePasswordSection() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) { setMsg({ ok: false, text: 'Password baru minimal 8 karakter.' }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: 'Konfirmasi password tidak cocok.' }); return; }
    setBusy(true);
    try {
      const res = await fetch(apiUrl + '/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Change failed (${res.status})`);
      setMsg({ ok: true, text: 'Password berhasil diubah. Sesi lain telah di-logout.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-[var(--color-ink)]">
      <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
        CHANGE PASSWORD
      </h2>
      <form className="p-4 space-y-3" onSubmit={submit}>
        <div>
          <label className="block font-mono text-[10px] tracking-wider text-neutral-600 mb-1">
            CURRENT PASSWORD
          </label>
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            className="w-full border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] tracking-wider text-neutral-600 mb-1">
            NEW PASSWORD (min 8)
          </label>
          <input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={8}
            className="w-full border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] tracking-wider text-neutral-600 mb-1">
            CONFIRM NEW PASSWORD
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            className="w-full border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-[var(--color-brand)] text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)] disabled:opacity-50"
        >
          {busy ? 'CHANGING…' : 'CHANGE PASSWORD →'}
        </button>
        {msg && (
          <p className={`font-mono text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
      </form>
    </section>
  );
}

export default function SecurityPage() {
  const me = trpc.org.current.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6 max-w-3xl">
      <TwoFactorSection />

      <ChangePasswordSection />

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
