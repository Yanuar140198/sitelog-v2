import { View, Text, FlatList, Pressable } from 'react-native';
import { trpc } from '@sitelog/api-client/react';
import { useTheme } from '@/lib/theme';

export default function NotificationsScreen() {
  const { palette } = useTheme();
  const list = trpc.notification.list.useQuery({ limit: 50 });
  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => utils.notification.list.invalidate() });
  const markAll = trpc.notification.markAllRead.useMutation({ onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); } });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: 20, backgroundColor: palette.ink, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: palette.brand, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>INBOX</Text>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', marginTop: 4 }}>Notifications</Text>
        </View>
        <Pressable onPress={() => markAll.mutate()}>
          <Text style={{ color: palette.brand, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 }}>MARK ALL READ</Text>
        </Pressable>
      </View>

      <FlatList
        data={list.data ?? []}
        keyExtractor={n => n.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshing={list.isLoading}
        onRefresh={list.refetch}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40, color: palette.muted, fontFamily: 'monospace' }}>
            {list.isLoading ? 'Loading...' : 'No notifications'}
          </Text>
        }
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => {
              markRead.mutate({ id: n.id });
              // TODO: routeMap for n.href on mobile
            }}
            style={{
              backgroundColor: palette.panel, borderWidth: 2, borderColor: palette.border,
              padding: 14, opacity: n.readAt ? 0.6 : 1,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              {!n.readAt && (
                <View style={{ width: 8, height: 8, backgroundColor: palette.brand, marginTop: 6 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>{n.title}</Text>
                {n.body && <Text style={{ color: palette.muted, fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>{n.body}</Text>}
                <Text style={{ color: palette.muted, fontFamily: 'monospace', fontSize: 10, marginTop: 6 }}>
                  {new Date(n.createdAt).toLocaleString('id-ID')}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
