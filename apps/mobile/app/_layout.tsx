import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TrpcProvider } from '@sitelog/api-client/react';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { usePushRegistration } from '@/hooks/use-push';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function ThemedNavigator() {
  const { resolved, palette } = useTheme();
  usePushRegistration();
  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: palette.ink },
        headerTintColor: resolved === 'dark' ? palette.bg : '#fff',
        contentStyle: { backgroundColor: palette.bg },
      }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TrpcProvider
        baseUrl={API_URL}
        getToken={() => SecureStore.getItemAsync('sl_token')}
        getOrgId={() => SecureStore.getItemAsync('sl_org')}
      >
        <ThemedNavigator />
      </TrpcProvider>
    </ThemeProvider>
  );
}
