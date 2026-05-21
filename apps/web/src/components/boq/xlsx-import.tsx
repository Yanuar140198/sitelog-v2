'use client';
import { useState, useRef } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileSpreadsheet } from 'lucide-react';

export function XlsxImport({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const importMut = trpc.boq.importXlsx.useMutation({
    onSuccess: (r) => {
      alert(`Imported ${r.imported} · skipped ${r.skipped} · missing AHSP ${r.missing}`);
      utils.boq.list.invalidate({ projectId });
      onClose();
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [filename, setFilename] = useState('');

  async function onFile(f: File) {
    setFilename(f.name);
    const buf = await f.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    importMut.mutate({ projectId, base64, replaceExisting });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-md p-6 shadow-[8px_8px_0_var(--color-brand)]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">IMPORT</div>
            <h2 className="font-display text-2xl font-bold mt-1">Upload XLSX</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100"><X size={18} /></button>
        </div>

        <p className="font-mono text-xs text-neutral-600 mb-4">
          Expected columns: <code>kode</code>, <code>quantity</code>, <code>rate</code> (optional), <code>note</code> (optional).
        </p>

        <label className="flex items-center gap-2 font-mono text-xs mb-4">
          <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
          Replace existing BOQ items
        </label>

        <input ref={inputRef} type="file" accept=".xlsx" hidden
          onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />

        <Button onClick={() => inputRef.current?.click()} variant="primary" disabled={importMut.isPending} className="w-full">
          {importMut.isPending ? 'IMPORTING...' : (<><Upload size={14} /> SELECT XLSX</>)}
        </Button>

        {filename && (
          <div className="mt-3 flex items-center gap-2 font-mono text-xs text-neutral-600">
            <FileSpreadsheet size={14} /> {filename}
          </div>
        )}

        {importMut.error && (
          <div className="mt-3 bg-red-50 border border-red-600 text-red-700 px-3 py-2 text-xs font-mono">{importMut.error.message}</div>
        )}
      </div>
    </div>
  );
}
