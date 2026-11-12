import React from 'react';
import { Alert, FlatList, Linking, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { entriesFor, type ContentSnapshot, type Entry, type Section } from '@/lib/api';
import { useContent } from '@/lib/content-context';
import { Notice, Row } from './ui';
import { colors, sectionIcons } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function notYet() {
  Alert.alert('Not yet available', 'This item has not been set up yet.');
}

export function openEntry(e: Entry) {
  switch (e.kind) {
    case 'folder':
      return router.push({ pathname: '/folder/[id]', params: { id: e.id } });
    case 'pdf':
      if (!e.file_path) return notYet();
      return router.push({ pathname: '/doc/[id]', params: { id: e.id } });
    case 'url':
      if (!e.url) return notYet();
      return router.push({ pathname: '/web', params: { url: e.url, title: e.label } });
    case 'info':
      if (!e.body) return notYet();
      return router.push({ pathname: '/info/[id]', params: { id: e.id } });
    case 'phone':
      if (!e.phone) return notYet();
      return Linking.openURL(`tel:${e.phone.replace(/[^\d+]/g, '')}`).catch(() => notYet());
    case 'map':
      if (!e.url) return notYet();
      // Map/directions links open the device's maps app or browser.
      return Linking.openURL(e.url).catch(() => notYet());
  }
}

function hint(e: Entry): string | undefined {
  if (e.kind === 'folder') return undefined;
  if (e.kind === 'phone') return e.phone ?? 'Not yet available';
  const configured = e.kind === 'pdf' ? e.file_path : e.kind === 'info' ? e.body : e.url;
  return configured ? undefined : 'Not yet available';
}

/** The item's own icon (set on the admin website) if it is a known icon, otherwise the fallback. */
function iconFor(e: Entry, fallback: IconName): IconName {
  return e.icon && e.icon in MaterialCommunityIcons.glyphMap ? (e.icon as IconName) : fallback;
}

/**
 * Items in a list section, or in a folder inside one. `parent` is the section
 * or folder; `section` supplies the default icon.
 */
export function EntryList({ section, snapshot, parent }: {
  section: Section; snapshot: ContentSnapshot; parent?: { id: string; icon?: string | null };
}) {
  const { refresh, loading } = useContent();
  const entries = entriesFor(snapshot, { id: parent?.id ?? section.id, sort_mode: section.sort_mode });
  const sectionIcon = sectionIcons[section.key] ?? 'file-outline';
  const fallback: IconName = parent?.icon && parent.icon in MaterialCommunityIcons.glyphMap ? (parent.icon as IconName) : sectionIcon;
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerStyle={entries.length ? undefined : { flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      ListEmptyComponent={<Notice title="Nothing here yet" body="Items will appear here once they are added." />}
      renderItem={({ item }) => (
        <Row
          title={item.is_demo ? `[DEMO] ${item.label}` : item.label}
          subtitle={hint(item)}
          icon={iconFor(item, fallback)}
          onPress={() => openEntry(item)}
        />
      )}
    />
  );
}
