// Employee Messages: refreshed every time the user opens it (acceptance P).
// Includes messages older than 24 hours. Rows never mark a message seen.
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, Text, View, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { cachedMessages, loadMessages, SAMPLE_MODE, supabase, type MessageRow } from '@/lib/api';
import { messagesChanged } from '@/lib/messages-live';
import { seenMessages } from '@/lib/seen';
import { formatDarwin } from '@/lib/time';
import { colors, fonts } from '@/lib/theme';
import { Loading, Notice, Row } from './ui';

/**
 * Double tick, top right. A small "Mark all as read" label appears while a
 * mouse hovers over it, or when it is pressed and held on a phone. A normal
 * tap marks everything as read.
 */
function MarkAllReadButton({ count, onPress }: { count: number; onPress: () => void }) {
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(false), 2000);
    return () => clearTimeout(t);
  }, [tip]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {tip ? (
        <View pointerEvents="none" style={{ backgroundColor: colors.headerText, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 2 }}>
          <Text style={{ color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 14 }}>Mark all as read</Text>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Mark all ${count} messages as read`}
        accessibilityHint="Clears the red dots. Messages stay in the list."
        hitSlop={12} onPress={onPress} onLongPress={() => setTip(true)} delayLongPress={300}
        onHoverIn={() => setTip(true)} onHoverOut={() => setTip(false)}
        style={{ paddingHorizontal: 12, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="check-all" size={28} color={colors.tealText} />
      </Pressable>
    </View>
  );
}

export function MessagesSection() {
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Show the last list straight away (it is replaced by the live list a moment later).
  useEffect(() => {
    let on = true;
    Promise.all([cachedMessages(), seenMessages.all()]).then(([m, s]) => {
      if (on && m) { setMessages((cur) => cur ?? m); setSeen((cur) => (cur.size ? cur : s)); }
    }).catch(() => {});
    return () => { on = false; };
  }, []);

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

  // While this screen is open, new messages appear by themselves: on the
  // database's "changed" broadcast, when a push arrives, when the app comes
  // back to the foreground, and every minute as a fallback.
  const reloadQuietly = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([loadMessages(), seenMessages.all()]);
      setMessages(m); setSeen(s); setError(false);
    } catch { /* keep showing what we have */ }
  }, []);
  useFocusEffect(useCallback(() => {
    const offPush = messagesChanged.subscribe(reloadQuietly);
    const appState = AppState.addEventListener('change', (st) => { if (st === 'active') reloadQuietly(); });
    const timer = setInterval(reloadQuietly, 60_000);
    // (Web demo: DemoNotifications listens instead and emits messagesChanged.)
    const channel = SAMPLE_MODE || Platform.OS === 'web' ? null
      : supabase.channel('employee-messages').on('broadcast', { event: 'changed' }, () => { reloadQuietly(); }).subscribe();
    return () => {
      offPush(); appState.remove(); clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [reloadQuietly]));

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
        ? () => <MarkAllReadButton count={unread.length} onPress={markAll} />
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
