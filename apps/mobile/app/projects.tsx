import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '@sitelog/api-client/react';
import { useOfflineSync } from '@/hooks/use-offline-sync';

export default function ProjectsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = trpc.project.list.useQuery();
  const { queueSize, isFlushing } = useOfflineSync();

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      <View style={{ padding: 20, backgroundColor: '#0A0A0A' }}>
        <Text style={{ color: '#FF5500', fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>PROJECTS</Text>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', marginTop: 4 }}>Pick a project</Text>
        {queueSize > 0 && (
          <View style={{ marginTop: 8, padding: 6, backgroundColor: '#FF5500' }}>
            <Text style={{ color: 'white', fontFamily: 'monospace', fontSize: 11 }}>
              {isFlushing ? '⟳ SYNCING...' : `↑ ${queueSize} ENTRY QUEUED OFFLINE`}
            </Text>
          </View>
        )}
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={p => p.id}
        refreshing={isRefetching || isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#888', fontFamily: 'monospace' }}>
            {isLoading ? 'Loading...' : 'No projects assigned'}
          </Text>
        }
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() => router.push(`/entry/new?projectId=${p.id}` as any)}
            style={{ backgroundColor: 'white', borderWidth: 2, borderColor: '#0A0A0A', padding: 16 }}
          >
            <Text style={{ fontFamily: 'monospace', color: '#FF5500', fontWeight: '700', fontSize: 11 }}>{p.code}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 4 }}>{p.name}</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', marginTop: 4 }}>
              {p.client ?? '—'} · {p.status}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
