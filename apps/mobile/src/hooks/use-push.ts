/**
 * Expo push notification registration hook.
 *
 * On app mount + after login, requests permission, gets Expo push token,
 * registers it with backend via tRPC.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { trpc } from '@sitelog/api-client/react';

async function getExpoPushToken(): Promise<string | null> {
  try {
    // @ts-expect-error optional dep — install expo-notifications when wiring
    const Notifications = await import('expo-notifications').catch(() => null);
    if (!Notifications) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (e) {
    console.warn('[push] expo-notifications not installed or error', e);
    return null;
  }
}

export function usePushRegistration() {
  const register = trpc.push.register.useMutation();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      register.mutate({
        kind: 'expo', token,
        deviceLabel: `${Platform.OS} ${Platform.Version}`,
      });
    })();
    return () => { cancelled = true; };
  }, []);
}
