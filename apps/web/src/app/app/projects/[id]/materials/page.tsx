'use client';
import { use, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Truck, Plus, X } from 'lucide-react';
import Link from 'next/link';

export default function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const stocks = trpc.material.stockList.useQuery({ projectId: id });
  const deliveries = trpc.material.deliveryList.useQuery({ projectId: id });

  const utils = trpc.useUtils();
  const refresh = () => {
    utils.material.stockList.invalidate({ projectId: id });
    utils.material.deliveryList.invalidate({ projectId: id });
  };

  const upsertStock = trpc.material.stockUpsert.useMutation({ onSuccess: refresh });
  const consume = trpc.material.consume.useMutation({ onSuccess: refresh });
  const createDelivery = trpc.material.deliveryCreate.useMutation({ onSuccess: refresh });

  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddDelivery, setShowAddDelivery] = useState(false);

  async function handleConsume(materialCode: string, materialName: string) {
    const q = prompt(`Use how much "${materialName}"?`);
    if (!q) return;
    const qty = Number(q);
    if (!isFinite(qty) || qty <= 0) { alert('Invalid qty'); return; }
    try {
      const res = await consume.mutateAsync({ projectId: id, materialCode, qty });
      alert(`New balance: ${res.qtyBalance}`);
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-neutral-50 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href={`/app/projects/${id}`} className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] hover:underline">
            ← BACK TO BOQ
          </Link>
          <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold mt-1">
            {project.data?.code} · MATERIAL
          </div>
          <h1 className="font-display text-2xl font-bold">Material Stock + Delivery</h1>
        </div>
      </header>

      {/* STOCK BALANCE */}
      <section className="bg-white border-2 border-[var(--color-ink)]">
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[var(--color-brand)]" />
            <h2 className="font-display text-sm font-bold tracking-tight">STOCK BALANCE</h2>
            <span className="font-mono text-[10px] text-neutral-500">{stocks.data?.length ?? 0} materials</span>
          </div>
          <Button size="sm" variant="primary" onClick={() => setShowAddStock(true)}>
            <Plus size={12} className="mr-1" /> ADD MATERIAL
          </Button>
        </div>
        <div className="overflow-auto">
          {!stocks.data?.length ? (
            <div className="p-10 text-center font-mono text-xs text-neutral-500">
              No materials tracked yet. Add the first one to start.
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider">KODE</th>
                  <th className="text-left px-3 py-2 tracking-wider">NAMA</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[60px]">SAT</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[90px]">ORDERED</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[90px]">RECEIVED</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[90px]">USED</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[90px]">BALANCE</th>
                  <th className="text-left px-3 py-2 tracking-wider">SUPPLIER</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[110px]">UNIT PRICE</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[140px]">TOTAL VALUE</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {stocks.data.map(s => {
                  const bal = s.qtyBalance;
                  return (
                    <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{s.materialCode}</td>
                      <td className="px-3 py-2">{s.materialName}</td>
                      <td className="px-3 py-2 text-neutral-500">{s.satuan}</td>
                      <td className="px-3 py-2 text-right">{Number(s.qtyOrdered).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right">{Number(s.qtyReceived).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right">{Number(s.qtyUsed).toLocaleString('id-ID')}</td>
                      <td className={`px-3 py-2 text-right font-bold ${bal < 0 ? 'bg-red-100 text-red-700' : ''}`}>
                        {bal.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-neutral-600">{s.supplier ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{fmtIDR(Number(s.unitPrice))}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtIDR(s.totalValue)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleConsume(s.materialCode, s.materialName)}
                          className="px-2 py-1 text-[10px] border border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white tracking-wider"
                        >
                          USE
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* DELIVERY LOG */}
      <section className="bg-white border-2 border-[var(--color-ink)]">
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--color-brand)]" />
            <h2 className="font-display text-sm font-bold tracking-tight">DELIVERY LOG</h2>
            <span className="font-mono text-[10px] text-neutral-500">{deliveries.data?.length ?? 0} deliveries</span>
          </div>
          <Button size="sm" variant="primary" onClick={() => setShowAddDelivery(true)}>
            <Plus size={12} className="mr-1" /> RECORD DELIVERY
          </Button>
        </div>
        <div className="overflow-auto">
          {!deliveries.data?.length ? (
            <div className="p-10 text-center font-mono text-xs text-neutral-500">
              No deliveries recorded yet.
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">DATE</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">DO#</th>
                  <th className="text-left px-3 py-2 tracking-wider">MATERIAL</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[100px]">QTY</th>
                  <th className="text-left px-3 py-2 tracking-wider">SUPPLIER</th>
                  <th className="text-left px-3 py-2 tracking-wider">DRIVER</th>
                  <th className="text-left px-3 py-2 tracking-wider">SIGNED BY</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[140px]">VALUE</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.map(d => {
                  const qty = Number(d.qty);
                  const up = d.unitPrice !== null ? Number(d.unitPrice) : null;
                  const val = up !== null ? qty * up : null;
                  return (
                    <tr key={d.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2">{d.deliveryDate}</td>
                      <td className="px-3 py-2 font-bold">{d.doNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--color-brand)] font-bold">{d.materialCode}</td>
                      <td className="px-3 py-2 text-right">{qty.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-[11px] text-neutral-600">{d.supplier ?? '—'}</td>
                      <td className="px-3 py-2 text-[11px]">{d.driverName ?? '—'} {d.vehiclePlate ? `(${d.vehiclePlate})` : ''}</td>
                      <td className="px-3 py-2 text-[11px]">{d.signedBy ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-bold">{val !== null ? fmtIDR(val) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showAddStock && (
        <AddStockModal
          onClose={() => setShowAddStock(false)}
          onSubmit={async (data) => {
            await upsertStock.mutateAsync({ projectId: id, ...data });
            setShowAddStock(false);
          }}
        />
      )}
      {showAddDelivery && (
        <AddDeliveryModal
          stocks={stocks.data ?? []}
          onClose={() => setShowAddDelivery(false)}
          onSubmit={async (data) => {
            await createDelivery.mutateAsync({ projectId: id, ...data });
            setShowAddDelivery(false);
          }}
        />
      )}
    </div>
  );
}

interface AddStockData {
  materialCode: string;
  materialName: string;
  satuan: string;
  qtyOrdered: number;
  supplier?: string;
  unitPrice: number;
}

function AddStockModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: AddStockData) => Promise<void> }) {
  const [form, setForm] = useState<AddStockData>({
    materialCode: '', materialName: '', satuan: '', qtyOrdered: 0, supplier: '', unitPrice: 0,
  });
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!form.materialCode || !form.materialName || !form.satuan) { alert('Kode, nama, satuan required'); return; }
    setBusy(true);
    try {
      await onSubmit({ ...form, supplier: form.supplier || undefined });
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="ADD MATERIAL" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Kode *"><Input value={form.materialCode} onChange={e => setForm({ ...form, materialCode: e.target.value })} placeholder="e.g. SOLAR, SMN-50, GEOTEX-300" /></Field>
        <Field label="Nama *"><Input value={form.materialName} onChange={e => setForm({ ...form, materialName: e.target.value })} placeholder="Solar Industri / Semen 50kg / Geotextile NW 300gsm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Satuan *"><Input value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} placeholder="LTR / SAK / M2" /></Field>
          <Field label="Qty Ordered (PO)"><Input type="number" step="any" value={form.qtyOrdered} onChange={e => setForm({ ...form, qtyOrdered: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Supplier"><Input value={form.supplier ?? ''} onChange={e => setForm({ ...form, supplier: e.target.value })} /></Field>
        <Field label="Unit Price (Rp)"><Input type="number" step="any" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>CANCEL</Button>
        <Button variant="primary" size="sm" onClick={handle} disabled={busy}>{busy ? 'Saving…' : 'SAVE'}</Button>
      </div>
    </Modal>
  );
}

interface AddDeliveryData {
  materialCode: string;
  qty: number;
  deliveryDate: string;
  doNumber?: string;
  supplier?: string;
  vehiclePlate?: string;
  driverName?: string;
  signedBy?: string;
  unitPrice?: number;
}

function AddDeliveryModal({ stocks, onClose, onSubmit }: {
  stocks: Array<{ materialCode: string; materialName: string; supplier: string | null; unitPrice: string }>;
  onClose: () => void;
  onSubmit: (d: AddDeliveryData) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<AddDeliveryData>({
    materialCode: stocks[0]?.materialCode ?? '',
    qty: 0,
    deliveryDate: today,
    doNumber: '',
    supplier: stocks[0]?.supplier ?? '',
    vehiclePlate: '',
    driverName: '',
    signedBy: '',
    unitPrice: stocks[0] ? Number(stocks[0].unitPrice) : 0,
  });
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!form.materialCode) { alert('Pilih material'); return; }
    if (!form.qty || form.qty <= 0) { alert('Qty wajib > 0'); return; }
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        doNumber: form.doNumber || undefined,
        supplier: form.supplier || undefined,
        vehiclePlate: form.vehiclePlate || undefined,
        driverName: form.driverName || undefined,
        signedBy: form.signedBy || undefined,
        unitPrice: form.unitPrice && form.unitPrice > 0 ? form.unitPrice : undefined,
      });
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="RECORD DELIVERY" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Material *">
          {stocks.length ? (
            <select
              className="border-2 border-[var(--color-ink)] px-2 py-1.5 w-full font-mono text-xs"
              value={form.materialCode}
              onChange={e => {
                const code = e.target.value;
                const s = stocks.find(x => x.materialCode === code);
                setForm({
                  ...form,
                  materialCode: code,
                  supplier: s?.supplier ?? form.supplier,
                  unitPrice: s ? Number(s.unitPrice) : form.unitPrice,
                });
              }}
            >
              {stocks.map(s => <option key={s.materialCode} value={s.materialCode}>{s.materialCode} — {s.materialName}</option>)}
            </select>
          ) : (
            <Input value={form.materialCode} onChange={e => setForm({ ...form, materialCode: e.target.value })} placeholder="Material code (will auto-create stock row)" />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty *"><Input type="number" step="any" value={form.qty} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
          <Field label="Date *"><Input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="DO Number"><Input value={form.doNumber ?? ''} onChange={e => setForm({ ...form, doNumber: e.target.value })} placeholder="DO-2026-001" /></Field>
          <Field label="Unit Price (Rp)"><Input type="number" step="any" value={form.unitPrice ?? 0} onChange={e => setForm({ ...form, unitPrice: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Supplier"><Input value={form.supplier ?? ''} onChange={e => setForm({ ...form, supplier: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle Plate"><Input value={form.vehiclePlate ?? ''} onChange={e => setForm({ ...form, vehiclePlate: e.target.value })} placeholder="B 1234 ABC" /></Field>
          <Field label="Driver"><Input value={form.driverName ?? ''} onChange={e => setForm({ ...form, driverName: e.target.value })} /></Field>
        </div>
        <Field label="Signed By (site receiver)"><Input value={form.signedBy ?? ''} onChange={e => setForm({ ...form, signedBy: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>CANCEL</Button>
        <Button variant="primary" size="sm" onClick={handle} disabled={busy}>{busy ? 'Saving…' : 'SAVE'}</Button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-2 border-[var(--color-ink)] w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex justify-between items-center">
          <h3 className="font-display text-sm font-bold tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-200"><X size={14} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] tracking-wider">{label}</Label>
      {children}
    </div>
  );
}
