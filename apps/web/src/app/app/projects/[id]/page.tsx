'use client';
import { use, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, FileSearch, Download, History, Truck, FileStack, Users, Upload, BarChart3, Zap, ShieldAlert, Package } from 'lucide-react';
import Link from 'next/link';
import { AhspDetailDrawer } from '@/components/boq/ahsp-detail-drawer';
import { BoqVersionPanel } from '@/components/boq/boq-version-panel';
import { ProjectFleetPanel } from '@/components/fleet/project-fleet-panel';
import { TemplateBrowser } from '@/components/boq/template-browser';
import { ProjectMemberPanel } from '@/components/project/member-panel';
import { XlsxImport } from '@/components/boq/xlsx-import';

export default function ProjectBoqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const catalog = trpc.ahsp.catalog.useQuery();
  const [markup, setMarkup] = useState(0);
  const [cont, setCont] = useState(0);
  const [ppn, setPpn] = useState(11);
  const [search, setSearch] = useState('');
  const [drawerAhspId, setDrawerAhspId] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showFleet, setShowFleet] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const exportXlsx = trpc.export.boqXlsx.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    },
  });

  const boq = trpc.boq.list.useQuery(
    { projectId: id, markupPct: markup, contingencyPct: cont, ppnPct: ppn },
    { refetchInterval: false },
  );

  const utils = trpc.useUtils();
  const upsert = trpc.boq.upsert.useMutation({
    onSuccess: () => utils.boq.list.invalidate({ projectId: id }),
  });
  const remove = trpc.boq.remove.useMutation({
    onSuccess: () => utils.boq.list.invalidate({ projectId: id }),
  });

  const filteredCatalog = (catalog.data ?? []).filter(a =>
    !search || (a.kode + ' ' + a.jenis + ' ' + (a.section ?? '')).toLowerCase().includes(search.toLowerCase()),
  );
  const grouped = new Map<string, typeof filteredCatalog>();
  for (const a of filteredCatalog) {
    const k = a.section ?? 'OTHER';
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(a);
  }

  async function quickAdd(ahspItemId: string) {
    const q = prompt('Quantity?');
    if (!q) return;
    await upsert.mutateAsync({ projectId: id, ahspItemId, quantity: Number(q) });
  }

  return (
    <div className="grid grid-cols-[320px_1fr_340px] h-[calc(100vh-56px)]">
      {/* Sidebar: AHSP catalog */}
      <aside className="bg-white border-r-2 border-[var(--color-ink)] flex flex-col overflow-hidden">
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari AHSP..." className="pl-7 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {[...grouped.entries()].map(([section, items]) => (
            <details key={section} className="group">
              <summary className="px-3 py-2 bg-[var(--color-ink)] text-white font-mono text-[10px] tracking-wider font-bold cursor-pointer hover:bg-[var(--color-brand)] flex justify-between items-center">
                <span>▸ {section}</span>
                <span className="bg-white/20 px-1.5">{items.length}</span>
              </summary>
              <div>
                {items.map(it => (
                  <button key={it.id} onClick={() => quickAdd(it.id)}
                    className="w-full text-left px-3 py-2 border-b border-neutral-100 font-mono text-xs hover:bg-[var(--color-brand)] hover:text-white">
                    <div><strong>{it.kode}</strong> <span className="text-neutral-500 text-[10px]">{it.satuan}</span></div>
                    <div className="text-[10.5px] mt-0.5">{it.jenis}</div>
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      </aside>

      {/* Main: BOQ table */}
      <main className="bg-white border-r-2 border-[var(--color-ink)] flex flex-col overflow-hidden">
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold">
              {project.data?.code} · {boq.data?.items.length ?? 0} SCOPES
            </div>
            <h2 className="font-display text-lg font-bold">{project.data?.name}</h2>
          </div>
          <div className="flex gap-1">
            <Link href={`/app/projects/${id}/schedule`} className="p-2 hover:bg-white border border-[var(--color-ink)] text-[var(--color-brand)] inline-flex items-center" title="Schedule (S-curve + Gantt + Baseline)">
              <BarChart3 size={14} />
            </Link>
            <Link href={`/app/projects/${id}/hse`} className="p-2 hover:bg-white border border-[var(--color-ink)] text-[var(--color-brand)] inline-flex items-center" title="HSE Incident Log">
              <ShieldAlert size={14} />
            </Link>
            <button onClick={() => setShowTemplates(true)} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Templates">
              <FileStack size={14} />
            </button>
            <button onClick={() => setShowMembers(true)} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Project Members">
              <Users size={14} />
            </button>
            <button onClick={() => setShowFleet(true)} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Fleet Plan">
              <Truck size={14} />
            </button>
            <button onClick={() => setShowVersions(true)} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Versions">
              <History size={14} />
            </button>
            <button onClick={() => setShowImport(true)} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Import XLSX">
              <Upload size={14} />
            </button>
            <button
              onClick={() => exportXlsx.mutate({ projectId: id, markupPct: markup, contingencyPct: cont, ppnPct: ppn })}
              disabled={exportXlsx.isPending}
              className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Export XLSX">
              <Download size={14} />
            </button>
            <Link href={`/app/projects/${id}/quick-add`} className="p-2 hover:bg-white border border-[var(--color-ink)]" title="Quick Add Scopes">
              <Zap size={14} />
            </Link>
            <Link href={`/app/projects/${id}/materials`} className="p-2 hover:bg-white border border-[var(--color-ink)] text-[var(--color-brand)]" title="Material Stock + Delivery">
              <Package size={14} />
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {!boq.data?.items.length ? (
            <div className="p-16 text-center">
              <FileSearch size={48} className="mx-auto text-[var(--color-brand)]" />
              <h3 className="font-display text-xl font-bold mt-4">No scopes yet</h3>
              <p className="font-mono text-xs text-neutral-500 mt-2">Click any AHSP item in sidebar to add as scope.</p>
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[130px]">ITEM</th>
                  <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[50px]">SAT</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">QTY</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[120px]">RATE OVR</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[140px]">SUBTOTAL</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {boq.data.items.map(it => (
                  <tr key={it.id} className="border-b border-neutral-100">
                    <td className="px-3 py-2">
                      <strong className="text-[var(--color-brand)]">{it.kode}</strong>
                      {it.hasResourceOverride && <span className="ml-1 bg-[var(--color-brand)] text-white px-1 text-[8px] font-bold">OVR</span>}
                    </td>
                    <td className="px-3 py-2 text-[11px]">{it.jenis}</td>
                    <td className="px-3 py-2 text-neutral-500">{it.satuan}</td>
                    <td className="px-3 py-2">
                      <Input type="number" step="any" defaultValue={it.quantity}
                        onBlur={e => upsert.mutate({ projectId: id, ahspItemId: it.ahspItemId, quantity: Number(e.target.value), unitRateOverride: it.unitRateOverride })}
                        className="text-xs py-1 px-2" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" step="any" defaultValue={it.unitRateOverride ?? ''} placeholder={fmtIDR(it.defaultRate, { prefix: false })}
                        onBlur={e => upsert.mutate({ projectId: id, ahspItemId: it.ahspItemId, quantity: it.quantity, unitRateOverride: e.target.value === '' ? null : Number(e.target.value) })}
                        className="text-xs py-1 px-2" />
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[var(--color-brand)]">{fmtIDR(it.subtotal)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => setDrawerAhspId(it.ahspItemId)} title="Detail" className="p-1 hover:bg-neutral-100"><FileSearch size={14} /></button>
                      <button onClick={() => confirm('Hapus?') && remove.mutate({ id: it.id })} title="Delete" className="p-1 hover:bg-red-100 text-red-600"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Right sidebar: Financial summary */}
      <aside className="bg-white flex flex-col overflow-auto">
        <div className="p-3 border-b-2 border-[var(--color-ink)] bg-neutral-50">
          <h3 className="font-display text-sm font-bold tracking-tight">FINANCIAL SUMMARY</h3>
        </div>
        <div className="p-4 space-y-2 border-b border-neutral-200">
          <div>
            <Label className="text-[9px]">Markup %</Label>
            <Input type="number" step="0.1" value={markup} onChange={e => setMarkup(Number(e.target.value))} className="text-xs py-1" />
          </div>
          <div>
            <Label className="text-[9px]">Contingency %</Label>
            <Input type="number" step="0.1" value={cont} onChange={e => setCont(Number(e.target.value))} className="text-xs py-1" />
          </div>
          <div>
            <Label className="text-[9px]">PPN %</Label>
            <Input type="number" step="0.1" value={ppn} onChange={e => setPpn(Number(e.target.value))} className="text-xs py-1" />
          </div>
        </div>
        {boq.data && (
          <div className="p-4 font-mono text-xs space-y-1.5">
            <Row label="Tenaga" value={fmtIDR(boq.data.totals.tenaga)} />
            <Row label="Bahan" value={fmtIDR(boq.data.totals.bahan)} />
            <Row label="Peralatan" value={fmtIDR(boq.data.totals.peralatan)} />
            <div className="pt-2 mt-2 border-t border-neutral-300 font-bold"><Row label="SUBTOTAL" value={fmtIDR(boq.data.totals.subtotal)} /></div>
            <Row label={`+ Markup ${markup}%`} value={fmtIDR(boq.data.totals.markupAmt)} />
            <Row label={`+ Contingency ${cont}%`} value={fmtIDR(boq.data.totals.contingencyAmt)} />
            <div className="pt-1 mt-1 border-t border-neutral-200 font-bold"><Row label="Pre-PPN" value={fmtIDR(boq.data.totals.subtotalBeforePpn)} /></div>
            <Row label={`+ PPN ${ppn}%`} value={fmtIDR(boq.data.totals.ppnAmt)} />
            <div className="-mx-4 mt-3 px-4 py-3 bg-[var(--color-brand)] text-white font-bold text-base">
              <Row label="GRAND TOTAL" value={fmtIDR(boq.data.totals.grandTotal)} />
            </div>
          </div>
        )}
      </aside>

      <AhspDetailDrawer ahspItemId={drawerAhspId} projectId={id} onClose={() => setDrawerAhspId(null)} />
      {showVersions && <BoqVersionPanel projectId={id} onClose={() => setShowVersions(false)} />}
      {showFleet && <ProjectFleetPanel projectId={id} onClose={() => setShowFleet(false)} />}
      {showTemplates && <TemplateBrowser projectId={id} onClose={() => setShowTemplates(false)} />}
      {showMembers && <ProjectMemberPanel projectId={id} onClose={() => setShowMembers(false)} />}
      {showImport && <XlsxImport projectId={id} onClose={() => setShowImport(false)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span>{label}</span><span>{value}</span></div>;
}
