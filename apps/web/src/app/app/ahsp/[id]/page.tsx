'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { ArrowLeft, X } from 'lucide-react';

const CATS = ['tenaga', 'bahan', 'peralatan'] as const;
const CAT_META: Record<typeof CATS[number], { letter: string; title: string }> = {
  tenaga:    { letter: 'A', title: 'TENAGA KERJA' },
  bahan:     { letter: 'B', title: 'BAHAN' },
  peralatan: { letter: 'C', title: 'PERALATAN' },
};

export default function AhspDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // detailBreakdown drives the read-only breakdown view (header, sections, totals, inputs).
  const breakdown = trpc.ahsp.detailBreakdown.useQuery({ ahspItemId: id });
  // detail() still drives inline edits (resources mutation flow) — org-owned items only.
  const detail = trpc.ahsp.detail.useQuery({ id });
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.ahsp.detail.invalidate({ id });
    utils.ahsp.detailBreakdown.invalidate({ ahspItemId: id });
  };
  const update = trpc.ahsp.update.useMutation({ onSuccess: invalidate });
  const resUpsert = trpc.ahsp.resourceUpsert.useMutation({ onSuccess: invalidate });
  const resDelete = trpc.ahsp.resourceDelete.useMutation({ onSuccess: invalidate });

  if (!breakdown.data || !detail.data) {
    return <div className="p-8 font-mono text-sm">Loading...</div>;
  }
  const { item, sections, totals, inputs } = breakdown.data;
  const { resources, item: rawItem } = detail.data;
  // Inline editing is only meaningful for org-owned items (catalog items are read-only).
  const isEditable = Boolean(rawItem.organizationId);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      {/* HEADER CARD */}
      <div className="border-2 border-[var(--color-ink)] bg-white p-5">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">
          {item.kode}
          {item.deskripsi ? <span className="ml-3 text-neutral-400">· {item.deskripsi}</span> : null}
        </div>
        <h1 className="font-display text-3xl font-bold mt-1">{item.jenis}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="font-mono text-xs px-2 py-1 bg-[var(--color-ink)] text-white tracking-wider">
            SATUAN · {item.satuan}
          </span>
          <span className="font-mono text-xs px-2 py-1 border border-[var(--color-ink)] tracking-wider">
            OHP · {item.ohpPct}%
          </span>
        </div>
        {isEditable && (
          <div className="grid grid-cols-4 gap-3 mt-5">
            <FieldInline label="Kode" defaultValue={item.kode} onSave={v => update.mutate({ id, data: { kode: v } })} />
            <FieldInline label="Section" defaultValue={rawItem.section ?? ''} onSave={v => update.mutate({ id, data: { section: v } })} />
            <FieldInline label="Satuan" defaultValue={item.satuan} onSave={v => update.mutate({ id, data: { satuan: v } })} />
            <FieldInline label="OHP %" type="number" defaultValue={String(item.ohpPct)} onSave={v => update.mutate({ id, data: { ohpPct: Number(v) } })} />
          </div>
        )}
      </div>

      {/* INPUTS / PARAMETERS */}
      {inputs.length > 0 && (
        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">
            INPUTS · PRODUCTIVITY PARAMETERS
          </div>
          <table className="w-full font-mono text-xs">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-3 py-1.5 w-24">KODE</th>
                <th className="text-left px-3 py-1.5 w-32">VARIABEL</th>
                <th className="text-left px-3 py-1.5">URAIAN</th>
                <th className="text-right px-3 py-1.5 w-28">NILAI</th>
                <th className="text-left px-3 py-1.5 w-20">SAT</th>
                <th className="text-left px-3 py-1.5 w-40">SUMBER</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((p, idx) => (
                <tr key={idx} className="border-b border-neutral-100">
                  <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{p.kode}</td>
                  <td className="px-3 py-1.5">{p.variable ?? '—'}</td>
                  <td className="px-3 py-1.5">{p.uraian}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.nilai ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.satuan ?? '—'}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.sumber ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTIONS A / B / C */}
      {CATS.map(cat => (
        <CategoryBlock
          key={cat}
          cat={cat}
          ahspItemId={id}
          letter={CAT_META[cat].letter}
          title={CAT_META[cat].title}
          rows={sections[cat].rows}
          subtotal={sections[cat].total}
          editable={isEditable}
          // For inline edits we hand raw drizzle rows (with id) from detail.resources.
          editableLines={resources.filter(r => r.category === cat)}
          onUpsert={resUpsert.mutate as any}
          onDelete={(rid: string) => resDelete.mutate({ id: rid })}
        />
      ))}

      {/* SUMMARY CARD */}
      <div className="border-2 border-[var(--color-ink)] bg-[var(--color-ink)] text-white p-6 shadow-[8px_8px_0_var(--color-brand)]">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mb-3">RINGKASAN HARGA SATUAN</div>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm">
          <SumRow label="A · TENAGA KERJA" value={fmtIDR(sections.tenaga.total)} />
          <SumRow label="B · BAHAN" value={fmtIDR(sections.bahan.total)} />
          <SumRow label="C · PERALATAN" value={fmtIDR(sections.peralatan.total)} />
          <SumRow label="JUMLAH (A + B + C)" value={fmtIDR(totals.abcSubtotal)} bold />
          <SumRow label={`D · OHP (${item.ohpPct}%)`} value={fmtIDR(totals.ohpAmount)} />
        </div>
        <div className="mt-5 pt-5 border-t border-white/30 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-white/60">HARGA SATUAN PER {item.satuan}</div>
            <div className="font-mono text-xs text-white/60 mt-1">A + B + C + D</div>
          </div>
          <div className="text-4xl font-display font-bold text-[var(--color-brand)] tabular-nums">
            {fmtIDR(totals.unitRate)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <div className={bold ? 'font-bold' : 'text-white/80'}>{label}</div>
      <div className={`text-right tabular-nums ${bold ? 'font-bold' : 'text-white/80'}`}>{value}</div>
    </>
  );
}

function FieldInline({ label, defaultValue, onSave, type = 'text' }: { label: string; defaultValue: string; onSave: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} defaultValue={defaultValue} onBlur={e => onSave(e.target.value)} />
    </div>
  );
}

