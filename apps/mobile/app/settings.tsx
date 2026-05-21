/**
 * Mobile settings — theme + signout + queue stats.
 */
import { View, Text, Pressable } from 'react-native';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { signOut } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useOfflineSync } from '@/hooks/use-offline-sync';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'LIGHT' },
  { value: 'dark', label: 'DARK' },
  { value: 'system', label: 'SYSTEM' },
];

export default function SettingsScreen() {
  const { mode, setMode, palette } = useTheme();
  const router = useRouter();
  const { queueSize, triggerFlush, isFlushing } = useOfflineSync();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 20 }}>
      <Text style={{ color: palette.brand, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>SETTINGS</Text>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>Preferences</Text>

      <Text style={{ color: palette.text, marginTop: 32, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>APPEARANCE</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {MODES.map(m => (
          <Pressable key={m.value} onPress={() => setMode(m.value)}
            style={{ flex: 1, padding: 14, borderWidth: 2, borderColor: palette.border,
              backgroundColor: mode === m.value ? palette.ink : palette.panel }}>
            <Text style={{ textAlign: 'center', fontFamily: 'monospace', letterSpacing: 1, fontWeight: '700',
              color: mode === m.value ? palette.bg : palette.text }}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: palette.text, marginTop: 32, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>OFFLINE QUEUE</Text>
      <View style={{ marginTop: 8, padding: 14, borderWidth: 2, borderColor: palette.border, backgroundColor: palette.panel }}>
        <Text style={{ color: palette.text, fontFamily: 'monospace', fontSize: 14 }}>
          {queueSize} entry queued · {isFlushing ? 'syncing...' : 'idle'}
        </Text>
        {queueSize > 0 && (
          <Pressable onPress={triggerFlush}
            style={{ marginTop: 10, padding: 10, backgroundColor: palette.brand }}>
            <Text style={{ color: 'white', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 1 }}>SYNC NOW</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={async () => { await signOut(); router.replace('/login'); }}
        style={{ marginTop: 32, padding: 16, borderWidth: 2, borderColor: '#dc2626', backgroundColor: palette.panel }}>
        <Text style={{ color: '#dc2626', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 1, fontWeight: '700' }}>SIGN OUT</Text>
      </Pressable>
    </View>
  );
}
