// Employee Messages: refreshed every time the user opens it (acceptance P).
// Includes messages older than 24 hours. Rows never mark a message seen.
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
          title={`${item.source_label} · ${formatDarwin(item.created_at)}`}
          subtitle={item.body}
          unseen={!seen.has(item.id)}
          onPress={() => router.push({ pathname: '/message/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}
