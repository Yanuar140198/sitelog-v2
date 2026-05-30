'use client';
import { useState, useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function SettingsGeneral() {
  const current = trpc.org.current.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.org.update.useMutation({ onSuccess: () => utils.org.current.invalidate() });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (current.data) setForm({
      name: current.data.name, logo: current.data.logo ?? '',
      currency: current.data.currency, locale: current.data.locale, timezone: current.data.timezone,
      brandColor: current.data.brandColor, brandSecondary: current.data.brandSecondary,
      customDomain: current.data.customDomain ?? '',
    });
  }, [current.data]);

  if (!current.data) return <div className="font-mono text-sm">Loading...</div>;
  const o = current.data;
  function set<K extends string>(k: K, v: any) { setForm((p: any) => ({ ...p, [k]: v })); }

  return (
    <form onSubmit={e => { e.preventDefault(); update.mutate(form); }} className="space-y-6 max-w-2xl">
      <Section title="ORGANIZATION">
        <Field label="Name"><Input value={form.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Slug"><Input defaultValue={o.slug} disabled /></Field>
        <Field label="Plan"><Input defaultValue={o.plan} disabled /></Field>
        <Field label="Logo URL"><Input value={form.logo ?? ''} onChange={e => set('logo', e.target.value)} placeholder="https://your-cdn/logo.svg" /></Field>
      </Section>

      <Section title="BRANDING">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Brand Color">
            <div className="flex gap-2 items-center">
              <input type="color" value={form.brandColor ?? '#FF5500'} onChange={e => set('brandColor', e.target.value)} className="w-12 h-10 border-2 border-[var(--color-ink)]" />
              <Input value={form.brandColor ?? ''} onChange={e => set('brandColor', e.target.value)} placeholder="#FF5500" />
            </div>
          </Field>
          <Field label="Ink / Text Color">
            <div className="flex gap-2 items-center">
              <input type="color" value={form.brandSecondary ?? '#0A0A0A'} onChange={e => set('brandSecondary', e.target.value)} className="w-12 h-10 border-2 border-[var(--color-ink)]" />
              <Input value={form.brandSecondary ?? ''} onChange={e => set('brandSecondary', e.target.value)} placeholder="#0A0A0A" />
            </div>
          </Field>
        </div>
        <Field label="Custom Domain (Enterprise)">
          <Input value={form.customDomain ?? ''} onChange={e => set('customDomain', e.target.value)} placeholder="app.your-company.com" />
        </Field>
      </Section>

      <Section title="LOCALIZATION">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Currency"><Input value={form.currency ?? ''} onChange={e => set('currency', e.target.value)} /></Field>
          <Field label="Locale"><Input value={form.locale ?? ''} onChange={e => set('locale', e.target.value)} /></Field>
          <Field label="Timezone"><Input value={form.timezone ?? ''} onChange={e => set('timezone', e.target.value)} /></Field>
        </div>
      </Section>

      <Button type="submit" variant="primary" disabled={update.isPending}>
        {update.isPending ? 'SAVING...' : 'SAVE CHANGES'}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}
