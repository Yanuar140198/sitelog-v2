import { View, Text, FlatList, Pressable } from 'react-native';
import { trpc } from '@sitelog/api-client/react';
import { useTheme } from '@/lib/theme';

export default function MaintenanceScreen() {
  const { palette } = useTheme();
  const upcoming = trpc.maintenance.upcoming.useQuery({ horizonDays: 30 });
  const complete = trpc.maintenance.markCompleted.useMutation({
    onSuccess: () => upcoming.refetch(),
  });

  const rows = upcoming.data ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: 20, backgroundColor: palette.ink }}>
        <Text style={{ color: palette.brand, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>FLEET</Text>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', marginTop: 4 }}>Maintenance</Text>
        <Text style={{ color: palette.muted, fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>{rows.length} upcoming · 30 days</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshing={upcoming.isLoading}
        onRefresh={upcoming.refetch}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40, color: palette.muted, fontFamily: 'monospace' }}>
            {upcoming.isLoading ? 'Loading...' : 'No scheduled maintenance'}
          </Text>
        }
        renderItem={({ item }) => {
          const overdue = item.m.dueAtDate && new Date(item.m.dueAtDate) < new Date();
          return (
            <View style={{
              backgroundColor: palette.panel, borderWidth: 2,
              borderColor: overdue ? '#dc2626' : palette.border,
              padding: 14,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.brand, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' }}>
                    {item.unitNomor} · {item.unitJenis ?? ''}
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', marginTop: 4 }}>{item.m.title}</Text>
                  <Text style={{ color: palette.muted, fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>
                    {(item.m.kind ?? '').toString().toUpperCase()} · {item.m.dueAtDate ? new Date(item.m.dueAtDate).toLocaleDateString('id-ID') : ''}
                    {item.m.dueAtHm ? ` · ${item.m.dueAtHm} HM` : ''}
                  </Text>
                </View>
                {overdue && (
                  <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: 'white', fontFamily: 'monospace', fontSize: 9, fontWeight: '800' }}>OVERDUE</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => complete.mutate({ id: item.m.id })}
                style={{ marginTop: 10, padding: 8, backgroundColor: palette.brand, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontFamily: 'monospace', letterSpacing: 1, fontWeight: '700' }}>MARK COMPLETED</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
