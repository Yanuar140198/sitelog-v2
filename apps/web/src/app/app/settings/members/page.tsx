'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLES = ['owner', 'admin', 'estimator', 'scheduler', 'supervisor', 'viewer'] as const;

export default function MembersPage() {
  const members = trpc.org.members.useQuery();
  const invites = trpc.invite.list.useQuery();
  const utils = trpc.useUtils();
  const invite = trpc.invite.create.useMutation({
    onSuccess: () => { utils.invite.list.invalidate(); setEmail(''); },
  });
  const updateRole = trpc.invite.updateMemberRole.useMutation({
    onSuccess: () => utils.org.members.invalidate(),
  });
  const remove = trpc.invite.removeMember.useMutation({
    onSuccess: () => utils.org.members.invalidate(),
  });
  const revoke = trpc.invite.revoke.useMutation({
    onSuccess: () => utils.invite.list.invalidate(),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('viewer');

  return (
    <div className="space-y-6">
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">INVITE MEMBER</div>
        <form onSubmit={e => { e.preventDefault(); invite.mutate({ email, role }); }}
          className="p-5 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]"><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Role</Label>
            <select value={role} onChange={e => setRole(e.target.value as any)}
              className="px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button type="submit" variant="primary" disabled={invite.isPending}>INVITE</Button>
        </form>
      </div>

      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">ACTIVE MEMBERS</div>
        <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs min-w-[560px]">
          <thead><tr className="border-b border-neutral-200">
            <th className="text-left px-4 py-2">EMAIL</th><th className="text-left px-4 py-2">NAME</th>
            <th className="text-left px-4 py-2">ROLE</th><th className="text-right px-4 py-2"></th>
          </tr></thead>
          <tbody>{members.data?.map(m => (
            <tr key={m.id} className="border-b border-neutral-100">
              <td className="px-4 py-2">{m.user.email}</td>
              <td className="px-4 py-2">{m.user.name ?? '—'}</td>
              <td className="px-4 py-2">
                <select value={m.role} onChange={e => updateRole.mutate({ membershipId: m.id, role: e.target.value as any })}
                  className="px-2 py-1 border border-neutral-300 font-mono text-xs">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => confirm('Remove?') && remove.mutate({ membershipId: m.id })}
                  className="text-red-600 hover:underline">REMOVE</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </div>

      {(invites.data ?? []).filter(i => !i.acceptedAt).length > 0 && (
        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">PENDING INVITES</div>
          <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs min-w-[560px]">
            <tbody>{invites.data?.filter(i => !i.acceptedAt).map(i => (
              <tr key={i.id} className="border-b border-neutral-100">
                <td className="px-4 py-2">{i.email}</td>
                <td className="px-4 py-2 uppercase">{i.role}</td>
                <td className="px-4 py-2 text-neutral-500">Expires {new Date(i.expiresAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => revoke.mutate({ id: i.id })} className="text-red-600 hover:underline">REVOKE</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
