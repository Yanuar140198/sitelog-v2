'use client';
/**
 * Per-AHSP print sheet — Bina Marga style layout for a single ahsp_item.
 *
 * Pulls trpc.ahsp.detailBreakdown for the same data as the detail view,
 * but renders an A4-portrait, monochrome, print-optimized sheet and triggers
 * window.print() automatically once data has loaded.
 */
import { use, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import './print.css';

const CAT_TITLES = {
  tenaga: 'TENAGA KERJA',
  bahan: 'BAHAN',
  peralatan: 'PERALATAN',
} as const;
const CAT_LETTERS = { tenaga: 'A', bahan: 'B', peralatan: 'C' } as const;

export default function AhspPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const breakdown = trpc.ahsp.detailBreakdown.useQuery({ ahspItemId: id });
  const org = trpc.org.current.useQuery(undefined, { retry: false });

  // Auto-trigger the print dialog once data is in. Guard so we only fire once.
  const printed = useRef(false);
  useEffect(() => {
    if (!printed.current && breakdown.data) {
      printed.current = true;
      // Allow one paint so the print view renders with real numbers, not "Loading...".
      setTimeout(() => window.print(), 250);
    }
  }, [breakdown.data]);

  if (breakdown.isLoading) {
    return <div className="p-8 font-mono text-sm">Loading print view...</div>;
  }
  if (breakdown.error || !breakdown.data) {
    return <div className="p-8 font-mono text-sm text-red-700">Failed to load: {breakdown.error?.message}</div>;
  }

  const { item, sections, totals, inputs } = breakdown.data;
  const orgName = org.data?.name ?? '—';

  return (
    <div className="ahsp-print-root">
      <div className="ahsp-print">
        {/* On-screen toolbar (hidden in @media print) */}
        <div className="print-toolbar">
          <Link href={`/app/ahsp/${id}` as any}>← Back to AHSP detail</Link>
          <button onClick={() => window.print()}>PRINT / SAVE PDF</button>
        </div>

        {/* COVER */}
        <div className="cover">
          <div className="org">{orgName}</div>
          <div className="title">ANALISA HARGA SATUAN PEKERJAAN</div>
          <div className="subtitle">(Format Bina Marga)</div>
        </div>

        <dl className="meta">
          <dt>Kode AHSP</dt><dd>{item.kode}</dd>
          <dt>Jenis Pekerjaan</dt><dd>{item.jenis}</dd>
          {item.deskripsi && (<><dt>Deskripsi</dt><dd>{item.deskripsi}</dd></>)}
          <dt>Satuan Pekerjaan</dt><dd>{item.satuan}</dd>
          <dt>OHP (Overhead &amp; Profit)</dt><dd>{item.ohpPct}%</dd>
        </dl>

        {/* I. INPUT & ASUMSI */}
        {inputs.length > 0 && (
          <section>
            <h2>I. Input &amp; Asumsi</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>Kode</th>
                  <th style={{ width: '10%' }}>Variabel</th>
                  <th>Uraian</th>
                  <th style={{ width: '14%' }}>Nilai</th>
                  <th style={{ width: '10%' }}>Satuan</th>
                  <th style={{ width: '22%' }}>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((p, i) => (
                  <tr key={i}>
                    <td className="code">{p.kode}</td>
                    <td>{p.variable ?? '—'}</td>
                    <td>{p.uraian}</td>
                    <td className="num">{p.nilai !== null && p.nilai !== undefined ? p.nilai : '—'}</td>
                    <td>{p.satuan ?? '—'}</td>
                    <td>{p.sumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* II. PRODUKTIVITAS & KOEFISIEN — derived; we don't have the data on detailBreakdown,
            but the categories below cover A/B/C koefisien lines already. Skipping a separate
            section keeps the sheet compact. */}

        {/* III. ANALISA HARGA SATUAN */}
        <section>
          <h2>II. Analisa Harga Satuan</h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>No.</th>
                <th style={{ width: '10%' }}>Kode</th>
                <th>Komponen / Uraian</th>
                <th style={{ width: '8%' }}>Satuan</th>
                <th style={{ width: '12%' }}>Koefisien</th>
                <th style={{ width: '14%' }}>HSD (Rp)</th>
                <th style={{ width: '16%' }}>Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {(['tenaga', 'bahan', 'peralatan'] as const).map(cat => {
                const sec = sections[cat];
                return (
                  <CatGroup
                    key={cat}
                    letter={CAT_LETTERS[cat]}
                    title={CAT_TITLES[cat]}
                    rows={sec.rows}
                    subtotal={sec.total}
                  />
                );
              })}

              {/* D. SUBTOTAL A+B+C */}
              <tr className="grand-total">
                <td colSpan={2}>D</td>
                <td colSpan={4}>Jumlah Harga Tenaga Kerja, Bahan dan Peralatan (A + B + C)</td>
                <td className="num">{fmtIDR(totals.abcSubtotal)}</td>
              </tr>
              {/* E. OHP */}
              <tr className="subtotal">
                <td colSpan={2}>E</td>
                <td colSpan={3}>Overhead &amp; Profit</td>
                <td className="num">{item.ohpPct}%</td>
                <td className="num">{fmtIDR(totals.ohpAmount)}</td>
              </tr>
              {/* F. HARGA SATUAN */}
              <tr className="grand-total">
                <td colSpan={2}>F</td>
                <td colSpan={4}>
                  Harga Satuan Pekerjaan per <b>{item.satuan}</b> (D + E)
                </td>
                <td className="num">{fmtIDR(totals.unitRate)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div style={{ marginTop: '8mm', fontSize: '9pt', textAlign: 'right', color: '#444' }}>
          Generated by Sitelog · {new Date().toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
}

function CatGroup({ letter, title, rows, subtotal }: {
  letter: string;
  title: string;
  rows: { id: string; code: string; uraian: string; satuan: string | null; koefisien: number; formula?: string | null; hsd: number; subtotal: number }[];
  subtotal: number;
}) {
  return (
    <>
      <tr className="cat-header">
        <td colSpan={7}>{letter}. {title}</td>
      </tr>
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
            Tidak ada {title.toLowerCase()}.
          </td>
        </tr>
      ) : rows.map((r, i) => (
        <tr key={r.id}>
          <td className="num">{i + 1}</td>
          <td className="code">{r.code}</td>
          <td>{r.uraian}</td>
          <td>{r.satuan ?? '—'}</td>
          <td className="num">
            {r.koefisien.toLocaleString('id-ID', { maximumFractionDigits: 6 })}
            {r.formula ? <div className="formula">= {r.formula}</div> : null}
          </td>
          <td className="num">{fmtIDR(r.hsd)}</td>
          <td className="num">{fmtIDR(r.subtotal)}</td>
        </tr>
      ))}
      <tr className="subtotal">
        <td colSpan={6} className="num">Jumlah Harga {title} ({letter})</td>
        <td className="num">{fmtIDR(subtotal)}</td>
      </tr>
    </>
  );
}
