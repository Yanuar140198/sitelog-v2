'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, ChevronRight, X, Briefcase } from 'lucide-react';

type InvoiceStatus = 'draft' | 'submitted' | 'verified' | 'approved' | 'paid' | 'rejected';

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: 'bg-neutral-200 text-neutral-700 border-neutral-700',
  submitted: 'bg-blue-100 text-blue-700 border-blue-700',
  verified: 'bg-cyan-100 text-cyan-700 border-cyan-700',
  approved: 'bg-amber-100 text-amber-700 border-amber-700',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-700',
  rejected: 'bg-red-100 text-red-700 border-red-700',
};

export default function ProjectSubcontractorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const project = trpc.project.get.useQuery({ id: projectId });
  const summary = trpc.subcontractor.summary.useQuery({ projectId });
  const contracts = trpc.subcontractor.contractsList.useQuery({ projectId });
  const subcons = trpc.subcontractor.list.useQuery();
  const [showContract, setShowContract] = useState(false);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-neutral-50 p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/app/projects/${projectId}`} className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] hover:underline">
            ← BACK TO BOQ
          </Link>
          <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold mt-1">
            {project.data?.code} · SUBCONTRACTORS
          </div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Briefcase size={20} /> Subcontractor Contracts + Invoices
          </h1>
        </div>
        <Button variant="primary" onClick={() => setShowContract(true)} disabled={!subcons.data?.length}>
          <Plus size={14} /> NEW CONTRACT
        </Button>
      </header>

      {!subcons.data?.length && !subcons.isLoading && (
        <div className="bg-amber-50 border-2 border-amber-700 p-4 font-mono text-xs">
          No subcontractors registered yet. Go to{' '}
          <Link href="/app/subcontractors" className="font-bold underline text-[var(--color-brand)]">
            Subcontractors master
          </Link>{' '}
          to add a vendor first.
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="TOTAL CONTRACT VALUE" value={fmtIDR(summary.data?.totalContractValue ?? 0)} highlight />
        <SummaryCard label="TOTAL INVOICED" value={fmtIDR(summary.data?.totalInvoiced ?? 0)} />
        <SummaryCard label="TOTAL PAID" value={fmtIDR(summary.data?.totalPaid ?? 0)} />
        <SummaryCard label="OUTSTANDING" value={fmtIDR(summary.data?.totalOutstanding ?? 0)} warn />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight">CONTRACTS</h2>
          <span className="font-mono text-[10px] text-neutral-500">{contracts.data?.length ?? 0} contracts</span>
        </div>
        {!contracts.data?.length && !contracts.isLoading && (
          <div className="bg-white border-2 border-[var(--color-ink)] p-10 text-center font-mono text-xs text-neutral-500">
            No subcontracts yet for this project.
          </div>
        )}
        {contracts.data?.map(c => (
          <ContractCard key={c.id} projectId={projectId} contract={c} />
        ))}
      </section>

      {showContract && subcons.data && (
        <ContractModal
          projectId={projectId}
          subcontractors={subcons.data}
          onClose={() => setShowContract(false)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div
      className={`bg-white border-2 p-4 ${
        highlight ? 'border-[var(--color-brand)] shadow-[4px_4px_0_var(--color-brand)]'
          : warn ? 'border-amber-700'
          : 'border-[var(--color-ink)]'
      }`}
    >
      <div className="font-mono text-[10px] tracking-[0.15em] text-neutral-500">{label}</div>
      <div className="font-display text-xl font-bold mt-2">{value}</div>
    </div>
  );
}

function ContractCard({ projectId, contract }: { projectId: string; contract: any }) {
  const [open, setOpen] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);
  const invoices = trpc.subcontractor.invoiceList.useQuery({ subcontractId: contract.id }, { enabled: open });
  const utils = trpc.useUtils();
  const approve = trpc.subcontractor.invoiceApprove.useMutation({
    onSuccess: () => {
      utils.subcontractor.invoiceList.invalidate({ subcontractId: contract.id });
      utils.subcontractor.summary.invalidate({ projectId });
      utils.subcontractor.contractsList.invalidate({ projectId });
    },
    onError: (e) => alert(e.message),
  });
  const markPaid = trpc.subcontractor.invoiceMarkPaid.useMutation({
    onSuccess: () => {
      utils.subcontractor.invoiceList.invalidate({ subcontractId: contract.id });
      utils.subcontractor.summary.invalidate({ projectId });
      utils.subcontractor.contractsList.invalidate({ projectId });
    },
    onError: (e) => alert(e.message),
  });

  const value = Number(contract.contractValue);
  const invoiced = Number(contract.totalInvoiced);
  const paid = Number(contract.totalPaid);
  const pct = value > 0 ? Math.min(100, (invoiced / value) * 100) : 0;

  return (
    <div className="bg-white border-2 border-[var(--color-ink)]">
      <div
        className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex items-center justify-between gap-3 flex-wrap cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold">{contract.subcontractorName}</span>
              {contract.contractNumber && (
                <span className="font-mono text-[10px] bg-[var(--color-ink)] text-white px-2 py-0.5 tracking-wider">
                  {contract.contractNumber}
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-neutral-600 mt-0.5">{contract.scopeDescription}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs">
          <div className="text-right">
            <div className="text-[10px] text-neutral-500 tracking-wider">VALUE</div>
            <div className="font-bold">{fmtIDR(value)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-neutral-500 tracking-wider">INVOICED</div>
            <div className="font-bold text-[var(--color-brand)]">{fmtIDR(invoiced)} <span className="text-neutral-400">({pct.toFixed(1)}%)</span></div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-neutral-500 tracking-wider">PAID</div>
            <div className="font-bold text-emerald-700">{fmtIDR(paid)}</div>
          </div>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-mono text-[11px] text-neutral-600 flex flex-wrap gap-4">
              {contract.startDate && <span>START: <strong>{contract.startDate}</strong></span>}
              {contract.endDate && <span>END: <strong>{contract.endDate}</strong></span>}
              <span>RETENTION: <strong>{Number(contract.retentionPct).toFixed(1)}%</strong></span>
              <span>INVOICES: <strong>{contract.invoiceCount}</strong></span>
            </div>
            <Button size="sm" variant="primary" onClick={() => setShowInvoice(true)}>
              <Plus size={12} className="mr-1" /> NEW INVOICE
            </Button>
          </div>

          {!invoices.data?.length ? (
            <div className="p-6 text-center font-mono text-xs text-neutral-500 border border-dashed border-neutral-300">
              No invoices submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-2 py-1.5 tracking-wider">NUMBER</th>
                  <th className="text-left px-2 py-1.5 tracking-wider">DATE</th>
                  <th className="text-right px-2 py-1.5 tracking-wider">PROG%</th>
                  <th className="text-right px-2 py-1.5 tracking-wider">GROSS</th>
                  <th className="text-right px-2 py-1.5 tracking-wider">RET</th>
                  <th className="text-right px-2 py-1.5 tracking-wider">PPN</th>
                  <th className="text-right px-2 py-1.5 tracking-wider">NET</th>
                  <th className="text-left px-2 py-1.5 tracking-wider">STATUS</th>
                  <th className="text-right px-2 py-1.5 tracking-wider w-40">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((iv: any) => {
                  const status = iv.status as InvoiceStatus;
                  return (
                    <tr key={iv.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-2 py-1.5 font-bold">{iv.invoiceNumber}</td>
                      <td className="px-2 py-1.5">{iv.invoiceDate}</td>
                      <td className="px-2 py-1.5 text-right">{Number(iv.progressPct).toFixed(1)}%</td>
                      <td className="px-2 py-1.5 text-right">{fmtIDR(Number(iv.grossAmount))}</td>
                      <td className="px-2 py-1.5 text-right text-neutral-600">{fmtIDR(Number(iv.retentionAmount))}</td>
                      <td className="px-2 py-1.5 text-right text-neutral-600">{fmtIDR(Number(iv.ppnAmount))}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{fmtIDR(Number(iv.netAmount))}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block px-2 py-0.5 text-[10px] tracking-wider border ${STATUS_COLOR[status]}`}>
                          {status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right space-x-1">
                        {(status === 'submitted' || status === 'verified') && (
                          <button
                            onClick={() => approve.mutate({ id: iv.id })}
                            className="px-2 py-0.5 text-[10px] border border-[var(--color-ink)] hover:bg-amber-100 tracking-wider"
                          >APPROVE</button>
                        )}
                        {status === 'approved' && (
                          <button
                            onClick={() => {
                              const d = prompt('Paid date (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
                              if (!d) return;
                              const amt = prompt('Paid amount (Rp)?', String(Number(iv.netAmount)));
                              if (!amt) return;
                              markPaid.mutate({ id: iv.id, paidDate: d, paidAmount: Number(amt) });
                            }}
                            className="px-2 py-0.5 text-[10px] border border-emerald-700 text-emerald-700 hover:bg-emerald-100 tracking-wider"
                          >MARK PAID</button>
                        )}
                        {status === 'paid' && iv.paidDate && (
                          <span className="text-[10px] text-emerald-700">{iv.paidDate}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {showInvoice && (
        <InvoiceModal
          contract={contract}
          onClose={() => setShowInvoice(false)}
          projectId={projectId}
        />
      )}
    </div>
  );
}

function ContractModal({ projectId, subcontractors, onClose }: {
  projectId: string;
  subcontractors: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const create = trpc.subcontractor.contractCreate.useMutation({
    onSuccess: () => {
      utils.subcontractor.contractsList.invalidate({ projectId });
      utils.subcontractor.summary.invalidate({ projectId });
      onClose();
    },
    onError: (e) => alert(e.message),
  });
  const [form, setForm] = useState({
    subcontractorId: subcontractors[0]?.id ?? '',
    contractNumber: '',
    scopeDescription: '',
    contractValue: 0,
    startDate: '',
    endDate: '',
    retentionPct: 5,
    signedAt: '',
    notes: '',
  });

  return (
    <Modal title="NEW CONTRACT" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault();
          if (!form.subcontractorId) { alert('Pilih subcontractor'); return; }
          if (!form.scopeDescription) { alert('Scope wajib diisi'); return; }
          create.mutate({
            projectId,
            subcontractorId: form.subcontractorId,
            contractNumber: form.contractNumber || undefined,
            scopeDescription: form.scopeDescription,
            contractValue: Number(form.contractValue) || 0,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            retentionPct: Number(form.retentionPct) || 0,
            signedAt: form.signedAt || undefined,
            notes: form.notes || undefined,
          });
        }}
      >
        <Field label="Subcontractor *">
          <select
            value={form.subcontractorId}
            onChange={e => setForm({ ...form, subcontractorId: e.target.value })}
            className="w-full border-2 border-[var(--color-ink)] px-2 py-1.5 font-mono text-xs bg-white"
          >
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contract Number"><Input value={form.contractNumber} onChange={e => setForm({ ...form, contractNumber: e.target.value })} placeholder="SPK-2026-001" /></Field>
          <Field label="Signed At"><Input type="date" value={form.signedAt} onChange={e => setForm({ ...form, signedAt: e.target.value })} /></Field>
        </div>
        <Field label="Scope Description *">
          <textarea
            required
            value={form.scopeDescription}
            onChange={e => setForm({ ...form, scopeDescription: e.target.value })}
            rows={2}
            className="w-full border-2 border-[var(--color-ink)] px-2 py-1.5 font-mono text-xs"
            placeholder="e.g. Pengeboran soil investigation 5 titik @ 30m"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Contract Value (Rp)"><Input type="number" step="any" value={form.contractValue} onChange={e => setForm({ ...form, contractValue: Number(e.target.value) })} /></Field>
          <Field label="Start Date"><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="End Date"><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
        <Field label="Retention %"><Input type="number" step="0.1" value={form.retentionPct} onChange={e => setForm({ ...form, retentionPct: Number(e.target.value) })} /></Field>
        <Field label="Notes"><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" onClick={onClose}>CANCEL</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
        </div>
      </form>
    </Modal>
  );
}

function InvoiceModal({ contract, projectId, onClose }: { contract: any; projectId: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.subcontractor.invoiceCreate.useMutation({
    onSuccess: () => {
      utils.subcontractor.invoiceList.invalidate({ subcontractId: contract.id });
      utils.subcontractor.summary.invalidate({ projectId });
      utils.subcontractor.contractsList.invalidate({ projectId });
      onClose();
    },
    onError: (e) => alert(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);
  const retentionPct = Number(contract.retentionPct) || 0;
  const [form, setForm] = useState({
    invoiceNumber: '',
    invoiceDate: today,
    progressPct: 0,
    grossAmount: 0,
    ppnPct: 11,
    notes: '',
  });

  const gross = Number(form.grossAmount) || 0;
  const retention = gross * (retentionPct / 100);
  const afterRetention = gross - retention;
  const ppn = afterRetention * (Number(form.ppnPct) / 100);
  const net = afterRetention + ppn;

  return (
    <Modal title={`NEW INVOICE — ${contract.subcontractorName}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault();
          if (!form.invoiceNumber) { alert('Nomor invoice wajib'); return; }
          if (gross <= 0) { alert('Gross amount harus > 0'); return; }
          create.mutate({
            subcontractId: contract.id,
            invoiceNumber: form.invoiceNumber,
            invoiceDate: form.invoiceDate,
            progressPct: Number(form.progressPct) || 0,
            grossAmount: gross,
            retentionAmount: retention,
            ppnAmount: ppn,
            netAmount: net,
            notes: form.notes || undefined,
          });
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Invoice Number *"><Input required value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-001/2026" /></Field>
          <Field label="Invoice Date *"><Input type="date" required value={form.invoiceDate} onChange={e => setForm({ ...form, invoiceDate: e.target.value })} /></Field>
        </div>
        <Field label="Progress %"><Input type="number" step="0.1" value={form.progressPct} onChange={e => setForm({ ...form, progressPct: Number(e.target.value) })} /></Field>
        <Field label="Gross Amount (Rp) *"><Input type="number" step="any" required value={form.grossAmount} onChange={e => setForm({ ...form, grossAmount: Number(e.target.value) })} /></Field>
        <Field label="PPN %"><Input type="number" step="0.1" value={form.ppnPct} onChange={e => setForm({ ...form, ppnPct: Number(e.target.value) })} /></Field>

        <div className="bg-neutral-50 border-2 border-[var(--color-ink)] p-3 space-y-1 font-mono text-xs">
          <div className="flex justify-between"><span>Gross</span><span>{fmtIDR(gross)}</span></div>
          <div className="flex justify-between text-neutral-600"><span>− Retention ({retentionPct}%)</span><span>{fmtIDR(retention)}</span></div>
          <div className="flex justify-between text-neutral-600"><span>+ PPN ({form.ppnPct}%)</span><span>{fmtIDR(ppn)}</span></div>
          <div className="flex justify-between font-bold border-t border-[var(--color-ink)] pt-1 mt-1">
            <span>NET PAYABLE</span><span className="text-[var(--color-brand)]">{fmtIDR(net)}</span>
          </div>
        </div>

        <Field label="Notes"><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" onClick={onClose}>CANCEL</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>SUBMIT</Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-2 border-[var(--color-ink)] w-full max-w-xl max-h-[90vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]"
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
