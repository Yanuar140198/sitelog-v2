'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewProjectPage() {
  const router = useRouter();
  const create = trpc.project.create.useMutation({
    onSuccess: (p) => router.push(`/app/projects/${p?.id}` as any),
  });
  const [form, setForm] = useState({
    code: '', name: '', client: '', location: '',
    startDate: '', finishDate: '', durationDays: 0,
    fleetDesign: '',
    planLandClearing: 0, planCutSoil: 0, planCutRock: 0, planFill: 0,
    targetCutDaily: 0, targetFillDaily: 0,
    markupPct: 0, contingencyPct: 0, ppnPct: 11,
    siteLat: '', siteLng: '', geofenceRadiusM: '',
  });

  function set<K extends keyof typeof form>(k: K, v: any) { setForm(prev => ({ ...prev, [k]: v })); }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CREATE</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">New Project</h1>
      </div>
      <form onSubmit={e => {
        e.preventDefault();
        const payload: any = { ...form };
        // Strip empty strings (date inputs send '' when unfilled — backend expects undefined)
        for (const k of ['startDate', 'finishDate', 'siteLat', 'siteLng', 'geofenceRadiusM']) {
          if (payload[k] === '') delete payload[k];
        }
        // Coerce numeric strings
        for (const k of ['siteLat', 'siteLng', 'geofenceRadiusM']) {
          if (payload[k] !== undefined) payload[k] = Number(payload[k]);
        }
        create.mutate(payload);
      }} className="space-y-6">
        <Section title="BASIC INFO">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Project Code *"><Input value={form.code} required onChange={e => set('code', e.target.value)} placeholder="LS 45" /></Field>
            <Field label="Status"><Input value="planning" readOnly /></Field>
            <Field label="Name *"><Input value={form.name} required onChange={e => set('name', e.target.value)} /></Field>
            <Field label="Client"><Input value={form.client} onChange={e => set('client', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Location"><Input value={form.location} onChange={e => set('location', e.target.value)} /></Field></div>
          </div>
        </Section>
        <Section title="SCHEDULE">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Start Date"><Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
            <Field label="Finish Date"><Input type="date" value={form.finishDate} onChange={e => set('finishDate', e.target.value)} /></Field>
            <Field label="Duration (days)"><Input type="number" value={form.durationDays} onChange={e => set('durationDays', Number(e.target.value))} /></Field>
          </div>
        </Section>
        <Section title="VOLUMES (m³)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Land Clearing"><Input type="number" step="0.01" value={form.planLandClearing} onChange={e => set('planLandClearing', Number(e.target.value))} /></Field>
            <Field label="Cut Soil"><Input type="number" step="0.01" value={form.planCutSoil} onChange={e => set('planCutSoil', Number(e.target.value))} /></Field>
            <Field label="Cut Rock"><Input type="number" step="0.01" value={form.planCutRock} onChange={e => set('planCutRock', Number(e.target.value))} /></Field>
            <Field label="Fill"><Input type="number" step="0.01" value={form.planFill} onChange={e => set('planFill', Number(e.target.value))} /></Field>
          </div>
        </Section>
        <Section title="FLEET + TARGETS">
          <Field label="Fleet Design"><Input value={form.fleetDesign} onChange={e => set('fleetDesign', e.target.value)} placeholder="DT 30T × 6, EX PC400 × 2" /></Field>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Target Cut / Day"><Input type="number" value={form.targetCutDaily} onChange={e => set('targetCutDaily', Number(e.target.value))} /></Field>
            <Field label="Target Fill / Day"><Input type="number" value={form.targetFillDaily} onChange={e => set('targetFillDaily', Number(e.target.value))} /></Field>
          </div>
        </Section>
        <Section title="FINANCIAL DEFAULTS (%)">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Markup"><Input type="number" step="0.1" value={form.markupPct} onChange={e => set('markupPct', Number(e.target.value))} /></Field>
            <Field label="Contingency"><Input type="number" step="0.1" value={form.contingencyPct} onChange={e => set('contingencyPct', Number(e.target.value))} /></Field>
            <Field label="PPN"><Input type="number" step="0.1" value={form.ppnPct} onChange={e => set('ppnPct', Number(e.target.value))} /></Field>
          </div>
        </Section>
        <Section title="GEOFENCE (OPTIONAL)">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Site Latitude"><Input type="number" step="0.0000001" value={form.siteLat} onChange={e => set('siteLat', e.target.value)} placeholder="-3.1234" /></Field>
            <Field label="Site Longitude"><Input type="number" step="0.0000001" value={form.siteLng} onChange={e => set('siteLng', e.target.value)} placeholder="121.5678" /></Field>
            <Field label="Radius (m)"><Input type="number" value={form.geofenceRadiusM} onChange={e => set('geofenceRadiusM', e.target.value)} placeholder="500" /></Field>
          </div>
        </Section>
        {create.error && <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono">{create.error.message}</div>}
        <div className="flex gap-3 pt-4 border-t-2 border-[var(--color-ink)]">
          <Button type="submit" variant="primary" size="lg" disabled={create.isPending}>
            {create.isPending ? 'CREATING...' : 'CREATE PROJECT →'}
          </Button>
          <Button type="button" onClick={() => router.back()}>CANCEL</Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
