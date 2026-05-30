'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Edit2, DollarSign, Package } from 'lucide-react';

type Category = 'tenaga' | 'bahan' | 'peralatan';
const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'tenaga', label: 'TENAGA' },
  { value: 'bahan', label: 'BAHAN' },
  { value: 'peralatan', label: 'PERALATAN' },
];
const REGIONS = ['', 'JAKARTA', 'SULAWESI', 'KALIMANTAN', 'SUMATERA', 'JAWA', 'PAPUA'];

const fmt = (v: string | number | null | undefined) =>
  v == null ? '-' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(v));

export default function ResourcesPage() {
  const [category, setCategory] = useState<Category>('bahan');
  const [region, setRegion] = useState<string>('');
  const [customRegion, setCustomRegion] = useState('');
  const [q, setQ] = useState('');

  const effectiveRegion = region === 'OTHER' ? customRegion.toUpperCase() : region;
  const list = trpc.resourceMaster.list.useQuery({
    category,
    q: q || undefined,
    region: effectiveRegion || undefined,
  });
  const utils = trpc.useUtils();

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [pricingFor, setPricingFor] = useState<any | null>(null);

  const create = trpc.resourceMaster.create.useMutation({
    onSuccess: () => { utils.resourceMaster.list.invalidate(); setShowAdd(false); },
  });
  const update = trpc.resourceMaster.update.useMutation({
    onSuccess: () => { utils.resourceMaster.list.invalidate(); setEditing(null); },
  });
  const del = trpc.resourceMaster.delete.useMutation({
    onSuccess: () => utils.resourceMaster.list.invalidate(),
  });
  const setPrice = trpc.resourceMaster.setPrice.useMutation({
    onSuccess: () => { utils.resourceMaster.list.invalidate(); setPricingFor(null); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <p className="font-mono text-xs text-neutral-600 max-w-2xl">
          Centralized HSD library. AHSP rates lookup unit prices from here — update solar price once, all AHSP recompute.
          Regional tiers override default HSD per region.
        </p>
        <Button variant="primary" onClick={() => setShowAdd(true)}><Plus size={14} /> NEW RESOURCE</Button>
      </div>

      <div className="flex gap-2 border-b-2 border-[var(--color-ink)] overflow-x-auto whitespace-nowrap">
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)}
            className={`px-4 py-2 font-mono text-xs tracking-wider border-b-4 ${
              category === c.value ? 'border-[var(--color-brand)] font-bold' : 'border-transparent hover:border-neutral-300'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label>Search</Label>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="kode or nama..." />
        </div>
        <div>
          <Label>Region</Label>
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm h-[42px]">
            <option value="">— No region —</option>
            {REGIONS.filter(r => r).map(r => <option key={r} value={r}>{r}</option>)}
            <option value="OTHER">OTHER...</option>
          </select>
        </div>
        {region === 'OTHER' && (
          <div>
            <Label>Custom</Label>
            <Input value={customRegion} onChange={e => setCustomRegion(e.target.value)} placeholder="REGION_CODE" />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)] min-w-[720px]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">KODE</th>
            <th className="text-left px-3 py-2 tracking-wider">NAMA</th>
            <th className="text-left px-3 py-2 tracking-wider">SATUAN</th>
            <th className="text-right px-3 py-2 tracking-wider">DEFAULT HSD</th>
            {effectiveRegion && <th className="text-right px-3 py-2 tracking-wider">{effectiveRegion} HSD</th>}
            <th className="text-left px-3 py-2 tracking-wider">SCOPE</th>
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(r => (
            <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 font-bold">{r.kode}</td>
              <td className="px-3 py-2">{r.nama}</td>
              <td className="px-3 py-2 text-neutral-600">{r.satuan}</td>
              <td className="px-3 py-2 text-right">Rp {fmt(r.defaultHsd)}</td>
              {effectiveRegion && (
                <td className="px-3 py-2 text-right">
                  {r.regionHsd
                    ? <span className="font-bold text-[var(--color-brand)]">Rp {fmt(r.regionHsd)}</span>
                    : <span className="text-neutral-400">—</span>}
                </td>
              )}
              <td className="px-3 py-2">
                {r.organizationId
                  ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold">ORG</span>
                  : <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 text-[10px] font-bold">GLOBAL</span>}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button onClick={() => setPricingFor(r)} className="p-1 text-[var(--color-brand)] hover:bg-orange-50" title="Set regional price">
                  <DollarSign size={14} />
                </button>
                {r.organizationId && (
                  <>
                    <button onClick={() => setEditing(r)} className="p-1 hover:bg-neutral-100" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => confirm('Delete this resource?') && del.mutate({ id: r.id })}
                      className="p-1 text-red-600 hover:bg-red-50" title="Delete">
                      <X size={14} />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={effectiveRegion ? 7 : 6} className="text-center py-12 text-neutral-500">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              No resources in this category yet.
            </td></tr>
          )}
        </tbody>
      </table>
      </div>

      {(showAdd || editing) && (
        <ResourceModal
          initial={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSubmit={(data) => editing
            ? update.mutate({ id: editing.id, ...data })
            : create.mutate(data)}
          pending={create.isPending || update.isPending}
        />
      )}

      {pricingFor && (
        <PriceModal
          resource={pricingFor}
          onClose={() => setPricingFor(null)}
          onSubmit={(data) => setPrice.mutate({ resourceId: pricingFor.id, ...data })}
          pending={setPrice.isPending}
        />
      )}
    </div>
  );
}

function ResourceModal({ initial, onClose, onSubmit, pending }: {
  initial: any | null;
  onClose: () => void;
  onSubmit: (d: { kode: string; nama: string; category: Category; satuan: string; defaultHsd: number }) => void;
  pending: boolean;
}) {
  const [kode, setKode] = useState(initial?.kode ?? '');
  const [nama, setNama] = useState(initial?.nama ?? '');
  const [cat, setCat] = useState<Category>(initial?.category ?? 'bahan');
  const [satuan, setSatuan] = useState(initial?.satuan ?? '');
  const [hsd, setHsd] = useState<string>(initial?.defaultHsd ?? '0');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] p-4 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="flex items-center gap-2 mb-4">
          <Package size={20} className="text-[var(--color-brand)]" />
          <h2 className="font-display text-2xl font-bold">{initial ? 'Edit' : 'New'} Resource</h2>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          onSubmit({ kode, nama, category: cat, satuan, defaultHsd: Number(hsd) });
        }} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Kode *</Label>
              <Input required value={kode} onChange={e => setKode(e.target.value)} placeholder="L01" />
            </div>
            <div>
              <Label>Category *</Label>
              <select value={cat} onChange={e => setCat(e.target.value as Category)}
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Nama *</Label>
            <Input required value={nama} onChange={e => setNama(e.target.value)} placeholder="Pekerja Harian" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Satuan *</Label>
              <Input required value={satuan} onChange={e => setSatuan(e.target.value)} placeholder="hari, ltr, jam" />
            </div>
            <div>
              <Label>Default HSD (Rp) *</Label>
              <Input required type="number" min={0} step="0.01" value={hsd} onChange={e => setHsd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" variant="primary" disabled={pending}>{initial ? 'UPDATE' : 'CREATE'}</Button>
            <Button type="button" onClick={onClose}>CANCEL</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PriceModal({ resource, onClose, onSubmit, pending }: {
  resource: any;
  onClose: () => void;
  onSubmit: (d: { region: string; hsd: number; effectiveFrom?: string }) => void;
  pending: boolean;
}) {
  const [region, setRegion] = useState('JAKARTA');
  const [customRegion, setCustomRegion] = useState('');
  const [hsd, setHsd] = useState<string>(String(resource.defaultHsd ?? '0'));
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const finalRegion = region === 'OTHER' ? customRegion.toUpperCase() : region;
  const history = trpc.resourceMaster.priceHistory.useQuery(
    { resourceId: resource.id, region: finalRegion },
    { enabled: !!finalRegion },
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] p-4 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign size={20} className="text-[var(--color-brand)]" />
          <h2 className="font-display text-2xl font-bold">Set Regional Price</h2>
        </div>
        <p className="font-mono text-xs text-neutral-600 mb-4">
          {resource.kode} — {resource.nama} ({resource.satuan})
        </p>
        <form onSubmit={e => {
          e.preventDefault();
          if (!finalRegion) return;
          onSubmit({ region: finalRegion, hsd: Number(hsd), effectiveFrom });
        }} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Region *</Label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                {REGIONS.filter(r => r).map(r => <option key={r} value={r}>{r}</option>)}
                <option value="OTHER">OTHER...</option>
              </select>
            </div>
            <div>
              <Label>Effective From *</Label>
              <Input required type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
            </div>
          </div>
          {region === 'OTHER' && (
            <div>
              <Label>Custom Region Code *</Label>
              <Input required value={customRegion} onChange={e => setCustomRegion(e.target.value)} placeholder="MALUKU" />
            </div>
          )}
          <div>
            <Label>HSD for region (Rp) *</Label>
            <Input required type="number" min={0} step="0.01" value={hsd} onChange={e => setHsd(e.target.value)} />
          </div>

          {history.data && history.data.length > 0 && (
            <div className="border-t-2 border-neutral-200 pt-3 mt-3">
              <p className="font-mono text-[10px] tracking-wider text-neutral-500 mb-2">PRICE HISTORY — {finalRegion}</p>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full font-mono text-xs">
                  <tbody>
                    {history.data.map(p => (
                      <tr key={p.id} className="border-b border-neutral-100">
                        <td className="py-1 text-neutral-600">{String(p.effectiveFrom)}</td>
                        <td className="py-1 text-right">Rp {fmt(p.hsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button type="submit" variant="primary" disabled={pending}>SAVE PRICE</Button>
            <Button type="button" onClick={onClose}>CANCEL</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
