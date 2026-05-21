'use client';
import { createAuthClient } from 'better-auth/react';

// Use same-origin /api path so cookies (SameSite=Lax) work cross-port.
// Next.js rewrites /api/auth/* → api server.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
    : window.location.origin,
});

export const { signIn, signUp, signOut, useSession } = authClient;
