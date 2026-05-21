'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64);
}

function OnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('org') ?? '';
  const [name, setName] = useState(initial);
  const [slug, setSlug] = useState(slugify(initial));
  const create = trpc.org.create.useMutation({
    onSuccess: (org) => {
      if (typeof window !== 'undefined') localStorage.setItem('sl_org', org.id);
      router.push('/app');
    },
  });

  useEffect(() => { if (!slug) setSlug(slugify(name)); }, [name, slug]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mb-2">STEP 1 OF 2</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Set up your workspace.</h1>
        </div>
        <form onSubmit={e => { e.preventDefault(); create.mutate({ slug, name }); }} className="space-y-4">
          <div>
            <Label>Organization name</Label>
            <Input value={name} required onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>URL slug</Label>
            <Input value={slug} required pattern="[a-z0-9-]+"
              onChange={e => setSlug(e.target.value.toLowerCase())} />
            <p className="font-mono text-[10px] text-neutral-500 mt-1">app.sitelog.io/<strong>{slug || 'your-slug'}</strong></p>
          </div>
          {create.error && (
            <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono">
              {create.error.message}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={create.isPending} className="w-full">
            {create.isPending ? 'CREATING...' : 'CONTINUE →'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-mono text-sm">Loading...</div>}>
      <OnboardingForm />
    </Suspense>
  );
}
