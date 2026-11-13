// Web build only (demo site): when a message is sent from the admin website,
// show a notification banner at the top of the screen, styled like iOS or
// Android (?platform=ios|android, set by the demo page). Same wording as the
// real push. Tapping it opens the message. Browsers are never registered for
// real push.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SAMPLE_MODE, supabase, type MessageRow } from '@/lib/api';
import { messagesChanged } from '@/lib/messages-live';
import { fonts } from '@/lib/theme';

const APP_NAME = 'McArthur River Mine';
const VISIBLE_MS = 7000;
// ?platform= from the demo page; otherwise (full screen on a real phone) the device itself.
const os: 'ios' | 'android' = (() => {
  if (typeof window === 'undefined') return 'ios';
  const p = new URLSearchParams(window.location.search).get('platform');
  if (p === 'ios' || p === 'android') {
    try { sessionStorage.setItem('demo-platform', p); } catch { /* ignore */ }
    return p;
  }
  try { const saved = sessionStorage.getItem('demo-platform'); if (saved === 'ios' || saved === 'android') return saved; } catch { /* ignore */ }
  return /android/i.test(navigator.userAgent) ? 'android' : 'ios';
})();

function wording(m: MessageRow) {
  if (m.scope === 'global_emergency') {
    return { title: 'Emergency Notification', body: `Please read an important update from ${m.source_label} in Employee Messages.`, urgent: true };
  }
  return { title: m.source_label, body: m.body.length > 178 ? `${m.body.slice(0, 175)}…` : m.body, urgent: false };
}

async function latest(): Promise<MessageRow[]> {
  const { data } = await supabase.from('messages').select('id,source_label,scope,body,created_at')
    .order('created_at', { ascending: false }).limit(5);
  return (data ?? []) as MessageRow[];
}

export function DemoNotifications() {
  const [shown, setShown] = useState<MessageRow | null>(null);
  const known = useRef<Set<string> | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setShown(null));
  };

  useEffect(() => {
    if (SAMPLE_MODE) return;
    let alive = true;
    const check = async () => {
      const rows = await latest().catch(() => [] as MessageRow[]);
      if (!alive) return;
      if (!known.current) { known.current = new Set(rows.map((r) => r.id)); return; } // existing messages never banner
      const fresh = rows.filter((r) => !known.current!.has(r.id));
      for (const r of rows) known.current.add(r.id);
      if (!fresh.length) return;
      messagesChanged.emit();
      setShown(fresh[0]);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: false, friction: 8 }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, VISIBLE_MS);
    };
    check();
    const channel = supabase.channel('employee-messages')
      .on('broadcast', { event: 'changed' }, () => { check(); messagesChanged.emit(); })
      .subscribe();
    const poll = setInterval(check, 30_000); // fallback if the live channel drops
    return () => { alive = false; clearInterval(poll); supabase.removeChannel(channel); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [slide]);

  if (!shown) return null;
  const w = wording(shown);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { transform: [{ translateY }], opacity: slide }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${w.title}. ${w.body}`}
        onPress={() => { const id = shown.id; hide(); router.push({ pathname: '/message/[id]', params: { id } }); }}
        style={[styles.card, os === 'ios' ? styles.ios : styles.android, w.urgent && styles.urgent]}
      >
        <View style={styles.head}>
          <Image source={require('../../assets/icon.png')} style={os === 'ios' ? styles.iconIos : styles.iconAndroid} />
          <Text style={[styles.app, os === 'android' && styles.appAndroid]} numberOfLines={1}>
            {os === 'ios' ? APP_NAME.toUpperCase() : `${APP_NAME} • now`}
          </Text>
          {os === 'ios' ? <Text style={styles.time}>now</Text> : null}
        </View>
        <Text style={[styles.title, w.urgent && styles.titleUrgent]} numberOfLines={1}>{w.title}</Text>
        <Text style={styles.body} numberOfLines={3}>{w.body}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 6, left: 8, right: 8, zIndex: 1000 },
  card: { paddingHorizontal: 14, paddingVertical: 11, gap: 2, cursor: 'pointer' } as object,
  ios: {
    borderRadius: 22, backgroundColor: '#F4F4F4',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  android: {
    borderRadius: 16, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  urgent: { borderLeftWidth: 4, borderLeftColor: '#C62828' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  iconIos: { width: 20, height: 20, borderRadius: 5 },
  iconAndroid: { width: 16, height: 16, borderRadius: 8 },
  app: { flex: 1, fontSize: 12, color: '#6b6b6b', letterSpacing: 0.3, fontFamily: fonts.medium },
  appAndroid: { letterSpacing: 0 },
  time: { fontSize: 12, color: '#8a8a8a', fontFamily: fonts.regular },
  title: { fontSize: 15, color: '#111', fontFamily: fonts.semibold },
  titleUrgent: { color: '#B71C1C' },
  body: { fontSize: 14, color: '#222', lineHeight: 19, fontFamily: fonts.regular },
});
