'use client';
import { trpc } from '@sitelog/api-client/react';

/**
 * Returns true if the flag is enabled for the current org.
 * Always returns `false` while loading or on error (fail-safe disabled).
 */
export function useFeatureFlag(key: string): boolean {
  const flags = trpc.featureFlag.resolveAll.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,  // 5 min — flags change rarely
  });
  if (!flags.data) return false;
  const found = flags.data.find(f => f.key === key);
  return found?.enabled ?? false;
}

/**
 * Returns full flag state including override info.
 * Useful for UI that needs to show "overridden for this org" badge.
 */
export function useFeatureFlagDetail(key: string) {
  const flags = trpc.featureFlag.resolveAll.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });
  return flags.data?.find(f => f.key === key) ?? null;
}
