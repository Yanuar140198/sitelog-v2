'use client';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR, fmtNum } from '@/lib/utils';
import { X } from 'lucide-react';

export function AhspDetailDrawer({
  ahspItemId, projectId, onClose,
}: { ahspItemId: string | null; projectId: string; onClose: () => void }) {
  const detail = trpc.ahsp.detail.useQuery({ id: ahspItemId! }, { enabled: !!ahspItemId });

  if (!ahspItemId) return null;
  const d = detail.data;

  return (
    <div className="fixed inset-y-0 right-0 w-[680px] max-w-[95vw] bg-white border-l-2 border-[var(--color-ink)] shadow-[-8px_0_0_var(--color-brand)] z-50 flex flex-col">
      <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
        <div>
          <div className="font-mono text-[9px] tracking-[0.2em] text-[var(--color-brand)] font-bold">DETAIL ANALISA</div>
          <h2 className="font-display text-xl font-bold mt-1">{d?.item.kode}</h2>
          <div className="font-mono text-xs text-neutral-300 mt-1">{d?.item.jenis} · per {d?.item.satuan}</div>
        </div>
        <button onClick={onClose} className="text-white p-1 hover:bg-white/20"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {!d ? <div className="text-neutral-500 font-mono text-sm">Loading...</div> : (
          <>
            <Section title="I · INPUT & ASUMSI">
              <Table headers={['KODE', 'URAIAN', 'NILAI', 'SAT', 'SUMBER']} rows={d.inputs.map(x => [
                <strong key="k">{x.kode}</strong>, x.uraian, fmtNum(Number(x.nilai)), x.satuan ?? '—', <span key="s" className="text-neutral-500 text-[10px]">{x.sumber ?? '—'}</span>,
              ])} />
            </Section>
            <Section title="II · PRODUKTIVITAS & KOEFISIEN">
              <Table headers={['KODE', 'URAIAN', 'NILAI', 'SAT', 'FORMULA']} rows={d.koefisien.map(x => [
                <strong key="k">{x.kode}</strong>, x.uraian ?? x.variable ?? '—', fmtNum(Number(x.nilai), 6), x.satuan ?? '—', <span key="f" className="text-neutral-500 text-[10px]">{x.formula ?? '—'}</span>,
              ])} />
            </Section>
            <Section title="III · ANALISA HARGA SATUAN">
              <ResourceBlock label="A · TENAGA" lines={d.resources.filter(r => r.category === 'tenaga')} />
              <ResourceBlock label="B · BAHAN" lines={d.resources.filter(r => r.category === 'bahan')} />
              <ResourceBlock label="C · PERALATAN" lines={d.resources.filter(r => r.category === 'peralatan')} />
            </Section>
            <div className="bg-[var(--color-ink)] text-white p-4 font-mono text-sm">
              <div className="flex justify-between"><span>D · Jumlah (A+B+C)</span><span>{fmtIDR(sumLines(d.resources))}</span></div>
              <div className="flex justify-between"><span>E · OHP ({d.item.ohpPct}%)</span><span>{fmtIDR(sumLines(d.resources) * Number(d.item.ohpPct) / 100)}</span></div>
              <div className="flex justify-between text-lg font-bold text-[var(--color-brand)] border-t border-white/30 mt-3 pt-3">
                <span>F · HARGA SATUAN per {d.item.satuan}</span>
                <span>{fmtIDR(sumLines(d.resources) * (1 + Number(d.item.ohpPct) / 100))}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-neutral-100 border-l-4 border-[var(--color-brand)] px-3 py-2 font-mono text-xs font-bold tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <table className="w-full font-mono text-xs border-collapse">
      <thead><tr>{headers.map(h => <th key={h} className="text-left px-2 py-1.5 text-[9px] tracking-wider text-neutral-500 border-b-2 border-[var(--color-ink)]">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 border-b border-neutral-100">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

function ResourceBlock({ label, lines }: { label: string; lines: any[] }) {
  const sub = lines.reduce((a, l) => a + Number(l.koefisien) * Number(l.hsd), 0);
  if (!lines.length) return (
    <div className="mb-4">
      <span className="inline-block bg-[var(--color-brand)] text-white px-2 py-1 font-mono text-[10px] font-bold mb-2">{label}</span>
      <div className="font-mono text-[11px] text-neutral-500 py-2">Tidak ada item</div>
    </div>
  );
  return (
    <div className="mb-4">
      <span className="inline-block bg-[var(--color-brand)] text-white px-2 py-1 font-mono text-[10px] font-bold mb-2">{label}</span>
      <table className="w-full font-mono text-xs border-collapse">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-2 py-1.5">KODE</th>
            <th className="text-left px-2 py-1.5">URAIAN</th>
            <th className="text-right px-2 py-1.5">KOEF</th>
            <th className="text-left px-2 py-1.5">SAT</th>
            <th className="text-right px-2 py-1.5">HSD</th>
            <th className="text-right px-2 py-1.5">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id} className="border-b border-neutral-100">
              <td className="px-2 py-1.5"><strong>{l.resourceCode}</strong></td>
              <td className="px-2 py-1.5">{l.uraian}</td>
              <td className="px-2 py-1.5 text-right">{fmtNum(Number(l.koefisien), 6)}</td>
              <td className="px-2 py-1.5 text-neutral-500">{l.satuan ?? '—'}</td>
              <td className="px-2 py-1.5 text-right">{fmtIDR(Number(l.hsd))}</td>
              <td className="px-2 py-1.5 text-right font-bold">{fmtIDR(Number(l.koefisien) * Number(l.hsd))}</td>
            </tr>
          ))}
          <tr className="bg-neutral-100 font-bold">
            <td colSpan={5} className="px-2 py-1.5 text-right">JUMLAH</td>
            <td className="px-2 py-1.5 text-right text-[var(--color-brand)]">{fmtIDR(sub)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function sumLines(lines: any[]) {
  return lines.reduce((a, l) => a + Number(l.koefisien) * Number(l.hsd), 0);
}
