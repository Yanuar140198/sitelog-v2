'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

export default function FleetPage() {
  const units = trpc.fleet.unitList.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.fleet.unitCreate.useMutation({
    onSuccess: () => { utils.fleet.unitList.invalidate(); setShow(false); reset(); },
  });
  const del = trpc.fleet.unitDelete.useMutation({
    onSuccess: () => utils.fleet.unitList.invalidate(),
  });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ nomor: '', fleet: '', jenisAlat: '', brand: '', model: '', capacity: '', vendor: '', ratePerHour: 0 });
  function reset() { setForm({ nomor: '', fleet: '', jenisAlat: '', brand: '', model: '', capacity: '', vendor: '', ratePerHour: 0 }); }
  function set<K extends keyof typeof form>(k: K, v: any) { setForm(p => ({ ...p, [k]: v })); }

  // Summary by jenisAlat
  const byType = new Map<string, number>();
  for (const u of units.data ?? []) byType.set(u.jenisAlat ?? '—', (byType.get(u.jenisAlat ?? '—') ?? 0) + 1);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">EQUIPMENT</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Fleet Master</h1>
        </div>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> ADD UNIT</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[...byType.entries()].map(([t, c]) => (
          <div key={t} className="bg-white border-2 border-[var(--color-ink)] px-3 py-1.5 font-mono text-xs">
            <strong>{t}</strong> × {c}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)] min-w-[720px]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">NOMOR</th>
            <th className="text-left px-3 py-2 tracking-wider">FLEET</th>
            <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
            <th className="text-left px-3 py-2 tracking-wider">BRAND/MODEL</th>
            <th className="text-left px-3 py-2 tracking-wider">VENDOR</th>
            <th className="text-right px-3 py-2 tracking-wider">RATE/HR</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {units.data?.map(u => (
            <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{u.nomor}</td>
              <td className="px-3 py-2">{u.fleet ?? '—'}</td>
              <td className="px-3 py-2">{u.jenisAlat ?? '—'}</td>
              <td className="px-3 py-2">{[u.brand, u.model].filter(Boolean).join(' ')}</td>
              <td className="px-3 py-2">{u.vendor ?? '—'}</td>
              <td className="px-3 py-2 text-right">{u.ratePerHour ? `Rp ${Number(u.ratePerHour).toLocaleString('id-ID')}` : '—'}</td>
              <td className="px-3 py-2 text-center">
                <button onClick={() => confirm('Delete unit?') && del.mutate({ id: u.id })} className="p-1 text-red-600 hover:bg-red-50"><X size={14} /></button>
              </td>
            </tr>
          ))}
          {units.data?.length === 0 && (
            <tr><td colSpan={7} className="text-center py-12 text-neutral-500">No units yet. Add first.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-4 md:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">Add Unit</h2>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ ...form, ratePerHour: Number(form.ratePerHour) || undefined }); }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nomor *</Label><Input required value={form.nomor} onChange={e => set('nomor', e.target.value)} /></div>
              <div><Label>Jenis Alat</Label><Input value={form.jenisAlat} onChange={e => set('jenisAlat', e.target.value)} placeholder="DT, EX, ADT" /></div>
              <div><Label>Fleet</Label><Input value={form.fleet} onChange={e => set('fleet', e.target.value)} /></div>
              <div><Label>Vendor</Label><Input value={form.vendor} onChange={e => set('vendor', e.target.value)} /></div>
              <div><Label>Brand</Label><Input value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={e => set('model', e.target.value)} /></div>
              <div><Label>Capacity</Label><Input value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="30T" /></div>
              <div><Label>Rate / Hour (Rp)</Label><Input type="number" value={form.ratePerHour} onChange={e => set('ratePerHour', Number(e.target.value))} /></div>
              {create.error && <div className="sm:col-span-2 text-red-600 text-xs font-mono">{create.error.message}</div>}
              <div className="sm:col-span-2 flex gap-2 mt-3">
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