function CategoryBlock({
  cat, ahspItemId, letter, title, rows, subtotal, editable, editableLines, onUpsert, onDelete,
}: {
  cat: typeof CATS[number];
  ahspItemId: string;
  letter: string;
  title: string;
  rows: { id: string; code: string; uraian: string; satuan: string | null; koefisien: number; hsd: number; subtotal: number }[];
  subtotal: number;
  editable: boolean;
  editableLines: any[];
  onUpsert: (data: any) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ resourceCode: '', uraian: '', koefisien: 0, satuan: '', hsd: 0 });
  const editableMap = new Map(editableLines.map(l => [l.id, l]));

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
        <span>
          <span className="text-[var(--color-brand)]">{letter}</span> · {title}
        </span>
        {editable && (
          <button onClick={() => setAdding(true)} className="text-[var(--color-brand)] hover:text-white">+ ADD LINE</button>
        )}
      </div>
      <table className="w-full font-mono text-xs">
        <thead className="bg-neutral-100">
          <tr>
            <th className="text-left px-3 py-1.5 w-24">KODE</th>
            <th className="text-left px-3 py-1.5">URAIAN</th>
            <th className="text-left px-3 py-1.5 w-20">SATUAN</th>
            <th className="text-right px-3 py-1.5 w-28">KOEFISIEN</th>
            <th className="text-right px-3 py-1.5 w-32">HSD (Rp)</th>
            <th className="text-right px-3 py-1.5 w-36">SUBTOTAL Rp</th>
            {editable && <th className="w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !adding && (
            <tr>
              <td colSpan={editable ? 7 : 6} className="px-3 py-6 text-center text-neutral-400">No lines.</td>
            </tr>
          )}
          {rows.map(l => {
            const raw = editableMap.get(l.id);
            if (editable && raw) {
              return (
                <tr key={l.id} className="border-b border-neutral-100">
                  <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" defaultValue={raw.resourceCode} onBlur={e => onUpsert({ id: raw.id, ahspItemId, category: cat, ordinal: raw.ordinal, uraian: raw.uraian, satuan: raw.satuan, koefisien: Number(raw.koefisien), hsd: Number(raw.hsd), resourceCode: e.target.value })} /></td>
                  <td className="px-2 py-1"><Input className="text-xs py-1" defaultValue={raw.uraian} onBlur={e => onUpsert({ id: raw.id, ahspItemId, category: cat, ordinal: raw.ordinal, resourceCode: raw.resourceCode, satuan: raw.satuan, koefisien: Number(raw.koefisien), hsd: Number(raw.hsd), uraian: e.target.value })} /></td>
                  <td className="px-2 py-1"><Input className="text-xs py-1" defaultValue={raw.satuan ?? ''} onBlur={e => onUpsert({ id: raw.id, ahspItemId, category: cat, ordinal: raw.ordinal, resourceCode: raw.resourceCode, uraian: raw.uraian, koefisien: Number(raw.koefisien), hsd: Number(raw.hsd), satuan: e.target.value })} /></td>
                  <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" defaultValue={raw.koefisien} onBlur={e => onUpsert({ id: raw.id, ahspItemId, category: cat, ordinal: raw.ordinal, resourceCode: raw.resourceCode, uraian: raw.uraian, satuan: raw.satuan, hsd: Number(raw.hsd), koefisien: Number(e.target.value) })} /></td>
                  <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" defaultValue={raw.hsd} onBlur={e => onUpsert({ id: raw.id, ahspItemId, category: cat, ordinal: raw.ordinal, resourceCode: raw.resourceCode, uraian: raw.uraian, satuan: raw.satuan, koefisien: Number(raw.koefisien), hsd: Number(e.target.value) })} /></td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(l.subtotal)}</td>
                  <td className="px-2 py-1"><button onClick={() => onDelete(l.id)} className="text-red-600 p-1 hover:bg-red-50"><X size={12} /></button></td>
                </tr>
              );
            }
            return (
              <tr key={l.id} className="border-b border-neutral-100">
                <td className="px-3 py-1.5 font-bold text-[var(--color-brand)]">{l.code}</td>
                <td className="px-3 py-1.5">{l.uraian}</td>
                <td className="px-3 py-1.5 text-neutral-500">{l.satuan ?? '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.koefisien.toLocaleString('id-ID', { maximumFractionDigits: 6 })}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtIDR(l.hsd)}</td>
                <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(l.subtotal)}</td>
              </tr>
            );
          })}
          {editable && adding && (
            <tr className="bg-orange-50">
              <td className="px-2 py-1"><Input className="text-xs py-1 font-mono" placeholder="L01" value={n.resourceCode} onChange={e => setN({ ...n, resourceCode: e.target.value })} /></td>
              <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Pekerja" value={n.uraian} onChange={e => setN({ ...n, uraian: e.target.value })} /></td>
              <td className="px-2 py-1"><Input className="text-xs py-1" placeholder="Jam" value={n.satuan} onChange={e => setN({ ...n, satuan: e.target.value })} /></td>
              <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={n.koefisien} onChange={e => setN({ ...n, koefisien: Number(e.target.value) })} /></td>
              <td className="px-2 py-1"><Input className="text-xs py-1 text-right tabular-nums" type="number" step="any" value={n.hsd} onChange={e => setN({ ...n, hsd: Number(e.target.value) })} /></td>
              <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtIDR(n.koefisien * n.hsd)}</td>
              <td className="px-2 py-1">
                <button onClick={() => { onUpsert({ ahspItemId, category: cat, ordinal: rows.length, ...n }); setAdding(false); setN({ resourceCode: '', uraian: '', koefisien: 0, satuan: '', hsd: 0 }); }} className="text-[var(--color-brand)] p-1">✓</button>
              </td>
            </tr>
          )}
          <tr className="bg-neutral-100">
            <td colSpan={editable ? 5 : 5} className="px-3 py-2 text-right font-bold">
              SUBTOTAL {letter} · {title}
            </td>
            <td className="px-3 py-2 text-right font-bold text-[var(--color-brand)] tabular-nums text-sm">{fmtIDR(subtotal)}</td>
            {editable && <td></td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
