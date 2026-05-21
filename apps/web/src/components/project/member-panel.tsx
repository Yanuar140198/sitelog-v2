'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, UserPlus, Trash2 } from 'lucide-react';

export function ProjectMemberPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const list = trpc.projectMember.list.useQuery({ projectId });
  const orgMembers = trpc.org.members.useQuery();
  const utils = trpc.useUtils();
  const assign = trpc.projectMember.assign.useMutation({ onSuccess: () => utils.projectMember.list.invalidate({ projectId }) });
  const unassign = trpc.projectMember.unassign.useMutation({ onSuccess: () => utils.projectMember.list.invalidate({ projectId }) });
  const [userId, setUserId] = useState('');
  const [roleOnProject, setRoleOnProject] = useState('Supervisor');

  const assignedIds = new Set((list.data ?? []).map(a => a.userId));
  const available = (orgMembers.data ?? []).filter(m => !assignedIds.has(m.userId));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] w-full max-w-2xl max-h-[85vh] overflow-auto shadow-[8px_8px_0_var(--color-brand)]">
        <div className="bg-[var(--color-ink)] text-white p-5 flex justify-between items-start">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] font-bold">ACCESS</div>
            <h2 className="font-display text-xl font-bold mt-1">Project Members</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20"><X size={20} /></button>
        </div>

        <div className="p-5 border-b border-neutral-200 bg-neutral-50">
          <form onSubmit={e => { e.preventDefault(); if (!userId) return; assign.mutate({ projectId, userId, roleOnProject }); setUserId(''); }}
            className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <Label>Add member</Label>
              <select value={userId} onChange={e => setUserId(e.target.value)} required
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                <option value="">— pilih —</option>
                {available.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.email} ({m.role})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Role on project</Label>
              <Input value={roleOnProject} onChange={e => setRoleOnProject(e.target.value)} placeholder="Supervisor" />
            </div>
            <Button type="submit" variant="primary" disabled={assign.isPending}><UserPlus size={14} /> ASSIGN</Button>
          </form>
        </div>

        <div className="p-5">
          {(list.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-neutral-500 font-mono text-sm">No members assigned. Supervisors with no assignment cannot see this project.</div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider">EMAIL</th>
                  <th className="text-left px-3 py-2 tracking-wider">NAME</th>
                  <th className="text-left px-3 py-2 tracking-wider">ROLE</th>
                  <th className="text-left px-3 py-2 tracking-wider">ASSIGNED</th>
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map(m => (
                  <tr key={m.id} className="border-b border-neutral-100">
                    <td className="px-3 py-2">{m.email}</td>
                    <td className="px-3 py-2">{m.name ?? '—'}</td>
                    <td className="px-3 py-2">{m.roleOnProject ?? '—'}</td>
                    <td className="px-3 py-2 text-neutral-500">{new Date(m.assignedAt).toLocaleDateString('id-ID')}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => confirm('Unassign?') && unassign.mutate({ assignmentId: m.id })}
                        className="p-1 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
