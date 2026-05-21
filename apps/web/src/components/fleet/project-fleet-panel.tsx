'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';

const ROLES = ['primary', 'backup', 'standby', 'spare'] as const;

export function ProjectFleetPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const units = trpc.fleet.unitList.useQuery();
  const assignments = trpc.fleet.assignments.useQuery({ projectId });
  const utils = trpc.useUtils();
  const assign = trpc.fleet.assign.useMutation({
    onSuccess: () => { utils.fleet.assignments.invalidate({ projectId }); reset(); },
  });
  const unassign = trpc.fleet.unassign.useMutation({
    onSuccess: () => utils.fleet.assignments.invalidate({ projectId }),
  });
  const [unitId, setUnitId] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('primary');
  const [note, setNote] = useState('');
  function reset() { setUnitId(''); setRole('primary'); setNote(''); }

  // Build lookup for display
  const unitMap = new Map((units.data ?? []).map(u => [u.id, u]));

  // Unassigned units only in dropdown
  const assignedIds = new Set((assignments.data ?? []).map((a: any) => a.unitId));
  const availableUnits = (units.data ?? []).filter(u => !assignedIds.has(u.id));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-3xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">EQUIPMENT</div>
            <h2 className="font-display text-xl font-bold mt-1">Fleet Plan</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5 border-b border-neutral-200 bg-neutral-50">
          <form onSubmit={e => { e.preventDefault(); if (!unitId) return; assign.mutate({ projectId, unitId, role, note: note || undefined }); }}
            className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
            <div>
              <Label>Unit</Label>
              <select value={unitId} onChange={e => setUnitId(e.target.value)} required
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                <option value="">— pilih unit —</option>
                {availableUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.nomor} · {u.jenisAlat ?? ''} · {u.vendor ?? ''}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Role</Label>
              <select value={role} onChange={e => setRole(e.target.value as any)}
                className="px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <Label>Note</Label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="optional"
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm" />
            </div>
            <Button type="submit" variant="primary" disabled={assign.isPending || !unitId}>
              <Plus size={14} /> ASSIGN
            </Button>
          </form>
        </div>

        <div className="p-5">
          {(assignments.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-neutral-500 font-mono text-sm">No units assigned yet.</div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider">NOMOR</th>
                  <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                  <th className="text-left px-3 py-2 tracking-wider">VENDOR</th>
                  <th className="text-left px-3 py-2 tracking-wider">ROLE</th>
                  <th className="text-left px-3 py-2 tracking-wider">NOTE</th>
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {(assignments.data ?? []).map((a: any) => {
                  const u = unitMap.get(a.unitId);
                  return (
                    <tr key={a.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{u?.nomor ?? a.unitId.slice(0, 8)}</td>
                      <td className="px-3 py-2">{u?.jenisAlat ?? '—'}</td>
                      <td className="px-3 py-2">{u?.vendor ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold ${a.role === 'primary' ? 'bg-[var(--color-brand)] text-white' : 'bg-neutral-200'}`}>
                          {a.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{a.note ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => confirm('Unassign?') && unassign.mutate({ projectId, unitId: a.unitId })}
                          className="p-1 text-red-600 hover:bg-red-50"><X size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(assignments.data ?? []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(() => {
                const byType = new Map<string, number>();
                for (const a of assignments.data ?? []) {
                  const t = (unitMap.get((a as any).unitId)?.jenisAlat) ?? '—';
                  byType.set(t, (byType.get(t) ?? 0) + 1);
                }
                return [...byType.entries()].map(([t, c]) => (
                  <span key={t} className="bg-neutral-100 border border-[var(--color-ink)] px-2 py-1 font-mono text-xs">
                    <strong>{t}</strong> × {c}
                  </span>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
