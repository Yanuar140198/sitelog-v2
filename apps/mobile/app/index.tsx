import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF7', padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'monospace', color: '#FF5500', fontSize: 11, letterSpacing: 2 }}>
        SITELOG · MOBILE
      </Text>
      <Text style={{ fontSize: 36, fontWeight: '800', marginTop: 8, lineHeight: 40 }}>
        Daily reports{'\n'}from the field.
      </Text>
      <Text style={{ color: '#525252', marginTop: 12, lineHeight: 22 }}>
        Submit production, equipment HM, fuel + photos. Offline-first, syncs when online.
      </Text>
      <Link href="/login" asChild>
        <Pressable style={{ backgroundColor: '#0A0A0A', padding: 16, marginTop: 32, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontFamily: 'monospace', letterSpacing: 1.5 }}>SIGN IN</Text>
        </Pressable>
      </Link>
    </View>
  );
}
