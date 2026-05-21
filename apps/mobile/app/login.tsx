import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '@/lib/auth';

const I = {
  page: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, justifyContent: 'center' } as const,
  eyebrow: { color: '#FF5500', fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' } as const,
  h1: { fontSize: 32, fontWeight: '800', marginTop: 8, lineHeight: 36 } as const,
  label: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'monospace', marginTop: 16, marginBottom: 4, fontWeight: '700' } as const,
  input: { borderWidth: 2, borderColor: '#0A0A0A', padding: 12, fontFamily: 'monospace', fontSize: 14, backgroundColor: 'white' } as const,
  btn: { backgroundColor: '#FF5500', padding: 16, marginTop: 24, alignItems: 'center' } as const,
  btnText: { color: 'white', fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' } as const,
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await signIn.email({ email, password });
      if ((res as any).error) {
        Alert.alert('Login failed', (res as any).error.message ?? 'Unknown');
        return;
      }
      router.replace('/projects');
    } catch (e: any) {
      Alert.alert('Login failed', e.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={I.page}>
      <Text style={I.eyebrow}>SIGN IN</Text>
      <Text style={I.h1}>Welcome{'\n'}back.</Text>
      <Text style={I.label}>EMAIL</Text>
      <TextInput style={I.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Text style={I.label}>PASSWORD</Text>
      <TextInput style={I.input} value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={I.btn} onPress={submit} disabled={loading}>
        <Text style={I.btnText}>{loading ? 'SIGNING IN...' : 'SIGN IN →'}</Text>
      </Pressable>
    </View>
  );
}
