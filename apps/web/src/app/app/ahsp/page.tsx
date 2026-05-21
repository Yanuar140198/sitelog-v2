'use client';
import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtIDR } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

export default function AhspCatalogPage() {
  const catalog = trpc.ahsp.catalog.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.ahsp.create.useMutation({
    onSuccess: () => { utils.ahsp.catalog.invalidate(); setShow(false); reset(); },
  });
  const del = trpc.ahsp.delete.useMutation({
    onSuccess: () => utils.ahsp.catalog.invalidate(),
  });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ kode: '', label: '', section: '', jenis: '', satuan: '', ohpPct: 0 });
  function reset() { setForm({ kode: '', label: '', section: '', jenis: '', satuan: '', ohpPct: 0 }); }
  function set<K extends keyof typeof form>(k: K, v: any) { setForm(p => ({ ...p, [k]: v })); }

  const orgItems = (catalog.data ?? []).filter(a => a.organizationId);
  const globalItems = (catalog.data ?? []).filter(a => !a.organizationId);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CATALOG</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP Items</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {globalItems.length} global · {orgItems.length} org-custom
          </p>
        </div>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW ITEM</Button>
      </div>

      <Section title="ORG CUSTOM ITEMS">
        {orgItems.length === 0
          ? <div className="text-neutral-500 font-mono text-xs py-8 text-center">No custom items. Create one to build your own AHSP analysis.</div>
          : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider">KODE</th>
                  <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                  <th className="text-left px-3 py-2 tracking-wider">SAT</th>
                  <th className="text-left px-3 py-2 tracking-wider">SECTION</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>{orgItems.map(it => (
                <tr key={it.id} className="border-b border-neutral-100">
                  <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{it.kode}</td>
                  <td className="px-3 py-2">{it.jenis}</td>
                  <td className="px-3 py-2">{it.satuan}</td>
                  <td className="px-3 py-2 text-neutral-500">{it.section ?? '—'}</td>
                  <td className="px-3 py-2 flex gap-1 justify-end">
                    <Link href={`/app/ahsp/${it.id}` as any}><Button>EDIT</Button></Link>
                    <button onClick={() => confirm('Delete?') && del.mutate({ id: it.id })} className="p-1 text-red-600 hover:bg-red-50"><X size={14} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </Section>

      <Section title={`GLOBAL CATALOG (${globalItems.length})`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2 max-h-96 overflow-auto">
          {globalItems.map(it => (
            <div key={it.id} className="border border-neutral-300 p-3 font-mono text-xs">
              <strong className="text-[var(--color-brand)]">{it.kode}</strong>
              <div className="mt-1">{it.jenis}</div>
              <div className="text-neutral-500 mt-1">{it.section} · {it.satuan}</div>
            </div>
          ))}
        </div>
      </Section>

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">New AHSP Item</h2>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ ...form, ohpPct: Number(form.ohpPct) }); }}
              className="grid grid-cols-2 gap-3">
              <div><Label>Kode *</Label><Input required value={form.kode} onChange={e => set('kode', e.target.value)} placeholder="CUSTOM-001" /></div>
              <div><Label>Label</Label><Input value={form.label} onChange={e => set('label', e.target.value)} /></div>
              <div className="col-span-2"><Label>Jenis Pekerjaan *</Label><Input required value={form.jenis} onChange={e => set('jenis', e.target.value)} placeholder="Custom Cut Soil with Bulldozer" /></div>
              <div><Label>Section</Label><Input value={form.section} onChange={e => set('section', e.target.value)} placeholder="EARTHWORK" /></div>
              <div><Label>Satuan *</Label><Input required value={form.satuan} onChange={e => set('satuan', e.target.value)} placeholder="M3" /></div>
              <div><Label>OHP %</Label><Input type="number" step="0.1" value={form.ohpPct} onChange={e => set('ohpPct', e.target.value)} /></div>
              <div className="col-span-2 flex gap-2 mt-3">
                <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      {children}
    </div>
  );
}
