/**
 * Photo capture + upload screen.
 * Flow: take photo with camera → compress → presign R2 URL → PUT bytes → register storageKey
 * with parent entry (via context-passed projectId & entryId).
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '@sitelog/api-client/react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

interface Captured {
  uri: string;
  storageKey: string;
  caption?: string;
  lat?: number;
  lng?: number;
}

export default function PhotosScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [photos, setPhotos] = useState<Captured[]>([]);
  const [uploading, setUploading] = useState(false);
  const presign = trpc.storage.presignUpload.useMutation();

  async function capture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission denied'); return; }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      exif: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];

    setUploading(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      } catch {}

      const presigned = await presign.mutateAsync({
        projectId,
        contentType: 'image/jpeg',
        ext: 'jpg',
      });

      if (!presigned.stub) {
        const file = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const bin = Uint8Array.from(atob(file), c => c.charCodeAt(0));
        await fetch(presigned.url, {
          method: 'PUT',
          headers: { 'content-type': 'image/jpeg' },
          body: bin,
        });
      }

      setPhotos(p => [...p, { uri: asset.uri, storageKey: presigned.storageKey, lat, lng }]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  function done() {
    router.back();
    router.setParams({ photoKeys: JSON.stringify(photos.map(p => ({ storageKey: p.storageKey, lat: p.lat, lng: p.lng, caption: p.caption }))) } as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      <View style={{ padding: 16, backgroundColor: '#0A0A0A' }}>
        <Text style={{ color: '#FF5500', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>PHOTOS</Text>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{photos.length} captured</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {photos.map((p, i) => (
          <View key={i} style={{ borderWidth: 2, borderColor: '#0A0A0A', backgroundColor: 'white' }}>
            <Image source={{ uri: p.uri }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
            <Text style={{ padding: 8, fontFamily: 'monospace', fontSize: 10, color: '#666' }}>
              {p.storageKey.slice(-20)} {p.lat ? `· ${p.lat.toFixed(4)},${p.lng?.toFixed(4)}` : ''}
            </Text>
          </View>
        ))}

        <Pressable onPress={capture} disabled={uploading}
          style={{ backgroundColor: '#FF5500', padding: 18, alignItems: 'center', opacity: uploading ? 0.5 : 1 }}>
          <Text style={{ color: 'white', fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' }}>
            {uploading ? 'UPLOADING...' : '+ TAKE PHOTO'}
          </Text>
        </Pressable>

        <Pressable onPress={done}
          style={{ backgroundColor: '#0A0A0A', padding: 16, alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: 'white', fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' }}>DONE →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
