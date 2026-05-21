'use client';
import { trpc } from '@sitelog/api-client/react';
import { useState } from 'react';

export default function PrivacyPage() {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requestDeletion = trpc.gdpr.requestDeletion.useMutation({
    onSuccess: (r) => { setSuccess(r.message); setError(null); },
    onError: (e) => { setError(e.message); setSuccess(null); },
  });

  async function downloadExport() {
    try {
      // Lazy-call via tRPC client to get JSON
      const res = await fetch('/api/trpc/gdpr.exportMyData?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D');
      const body = await res.json();
      const data = body[0]?.result?.data?.json;
      if (!data) throw new Error('No data returned');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sitelog-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="border-2 border-[var(--color-ink)]">
        <h2 className="font-mono text-xs tracking-wider bg-[var(--color-ink)] text-white px-4 py-3">
          EXPORT YOUR DATA
        </h2>
        <div className="p-4 space-y-3">
          <p className="font-mono text-xs text-neutral-700 leading-relaxed">
            Unduh JSON file berisi semua data personal Anda di Sitelog: profil, membership,
            daily entries, activities, audit log, projects yang dibuat. <strong>GDPR Article 15</strong>.
          </p>
          <button
            onClick={downloadExport}
            className="bg-[var(--color-ink)] text-white px-6 py-2 font-mono text-xs tracking-wider hover:bg-[var(--color-brand)]"
          >
            ↓ DOWNLOAD MY DATA (JSON)
          </button>
        </div>
      </section>

      <section className="border-2 border-red-600">
        <h2 className="font-mono text-xs tracking-wider bg-red-600 text-white px-4 py-3">
          DELETE ACCOUNT (IRREVERSIBLE)
        </h2>
        <div className="p-4 space-y-4">
          <p className="font-mono text-xs text-neutral-700 leading-relaxed">
            Permintaan deletion akan meng-anonimkan akun segera + hard delete 30 hari kemudian.
            <strong> GDPR Article 17</strong>. Tidak bisa di-undo setelah 30 hari.
          </p>
          <p className="font-mono text-xs text-neutral-700">
            Ketik <code className="bg-neutral-200 px-2 py-0.5">DELETE MY ACCOUNT</code> untuk konfirmasi:
          </p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="w-full border-2 border-neutral-300 px-3 py-2 font-mono text-sm"
            placeholder="DELETE MY ACCOUNT"
          />
          <button
            disabled={confirmText !== 'DELETE MY ACCOUNT' || requestDeletion.isPending}
            onClick={() => requestDeletion.mutate({ confirmation: 'DELETE MY ACCOUNT' })}
            className="bg-red-600 text-white px-6 py-2 font-mono text-xs tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-700"
          >
            {requestDeletion.isPending ? 'PROCESSING…' : 'REQUEST DELETION'}
          </button>
          {success && (
            <div className="bg-green-100 border-2 border-green-600 p-3 font-mono text-xs text-green-900">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border-2 border-red-600 p-3 font-mono text-xs text-red-900">
              ✗ {error}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
