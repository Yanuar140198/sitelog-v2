'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await signUp.email({ email, password, name });
      if ((res as any).error) {
        setError((res as any).error.message ?? 'Signup gagal'); return;
      }
      router.push(`/onboarding?org=${encodeURIComponent(orgName)}`);
    } catch (e: any) {
      setError(e.message ?? 'Signup gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mb-2">START FREE</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Create your org.</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">14-day trial. No card required.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)} />
          <p className="font-mono text-[10px] text-neutral-500 mt-1">Min 8 chars</p>
        </div>
        <div>
          <Label htmlFor="org">Company / Org name</Label>
          <Input id="org" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="PT Acme Construction" />
        </div>
        {error && <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono">{error}</div>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? 'CREATING...' : 'START TRIAL →'}
        </Button>
      </form>
      <div className="text-sm text-neutral-600 font-mono">
        Already have account? <Link href="/login" className="text-[var(--color-brand)] hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
