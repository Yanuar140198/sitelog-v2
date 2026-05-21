import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '@sitelog/api-client/react';
import * as Location from 'expo-location';
import { enqueue } from '@/lib/offline-queue';

const I = {
  label: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 4, marginTop: 12, fontWeight: '700' } as const,
  input: { borderWidth: 2, borderColor: '#0A0A0A', padding: 10, fontFamily: 'monospace', fontSize: 14, backgroundColor: 'white' } as const,
};

export default function NewEntry() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [hours, setHours] = useState('9');
  const [workforce, setWorkforce] = useState('');
  const [notes, setNotes] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actQty, setActQty] = useState('');

  const submit = trpc.entry.submit.useMutation({
    onSuccess: () => {
      Alert.alert('Submitted', 'Daily entry tersimpan');
      router.back();
    },
    onError: (e, vars) => {
      // Queue for offline sync
      enqueue(vars);
      Alert.alert('Queued offline', `Entry saved locally. Will sync when reconnected.\nReason: ${e.message}`);
      router.back();
    },
  });

  async function send() {
    let lat: number | undefined, lng: number | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync();
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
    } catch {}
    submit.mutate({
      projectId,
      entryDate: date,
      shift,
      effectiveHours: Number(hours) || undefined,
      workforce: Number(workforce) || undefined,
      notes,
      lat, lng,
      appVersion: '0.1.0',
      activities: actDesc ? [{ description: actDesc, quantity: Number(actQty) || 0 }] : [],
      equipment: [], photoKeys: [],
    });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FAFAF7' }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ color: '#FF5500', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>DAILY ENTRY</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 4 }}>New report</Text>

      <Text style={I.label}>DATE</Text>
      <TextInput style={I.input} value={date} onChangeText={setDate} />

      <Text style={I.label}>SHIFT</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['day', 'night'] as const).map(s => (
          <Pressable key={s} onPress={() => setShift(s)}
            style={{ flex: 1, padding: 12, borderWidth: 2, borderColor: '#0A0A0A', backgroundColor: shift === s ? '#0A0A0A' : 'white' }}>
            <Text style={{ textAlign: 'center', color: shift === s ? 'white' : '#0A0A0A', fontFamily: 'monospace', letterSpacing: 1 }}>
              {s.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={I.label}>EFFECTIVE HOURS</Text>
      <TextInput style={I.input} value={hours} onChangeText={setHours} keyboardType="numeric" />

      <Text style={I.label}>WORKFORCE</Text>
      <TextInput style={I.input} value={workforce} onChangeText={setWorkforce} keyboardType="numeric" />

      <Text style={I.label}>NOTES</Text>
      <TextInput style={[I.input, { height: 80 }]} value={notes} onChangeText={setNotes} multiline />

      <Text style={{ marginTop: 24, fontSize: 12, fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700', color: '#FF5500' }}>+ ACTIVITY</Text>
      <Text style={I.label}>DESCRIPTION</Text>
      <TextInput style={I.input} value={actDesc} onChangeText={setActDesc} placeholder="Cut soil station 0+200" />
      <Text style={I.label}>QUANTITY (m³)</Text>
      <TextInput style={I.input} value={actQty} onChangeText={setActQty} keyboardType="numeric" />

      <Pressable onPress={send} disabled={submit.isPending}
        style={{ backgroundColor: '#FF5500', padding: 16, marginTop: 24, alignItems: 'center', opacity: submit.isPending ? 0.5 : 1 }}>
        <Text style={{ color: 'white', fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' }}>
          {submit.isPending ? 'SUBMITTING...' : 'SUBMIT ENTRY →'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
