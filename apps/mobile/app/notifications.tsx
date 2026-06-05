import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { trpc } from '@sitelog/api-client/react';
import { useTheme } from '@/lib/theme';

/**
 * Map a web notification href (e.g. /app/projects/123) to the closest screen
 * that exists in the mobile app. Returns null when there's no mobile equivalent
 * (the notification is still marked read, just no navigation).
 */
type MobileHref = '/projects' | '/maintenance' | '/notifications' | '/settings';
function mobileRoute(href?: string | null): MobileHref | null {
  if (!href) return null;
  if (href.startsWith('/app/maintenance')) return '/maintenance';
  if (href.startsWith('/app/projects') || href.startsWith('/app/entries')) return '/projects';
  if (href.startsWith('/app/notifications')) return '/notifications';
  if (href.startsWith('/app/settings')) return '/settings';
  return null;
}

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
              const dest = mobileRoute(n.href);
              if (dest) router.push(dest);
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
