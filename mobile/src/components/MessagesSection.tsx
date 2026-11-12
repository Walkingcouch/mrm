// Employee Messages: refreshed every time the user opens it (acceptance P).
// Includes messages older than 24 hours. Rows never mark a message seen.
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { loadMessages, type MessageRow } from '@/lib/api';
import { seenMessages } from '@/lib/seen';
import { formatDarwin } from '@/lib/time';
import { colors } from '@/lib/theme';
import { Loading, Notice, Row } from './ui';

export function MessagesSection() {
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, s] = await Promise.all([loadMessages(), seenMessages.all()]);
      setMessages(m); setSeen(s); setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // "Mark all as read" (double tick, top right): clears every red dot at once. Only shown while
  // something is unread; it never opens or shows a message by itself.
  const navigation = useNavigation();
  const unread = (messages ?? []).filter((m) => !seen.has(m.id));
  const markAll = useCallback(async () => {
    if (!messages) return;
    await seenMessages.addMany(messages.map((m) => m.id)).catch(() => 0);
    setSeen(await seenMessages.all());
  }, [messages]);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: unread.length
        ? () => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Mark all ${unread.length} messages as read`}
            hitSlop={12} onPress={markAll} style={{ paddingHorizontal: 12, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="check-all" size={28} color={colors.tealText} />
          </Pressable>
        )
        : undefined,
    });
  }, [navigation, unread.length, markAll]);
  // The section screen is shared by all menu items: remove the button when leaving.
  useLayoutEffect(() => () => navigation.setOptions({ headerRight: undefined }), [navigation]);

  if (!messages) {
    return error
      ? <Notice title="Can't load messages" body="Check your connection and try again." actionLabel="Try again" onAction={load} />
      : <Loading label="Loading messages…" />;
  }
  return (
    <FlatList
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={messages.length ? undefined : { flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
      ListEmptyComponent={<Notice title="No messages" />}
      renderItem={({ item }) => (
        <Row
          title={item.source_label}
          subtitle={`${formatDarwin(item.created_at)}\n${item.body}`}
          icon="email-outline"
          unseen={!seen.has(item.id)}
          onPress={() => router.push({ pathname: '/message/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}
