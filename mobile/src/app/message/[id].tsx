// Message detail. Opened only by the user (from the list or by tapping a
// push). Marked seen only once the content has actually rendered — a failed
// fetch or render never marks it seen (acceptance O).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { loadMessage, publicFileUrl, type Attachment, type MessageRow } from '@/lib/api';
import { seenMessages } from '@/lib/seen';
import { formatDarwin } from '@/lib/time';
import { colors, fonts } from '@/lib/theme';
import { Loading, Notice, Row } from '@/components/ui';
import { openEntry } from '@/components/EntryList';
import { useContent } from '@/lib/content-context';
import { ImagePreview } from '@/components/ImagePreview';

export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ message: MessageRow; attachments: Attachment[] } | 'missing' | 'error' | null>(null);
  const marked = useRef(false);
  const { snapshot, refresh } = useContent();
  const refreshedForLink = useRef(false);
  const linkId = state && typeof state === 'object' ? state.message.link_node_id ?? null : null;
  const linked = linkId ? snapshot?.entries.find((e) => e.id === linkId) : undefined;
  // A just-added item may not be in this phone's copy of the menu yet: fetch it once.
  useEffect(() => {
    if (linkId && snapshot && !linked && !refreshedForLink.current) { refreshedForLink.current = true; refresh(); }
  }, [linkId, snapshot, linked, refresh]);

  const load = useCallback(() => {
    setState(null);
    loadMessage(id).then((r) => setState(r ?? 'missing')).catch(() => setState('error'));
  }, [id]);
  useEffect(load, [load]);

  if (state === null) return <Loading />;
  if (state === 'error') return <Notice title="Can't load this message" body="Check your connection and try again." actionLabel="Try again" onAction={load} />;
  if (state === 'missing') return <Notice title="Message not found" body="It may have been removed." />;

  const { message, attachments } = state;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View
        onLayout={() => {
          // Fires after the message body has been laid out on screen.
          if (!marked.current) { marked.current = true; seenMessages.add(message.id).catch(() => {}); }
        }}
      >
        <Text style={styles.source}>{message.source_label}</Text>
        <Text style={styles.time}>{formatDarwin(message.created_at)}</Text>
        <Text selectable style={styles.body} dataDetectorType="all">{message.body}</Text>
      </View>
      {linked ? (
        <Pressable accessibilityRole="button" onPress={() => openEntry(linked)}
          style={({ pressed }) => [styles.open, pressed && { opacity: 0.8 }]}>
          <MaterialCommunityIcons
            name={linked.kind === 'pdf' ? 'file-document-outline' : linked.kind === 'folder' ? 'folder-outline' : 'open-in-new'}
            size={22} color="#FFFFFF" />
          <Text style={styles.openText} numberOfLines={2}>Open {linked.label}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
        </Pressable>
      ) : null}
      {attachments.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.attHead}>Attachments</Text>
          {attachments.map((a) => {
            const open = () => router.push({ pathname: '/doc/[id]', params: { id: 'att', path: a.file_path, name: a.file_name, mime: a.mime_type } });
            return a.mime_type.startsWith('image/')
              ? <ImagePreview key={a.id} uri={publicFileUrl('messages', a.file_path)} name={a.file_name} onOpen={open} />
              : <Row key={a.id} title={a.file_name} trailing="›" onPress={open} />;
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },
  source: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
  time: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, marginBottom: 12 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 24, color: colors.text },
  open: {
    marginTop: 16, minHeight: 50, borderRadius: 10, backgroundColor: colors.teal,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  openText: { flex: 1, color: '#FFFFFF', fontSize: 16, fontFamily: fonts.semibold },
  attHead: { fontSize: 14, fontFamily: fonts.semibold, color: colors.muted, marginBottom: 4, textTransform: 'uppercase' },
});
