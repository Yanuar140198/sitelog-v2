'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, FileStack, Plus, Save } from 'lucide-react';

export function TemplateBrowser({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const templates = trpc.boqTemplate.list.useQuery();
  const utils = trpc.useUtils();
  const apply = trpc.boqTemplate.applyToProject.useMutation({
    onSuccess: (r) => {
      utils.boq.list.invalidate({ projectId });
      alert(`Applied: ${r.added} added, ${r.missing} missing`);
      onClose();
    },
  });
  const save = trpc.boqTemplate.saveFromProject.useMutation({
    onSuccess: () => { utils.boqTemplate.list.invalidate(); setSaveOpen(false); setName(''); },
  });
  const del = trpc.boqTemplate.delete.useMutation({ onSuccess: () => utils.boqTemplate.list.invalidate() });
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-2xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">SCAFFOLDS</div>
            <h2 className="font-display text-xl font-bold mt-1">BOQ Templates</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5 border-b border-neutral-200 bg-neutral-50">
          {!saveOpen ? (
            <Button onClick={() => setSaveOpen(true)} variant="primary"><Save size={14} /> SAVE CURRENT BOQ AS TEMPLATE</Button>
          ) : (
            <form onSubmit={e => { e.preventDefault(); save.mutate({ projectId, name, description, category }); }} className="space-y-2">
              <div><Label>Name *</Label><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Mining DT Standard Setup" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><Label>Category</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="mining" /></div>
                <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={save.isPending}>SAVE</Button>
                <Button type="button" onClick={() => setSaveOpen(false)}>CANCEL</Button>
              </div>
            </form>
          )}
        </div>

        <div className="p-5 space-y-2">
          {(templates.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-neutral-500 font-mono text-sm">No templates yet.</div>
          ) : templates.data?.map(t => (
            <div key={t.id} className="border-2 border-[var(--color-ink)] p-4 flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileStack size={14} className="text-[var(--color-brand)]" />
                  <strong className="font-display text-sm">{t.name}</strong>
                  {!t.organizationId && <span className="bg-neutral-200 px-2 py-0.5 text-[9px] font-bold">PUBLIC</span>}
                  {t.category && <span className="bg-[var(--color-brand)] text-white px-2 py-0.5 text-[9px] font-bold">{t.category.toUpperCase()}</span>}
                </div>
                {t.description && <div className="font-mono text-xs text-neutral-600 mt-1">{t.description}</div>}
              </div>
              <div className="flex gap-1">
                <Button onClick={() => apply.mutate({ templateId: t.id, projectId })}
                  disabled={apply.isPending} variant="primary"><Plus size={12} /> APPLY</Button>
                {t.organizationId && <button onClick={() => confirm('Delete?') && del.mutate({ id: t.id })} className="p-2 text-red-600 hover:bg-red-50"><X size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
