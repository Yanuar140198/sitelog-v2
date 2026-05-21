import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  storage: {
    getItem: (k: string) => SecureStore.getItemAsync(k),
    setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
    removeItem: (k: string) => SecureStore.deleteItemAsync(k),
  } as any,
});

export const { signIn, signOut, useSession } = authClient;
