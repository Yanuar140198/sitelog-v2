'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileStack, Plus, Trash2, Search } from 'lucide-react';

const CATEGORIES = ['all', 'mining', 'civil_road', 'building', 'drainage', 'earthwork'];

export default function TemplatesPage() {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const list = trpc.boqTemplate.list.useQuery(cat === 'all' ? undefined : { category: cat });
  const utils = trpc.useUtils();
  const del = trpc.boqTemplate.delete.useMutation({ onSuccess: () => utils.boqTemplate.list.invalidate() });
  const create = trpc.boqTemplate.create.useMutation({ onSuccess: () => { utils.boqTemplate.list.invalidate(); setShow(false); } });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', scopes: '' });

  const filtered = (list.data ?? []).filter(t => !q || (t.name + ' ' + (t.description ?? '')).toLowerCase().includes(q.toLowerCase()));
  const orgItems = filtered.filter(t => t.organizationId);
  const publicItems = filtered.filter(t => !t.organizationId);

  function submitCreate() {
    let scopes: any[] = [];
    try { scopes = JSON.parse(form.scopes); } catch { alert('Scopes must be valid JSON array: [{ahspKode, defaultQty, note}]'); return; }
    create.mutate({ name: form.name, description: form.description, category: form.category, scopes });
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">SCAFFOLDS</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Template Library</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">{publicItems.length} public · {orgItems.length} org-custom</p>
        </div>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> NEW TEMPLATE</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Search</Label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-3 text-neutral-400" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="name or description" className="pl-7" />
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {publicItems.length > 0 && (
        <Section title={`PUBLIC TEMPLATES (${publicItems.length})`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {publicItems.map(t => <Card key={t.id} t={t} isOrg={false} onDel={() => {}} />)}
          </div>
        </Section>
      )}

      <Section title={`ORG TEMPLATES (${orgItems.length})`}>
        {orgItems.length === 0
          ? <div className="text-center py-12 text-neutral-500 font-mono text-xs">No org templates. Save from a project BOQ or create new.</div>
          : <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {orgItems.map(t => <Card key={t.id} t={t} isOrg={true} onDel={() => confirm('Delete template?') && del.mutate({ id: t.id })} />)}
            </div>}
      </Section>

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-4 md:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">New Template</h2>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="mining / civil_road" /></div>
              <div>
                <Label>Scopes JSON</Label>
                <textarea value={form.scopes} onChange={e => setForm(p => ({ ...p, scopes: e.target.value }))}
                  rows={6} placeholder='[{"ahspKode":"CL-LC-001","defaultQty":0,"note":""}]'
                  className="w-full px-3 py-2 border-2 border-[var(--color-ink)] font-mono text-xs" />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={submitCreate} variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button onClick={() => setShow(false)}>CANCEL</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ t, isOrg, onDel }: { t: any; isOrg: boolean; onDel: () => void }) {
  const scopeCount = (() => { try { return JSON.parse(t.items).length; } catch { return 0; } })();
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white p-4 hover:shadow-[3px_3px_0_var(--color-brand)] transition">
      <div className="flex justify-between items-start">
        <FileStack size={18} className="text-[var(--color-brand)]" />
        {isOrg && (
          <button onClick={onDel} className="p-1 text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
        )}
      </div>
      <h3 className="font-display text-base font-bold mt-2">{t.name}</h3>
      <p className="font-mono text-xs text-neutral-600 mt-1 line-clamp-2">{t.description ?? '—'}</p>
      <div className="mt-3 flex gap-2 flex-wrap">
        {t.category && <span className="bg-[var(--color-brand)] text-white px-2 py-0.5 font-mono text-[9px] font-bold">{t.category.toUpperCase()}</span>}
        <span className="bg-neutral-100 border border-[var(--color-ink)] px-2 py-0.5 font-mono text-[9px] font-bold">{scopeCount} SCOPES</span>
        {!isOrg && <span className="bg-neutral-200 px-2 py-0.5 font-mono text-[9px] font-bold">PUBLIC</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-xs tracking-[0.15em] font-bold text-neutral-600 mb-3">{title}</div>
      {children}
    </div>
  );
}
