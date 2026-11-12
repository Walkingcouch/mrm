import React, { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useContent } from '@/lib/content-context';
import { Loading, Notice } from '@/components/ui';
import { EntryList } from '@/components/EntryList';
import { WebSection } from '@/components/WebSection';
import { WeatherSection } from '@/components/WeatherSection';
import { MessagesSection } from '@/components/MessagesSection';
import { SettingsSection } from '@/components/SettingsSection';

export default function SectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { snapshot, sections, refresh, error } = useContent();
  const section = sections.find((s) => s.key === key);
  const navigation = useNavigation() as unknown as { openDrawer(): void };

  // Android back button on a section brings the menu back up, like "‹ Menu".
  // (When the menu is open, the back button closes it as usual.)
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { navigation.openDrawer(); return true; });
    return () => sub.remove();
  }, [navigation]));

  if (!section) return <Notice title="Section not found" />;

  // Messages and Settings don't depend on the content snapshot.
  if (section.section_type === 'messages') return <MessagesSection />;
  if (section.section_type === 'settings') return <SettingsSection />;

  if (!snapshot) {
    return error
      ? <Notice title="Can't connect" body="Check your connection and try again." actionLabel="Try again" onAction={refresh} />
      : <Loading />;
  }
  const live = snapshot.sections.find((s) => s.key === key) ?? section;
  switch (live.section_type) {
    case 'list': return <EntryList section={live} snapshot={snapshot} />;
    case 'web': return <WebSection url={live.url} title={live.label} />;
    case 'weather': return <WeatherSection section={live} />;
    default: return <Notice title={live.label} />;
  }
}
