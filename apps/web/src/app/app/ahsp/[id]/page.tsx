'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { ArrowLeft, Plus, X } from 'lucide-react';

const CATS = ['tenaga', 'bahan', 'peralatan'] as const;

export default function AhspEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = trpc.ahsp.detail.useQuery({ id });
  const utils = trpc.useUtils();
  const update = trpc.ahsp.update.useMutation({ onSuccess: () => utils.ahsp.detail.invalidate({ id }) });
  const resUpsert = trpc.ahsp.resourceUpsert.useMutation({ onSuccess: () => utils.ahsp.detail.invalidate({ id }) });
  const resDelete = trpc.ahsp.resourceDelete.useMutation({ onSuccess: () => utils.ahsp.detail.invalidate({ id }) });

  if (!detail.data) return <div className="p-8 font-mono text-sm">Loading...</div>;
  const { item, resources } = detail.data;
  const ohp = Number(item.ohpPct) || 0;
  const totals = {
    tenaga: resources.filter(r => r.category === 'tenaga').reduce((a, r) => a + Number(r.koefisien) * Number(r.hsd), 0),
    bahan: resources.filter(r => r.category === 'bahan').reduce((a, r) => a + Number(r.koefisien) * Number(r.hsd), 0),
    peralatan: resources.filter(r => r.category === 'peralatan').reduce((a, r) => a + Number(r.koefisien) * Number(r.hsd), 0),
  };
  const abc = totals.tenaga + totals.bahan + totals.peralatan;
  const unitRate = abc * (1 + ohp / 100);

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div className="border-2 border-[var(--color-ink)] bg-white p-5">
        <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">{item.kode}</div>
        <h1 className="font-display text-3xl font-bold mt-1">{item.jenis}</h1>
        <div className="grid grid-cols-4 gap-3 mt-5">
          <FieldInline label="Kode" defaultValue={item.kode} onSave={v => update.mutate({ id, data: { kode: v } })} />
          <FieldInline label="Section" defaultValue={item.section ?? ''} onSave={v => update.mutate({ id, data: { section: v } })} />
          <FieldInline label="Satuan" defaultValue={item.satuan} onSave={v => update.mutate({ id, data: { satuan: v } })} />
          <FieldInline label="OHP %" type="number" defaultValue={String(item.ohpPct)} onSave={v => update.mutate({ id, data: { ohpPct: Number(v) } })} />
        </div>
      </div>

      {CATS.map(cat => (
        <CategoryBlock key={cat} cat={cat} ahspItemId={id}
          lines={resources.filter(r => r.category === cat)}
          subtotal={totals[cat]}
          onUpsert={resUpsert.mutate as any} onDelete={(rid: string) => resDelete.mutate({ id: rid })} />
      ))}

      <div className="border-2 border-[var(--color-ink)] bg-[var(--color-ink)] text-white p-5">
        <div className="flex justify-between font-mono text-sm"><span>D · Jumlah (A+B+C)</span><span>{fmtIDR(abc)}</span></div>
        <div className="flex justify-between font-mono text-sm mt-1"><span>E · OHP ({ohp}%)</span><span>{fmtIDR(abc * ohp / 100)}</span></div>
        <div className="flex justify-between text-xl font-bold text-[var(--color-brand)] mt-3 pt-3 border-t border-white/30">
          <span>F · HARGA SATUAN per {item.satuan}</span><span>{fmtIDR(unitRate)}</span>
        </div>
      </div>
    </div>
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

function CategoryBlock({ cat, ahspItemId, lines, subtotal, onUpsert, onDelete }:
  { cat: string; ahspItemId: string; lines: any[]; subtotal: number; onUpsert: (data: any) => void; onDelete: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ resourceCode: '', uraian: '', koefisien: 0, satuan: '', hsd: 0 });

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between">
        <span>{cat.toUpperCase()}</span>
        <button onClick={() => setAdding(true)} className="text-[var(--color-brand)] hover:text-white">+ ADD LINE</button>
      </div>
      <table className="w-full font-mono text-xs">
        <thead className="bg-neutral-100">
          <tr>
            <th className="text-left px-2 py-1.5">KODE</th>
            <th className="text-left px-2 py-1.5">URAIAN</th>
            <th className="text-right px-2 py-1.5 w-24">KOEF</th>
            <th className="text-left px-2 py-1.5 w-16">SAT</th>
            <th className="text-right px-2 py-1.5 w-28">HSD</th>
            <th className="text-right px-2 py-1.5 w-32">TOTAL</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id} className="border-b border-neutral-100">
              <td className="px-2 py-1.5"><Input className="text-xs py-1" defaultValue={l.resourceCode} onBlur={e => onUpsert({ ...l, id: l.id, ahspItemId, category: cat, koefisien: Number(l.koefisien), hsd: Number(l.hsd), resourceCode: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1" defaultValue={l.uraian} onBlur={e => onUpsert({ ...l, id: l.id, ahspItemId, category: cat, koefisien: Number(l.koefisien), hsd: Number(l.hsd), uraian: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1 text-right" type="number" step="any" defaultValue={l.koefisien} onBlur={e => onUpsert({ ...l, id: l.id, ahspItemId, category: cat, koefisien: Number(e.target.value), hsd: Number(l.hsd) })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1" defaultValue={l.satuan ?? ''} onBlur={e => onUpsert({ ...l, id: l.id, ahspItemId, category: cat, koefisien: Number(l.koefisien), hsd: Number(l.hsd), satuan: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1 text-right" type="number" step="any" defaultValue={l.hsd} onBlur={e => onUpsert({ ...l, id: l.id, ahspItemId, category: cat, koefisien: Number(l.koefisien), hsd: Number(e.target.value) })} /></td>
              <td className="px-2 py-1.5 text-right font-bold">{fmtIDR(Number(l.koefisien) * Number(l.hsd))}</td>
              <td className="px-2 py-1.5"><button onClick={() => onDelete(l.id)} className="text-red-600 p-1 hover:bg-red-50"><X size={12} /></button></td>
            </tr>
          ))}
          {adding && (
            <tr className="bg-orange-50">
              <td className="px-2 py-1.5"><Input className="text-xs py-1" placeholder="L01" value={n.resourceCode} onChange={e => setN({ ...n, resourceCode: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1" placeholder="Pekerja" value={n.uraian} onChange={e => setN({ ...n, uraian: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1 text-right" type="number" step="any" value={n.koefisien} onChange={e => setN({ ...n, koefisien: Number(e.target.value) })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1" placeholder="Jam" value={n.satuan} onChange={e => setN({ ...n, satuan: e.target.value })} /></td>
              <td className="px-2 py-1.5"><Input className="text-xs py-1 text-right" type="number" step="any" value={n.hsd} onChange={e => setN({ ...n, hsd: Number(e.target.value) })} /></td>
              <td className="px-2 py-1.5 text-right font-bold">{fmtIDR(n.koefisien * n.hsd)}</td>
              <td className="px-2 py-1.5">
                <button onClick={() => { onUpsert({ ahspItemId, category: cat, ordinal: lines.length, ...n }); setAdding(false); setN({ resourceCode: '', uraian: '', koefisien: 0, satuan: '', hsd: 0 }); }} className="text-[var(--color-brand)] p-1">✓</button>
              </td>
            </tr>
          )}
          <tr className="bg-neutral-100 font-bold">
            <td colSpan={5} className="px-2 py-1.5 text-right">SUBTOTAL {cat.toUpperCase()}</td>
            <td className="px-2 py-1.5 text-right text-[var(--color-brand)]">{fmtIDR(subtotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
