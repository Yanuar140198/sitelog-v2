'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface FormState {
  name: string;
  npwp: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccount: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '', npwp: '', contactPerson: '', phone: '', email: '',
  address: '', bankName: '', bankAccount: '', notes: '',
};

export default function SubcontractorsPage() {
  const list = trpc.subcontractor.list.useQuery();
  const utils = trpc.useUtils();
  const del = trpc.subcontractor.delete.useMutation({
    onSuccess: () => utils.subcontractor.list.invalidate(),
    onError: (e) => alert(e.message),
  });

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<FormState>(EMPTY);

  function openCreate() { setEditId(null); setEditInitial(EMPTY); setShowModal(true); }
  function openEdit(row: any) {
    setEditId(row.id);
    setEditInitial({
      name: row.name ?? '',
      npwp: row.npwp ?? '',
      contactPerson: row.contactPerson ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      bankName: row.bankName ?? '',
      bankAccount: row.bankAccount ?? '',
      notes: row.notes ?? '',
    });
    setShowModal(true);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">VENDORS</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Subcontractors</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {list.data?.length ?? 0} subkontraktor terdaftar
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}><Plus size={14} /> NEW SUBCONTRACTOR</Button>
      </div>

      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">NAME</th>
            <th className="text-left px-3 py-2 tracking-wider">NPWP</th>
            <th className="text-left px-3 py-2 tracking-wider">CONTACT</th>
            <th className="text-left px-3 py-2 tracking-wider">PHONE</th>
            <th className="text-left px-3 py-2 tracking-wider">BANK</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(s => (
            <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 font-bold">{s.name}</td>
              <td className="px-3 py-2 text-neutral-600">{s.npwp ?? '—'}</td>
              <td className="px-3 py-2">{s.contactPerson ?? '—'}</td>
              <td className="px-3 py-2">{s.phone ?? '—'}</td>
              <td className="px-3 py-2 text-[11px]">
                {s.bankName ? <>{s.bankName} <span className="text-neutral-500">{s.bankAccount}</span></> : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => openEdit(s)} className="p-1 hover:bg-neutral-100" title="Edit"><Pencil size={13} /></button>
                <button
                  onClick={() => confirm(`Delete ${s.name}?`) && del.mutate({ id: s.id })}
                  className="p-1 hover:bg-red-50 text-red-600"
                  title="Delete"
                ><Trash2 size={13} /></button>
              </td>
            </tr>
          ))}
          {!list.isLoading && list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-neutral-500">
              No subcontractors yet. Add your first vendor (Lab boring, Survey, Hauling, etc.) to get started.
            </td></tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <SubcontractorModal
          id={editId}
          initial={editInitial}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function SubcontractorModal({ id, initial, onClose }: { id: string | null; initial: FormState; onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.subcontractor.create.useMutation({
    onSuccess: () => { utils.subcontractor.list.invalidate(); onClose(); },
    onError: (e) => alert(e.message),
  });
  const update = trpc.subcontractor.update.useMutation({
    onSuccess: () => { utils.subcontractor.list.invalidate(); onClose(); },
    onError: (e) => alert(e.message),
  });
  const [form, setForm] = useState<FormState>(initial);
  const pending = create.isPending || update.isPending;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(p => ({ ...p, [k]: v })); }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-2xl w-full shadow-[8px_8px_0_var(--color-brand)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold">{id ? 'Edit Subcontractor' : 'New Subcontractor'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100"><X size={16} /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            const payload = {
              name: form.name,
              npwp: form.npwp || undefined,
              contactPerson: form.contactPerson || undefined,
              phone: form.phone || undefined,
              email: form.email || undefined,
              address: form.address || undefined,
              bankName: form.bankName || undefined,
              bankAccount: form.bankAccount || undefined,
              notes: form.notes || undefined,
            };
            if (id) update.mutate({ id, ...payload });
            else create.mutate(payload);
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="col-span-2"><Label>Name *</Label>
            <Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="PT. Sumber Bor Mandiri / CV. Survey Geotek" />
          </div>
          <div><Label>NPWP</Label><Input value={form.npwp} onChange={e => set('npwp', e.target.value)} placeholder="00.000.000.0-000.000" /></div>
          <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0812..." /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><Label>Bank Name</Label><Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="BCA / Mandiri / BRI" /></div>
          <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} /></div>
          <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2 flex gap-2 mt-3">
            <Button type="submit" variant="primary" disabled={pending}>{id ? 'SAVE' : 'CREATE'}</Button>
            <Button type="button" onClick={onClose}>CANCEL</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
