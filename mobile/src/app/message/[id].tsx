// Message detail. Opened only by the user (from the list or by tapping a
// push). Marked seen only once the content has actually rendered — a failed
// fetch or render never marks it seen (acceptance O).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { loadMessage, type Attachment, type MessageRow } from '@/lib/api';
import { seenMessages } from '@/lib/seen';
import { formatDarwin } from '@/lib/time';
import { colors, fonts } from '@/lib/theme';
import { Loading, Notice, Row } from '@/components/ui';

export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ message: MessageRow; attachments: Attachment[] } | 'missing' | 'error' | null>(null);
  const marked = useRef(false);

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
      {attachments.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.attHead}>Attachments</Text>
          {attachments.map((a) => (
            <Row key={a.id} title={a.file_name} trailing="›"
              onPress={() => router.push({ pathname: '/doc/[id]', params: { id: 'att', path: a.file_path, name: a.file_name, mime: a.mime_type } })} />
          ))}
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
  attHead: { fontSize: 14, fontFamily: fonts.semibold, color: colors.muted, marginBottom: 4, textTransform: 'uppercase' },
});
