'use client';
import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const accept = trpc.invite.accept.useMutation({
    onSuccess: (res) => {
      if (typeof window !== 'undefined') localStorage.setItem('sl_org', res.organizationId);
      router.push('/app');
    },
  });

  useEffect(() => {
    if (!session) router.push(`/login?next=/invite/${token}`);
  }, [session, router, token]);

  if (!session) return null;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border-2 border-[var(--color-ink)] bg-white p-8 shadow-[8px_8px_0_var(--color-brand)]">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">INVITATION</p>
        <h1 className="font-display text-3xl font-bold mt-2">You've been invited.</h1>
        <p className="font-mono text-sm text-neutral-600 mt-4">
          Accept invitation as <strong>{session.user.email}</strong>.
        </p>
        {accept.error && (
          <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono mt-4">
            {accept.error.message}
          </div>
        )}
        <Button variant="primary" size="lg" disabled={accept.isPending}
          onClick={() => accept.mutate({ token })} className="w-full mt-6">
          {accept.isPending ? 'ACCEPTING...' : 'ACCEPT INVITATION →'}
        </Button>
      </div>
    </div>
  );
}
