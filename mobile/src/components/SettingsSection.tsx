// Minimal Settings: notification status/help, optional departmental
// subscriptions (only while departmental_push_mode = 'subscribers'), app info.
import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { loadPublicConfig, loadSources, type Source } from '@/lib/api';
import { getSubscriptions, setSubscriptions } from '@/lib/installation';
import { getPushState, setUpPush, type PushState } from '@/lib/notifications';
import { colors, fonts } from '@/lib/theme';
import { Button } from './ui';

const STATE_TEXT: Record<PushState, string> = {
  granted: 'On. You will receive message notifications on this device.',
  denied: 'Off. You can still read everything under Employee Messages. To receive notifications, turn them on in your phone settings.',
  undetermined: 'Not set up yet.',
  unsupported: 'Notifications are not available on this device right now.',
};

export function SettingsSection() {
  const [push, setPush] = useState<PushState | null>(null);
  const [mode, setMode] = useState<'subscribers' | 'everyone' | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);

  useFocusEffect(useCallback(() => {
    getPushState().then(setPush).catch(() => setPush('unsupported'));
    loadPublicConfig().then(async (c) => {
      setMode(c.departmental_push_mode);
      if (c.departmental_push_mode === 'subscribers') {
        const [s, mine] = await Promise.all([loadSources(), getSubscriptions().catch(() => [])]);
        setSources(s.filter((x) => x.subscribable));
        setSubs(new Set(mine));
      }
    }).catch(() => setMode(null));
  }, []));

  const toggle = async (id: string, on: boolean) => {
    const next = new Set(subs);
    if (on) next.add(id); else next.delete(id);
    setSubs(next);
    try { await setSubscriptions([...next]); setSaveError(false); }
    catch { setSubs(subs); setSaveError(true); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Text style={styles.h} accessibilityRole="header">Notifications</Text>
      <Text style={styles.p}>{push ? STATE_TEXT[push] : '…'}</Text>
      {push === 'denied' ? <Button kind="secondary" label="Open phone settings" onPress={() => Linking.openSettings()} /> : null}
      {push === 'undetermined' ? <Button kind="secondary" label="Turn on notifications" onPress={async () => setPush(await setUpPush())} /> : null}
      <Text style={styles.small}>
        Emergency and site-wide messages are sent to all devices with notifications on. Delivery depends on your phone and network and is not guaranteed — always check Employee Messages.
      </Text>

      {mode === 'subscribers' && sources.length > 0 ? (
        <View>
          <Text style={styles.h} accessibilityRole="header">Team notifications</Text>
          <Text style={styles.small}>Choose which teams can notify this device. All messages stay visible in Employee Messages either way.</Text>
          {sources.map((s) => (
            <View key={s.id} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{s.label}</Text>
              <Switch value={subs.has(s.id)} onValueChange={(v) => toggle(s.id, v)} accessibilityLabel={`${s.label} notifications`}
                trackColor={{ true: colors.accent }} />
            </View>
          ))}
          {saveError ? <Text style={[styles.small, { color: colors.danger }]}>Couldn't save. Check your connection.</Text> : null}
        </View>
      ) : null}

      <Text style={styles.h} accessibilityRole="header">About</Text>
      <Text style={styles.p}>McArthur River Mine</Text>
      <Text style={styles.small}>
        Version {Application.nativeApplicationVersion ?? Constants.expoConfig?.version} ({Application.nativeBuildVersion ?? 'dev'})
      </Text>
      <Text style={styles.small}>This app does not collect personal information. Content in this app is publicly accessible.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10, paddingBottom: 40 },
  h: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text, marginTop: 16 },
  p: { fontSize: 16, fontFamily: fonts.regular, color: colors.text },
  small: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, gap: 12 },
  switchLabel: { flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.text },
});
