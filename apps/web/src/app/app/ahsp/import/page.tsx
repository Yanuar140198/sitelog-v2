'use client';
/**
 * Bulk-import AHSP catalog from a Bina Marga-style xlsx workbook.
 *
 * Backed by trpc.ahsp.importFromXlsxBase64. Expects sheets:
 *   - COVER / INPUT — informational only (not parsed here)
 *   - PARAMETER     — HSD resource catalog (split A/B/C)
 *   - CALCULATION   — N AHSP blocks; each block starts with "Satuan:" cell in column I
 *
 * Reference workbook: D:\FORM\AHSP_NEW_4.xlsx
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

type Scope = 'org' | 'global';

export default function AhspImportPage() {
  const me = trpc.org.current.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const importMut = trpc.ahsp.importFromXlsxBase64.useMutation({
    onSuccess: () => {
      // Refresh the catalog so the newly-imported items show up immediately.
      utils.ahsp.catalog.invalidate();
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [base64, setBase64] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('org');
  const [dryRun, setDryRun] = useState(true);

  // Only owner role may upsert into the global catalog (organizationId NULL).
  const isOwner = me.data?.role === 'owner';

  async function onFile(f: File) {
    setFilename(f.name);
    const buf = await f.arrayBuffer();
    // Avoid String.fromCharCode(...) on giant arrays (spread blows the stack at ~64k).
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    setBase64(btoa(binary));
    importMut.reset();
  }

  function runImport() {
    if (!base64) return;
    importMut.mutate({
      xlsxBase64: base64,
      orgScope: scope === 'org',
      dryRun,
    });
  }

  const result = importMut.data;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">IMPORT</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Import AHSP from Excel</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">
          Bulk-upsert resources + AHSP items from a Bina Marga-style workbook.
        </p>
      </div>

      {/* Instructions card */}
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">
          EXPECTED STRUCTURE
        </div>
        <div className="p-4 font-mono text-xs space-y-2 text-neutral-700">
          <p>
            Upload an <code>.xlsx</code> workbook with sheets named
            {' '}<b>COVER</b>, <b>INPUT</b>, <b>PARAMETER</b>, <b>CALCULATION</b>.
            Reference: <code>AHSP_NEW_4.xlsx</code>.
          </p>
          <p>
            Each AHSP block in <b>CALCULATION</b> must start with a <code>Satuan:</code> cell in column I,
            followed by sections <code>I. INPUT &amp; ASUMSI</code>, <code>II. PRODUKTIVITAS &amp; KOEFISIEN</code>,
            and <code>III. ANALISA HARGA SATUAN</code> (with A/B/C sub-tables).
          </p>
          <p>
            <b>PARAMETER</b> rows feed <code>resource_master</code>; <b>CALCULATION</b> rows feed
            <code> ahsp_item</code> + <code>ahsp_input</code> + <code>ahsp_koefisien</code> + <code>ahsp_resource</code>.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-5 space-y-5">
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-neutral-500 mb-2">SCOPE</div>
          <label className="flex items-start gap-2 font-mono text-xs mb-2 cursor-pointer">
            <input
              type="radio"
              name="scope"
              checked={scope === 'org'}
              onChange={() => setScope('org')}
              className="mt-0.5"
            />
            <span>
              <b>ORG-SCOPED</b> · upsert into your organization's private catalog.
            </span>
          </label>
          <label className={`flex items-start gap-2 font-mono text-xs cursor-pointer ${!isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="scope"
              disabled={!isOwner}
              checked={scope === 'global'}
              onChange={() => setScope('global')}
              className="mt-0.5"
            />
            <span>
              <b>GLOBAL</b> · upsert into the shared catalog (visible to all organizations).
              {!isOwner && <span className="block text-neutral-500 mt-1">Owner role required.</span>}
            </span>
          </label>
        </div>

        <label className="flex items-start gap-2 font-mono text-xs cursor-pointer">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="mt-0.5" />
          <span>
            <b>DRY RUN</b> · parse + validate only, no writes. Recommended for the first pass.
          </span>
        </label>

        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-neutral-500 mb-2">FILE</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
          />
          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={() => inputRef.current?.click()}>
              <Upload size={14} /> SELECT XLSX
            </Button>
            {filename && (
              <span className="inline-flex items-center gap-2 font-mono text-xs text-neutral-700">
                <FileSpreadsheet size={14} /> {filename}
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-200 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={runImport}
            disabled={!base64 || importMut.isPending}
          >
            {importMut.isPending ? 'PROCESSING...' : dryRun ? 'DRY-RUN PARSE' : 'IMPORT'}
          </Button>
          {dryRun && (
            <span className="font-mono text-xs text-neutral-500">
              No writes will happen — counts only.
            </span>
          )}
        </div>
      </div>

      {/* Result panel */}
      {importMut.error && (
        <div className="border-2 border-red-600 bg-red-50 p-4 font-mono text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Import failed.</b>
            <div className="mt-1">{importMut.error.message}</div>
          </div>
        </div>
      )}

      {result && (
        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[var(--color-brand)]" />
            {result.dryRun ? 'DRY-RUN RESULT' : 'IMPORT COMPLETE'}
          </div>
          <div className="p-5 font-mono text-xs space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Resources (PARAMETER)" value={result.resourcesImported} />
              <Stat label="AHSP items (CALCULATION)" value={result.itemsImported} />
            </div>

            {result.errors.length > 0 && (
              <div>
                <div className="text-red-700 font-bold mb-1">
                  {result.errors.length} warning(s) / error(s):
                </div>
                <ul className="bg-red-50 border border-red-300 p-3 space-y-1 max-h-64 overflow-auto">
                  {result.errors.map((e, i) => <li key={i} className="text-red-700">· {e}</li>)}
                </ul>
              </div>
            )}

            {!result.dryRun && (
              <Link
                href="/app/ahsp"
                className="inline-block mt-2 font-mono text-xs text-[var(--color-brand)] hover:underline"
              >
                → View imported items in catalog
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--color-ink)] p-3">
      <div className="text-neutral-500 tracking-wider">{label}</div>
      <div className="text-3xl font-display font-bold text-[var(--color-brand)] tabular-nums mt-1">
        {value.toLocaleString('id-ID')}
      </div>
    </div>
  );
}
