'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await signIn.email({ email, password });
      if ((res as any).error) {
        setError((res as any).error.message ?? 'Login gagal');
        return;
      }
      router.push('/app');
    } catch (e: any) {
      setError(e.message ?? 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mb-2">SIGN IN</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back.</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="bg-red-50 border-2 border-red-600 text-red-700 px-3 py-2 text-sm font-mono">{error}</div>}
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
          {loading ? 'SIGNING IN...' : 'SIGN IN →'}
        </Button>
      </form>
      <div className="text-sm text-neutral-600 font-mono">
        New here? <Link href="/signup" className="text-[var(--color-brand)] hover:underline">Create account</Link>
      </div>
    </div>
  );
}
