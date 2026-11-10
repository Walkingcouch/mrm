import React, { useLayoutEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useContent } from '@/lib/content-context';
import { Loading, Notice } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

// Information text is rendered as plain text (never HTML), so nothing an
// administrator types can inject markup or scripts.
export default function InfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useNavigation();
  const { snapshot } = useContent();
  const entry = snapshot?.entries.find((e) => e.id === id);
  useLayoutEffect(() => { nav.setOptions({ title: entry?.label ?? '' }); }, [nav, entry?.label]);
  if (!snapshot) return <Loading />;
  if (!entry?.body) return <Notice title="Not found" body="It may have been removed." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} style={{ backgroundColor: colors.background }}>
      <Text selectable style={{ fontSize: 16, fontFamily: fonts.regular, lineHeight: 24, color: colors.text }} dataDetectorType="all">{entry.body}</Text>
    </ScrollView>
  );
}
