import React from 'react';
import { Alert, FlatList, Linking, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { entriesFor, type ContentSnapshot, type Entry, type Section } from '@/lib/api';
import { useContent } from '@/lib/content-context';
import { Notice, Row } from './ui';
import { colors, sectionIcons } from '@/lib/theme';

function notYet() {
  Alert.alert('Not yet available', 'This item has not been set up yet.');
}

export function openEntry(e: Entry) {
  switch (e.kind) {
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
  if (e.kind === 'phone') return e.phone ?? 'Not yet available';
  const configured = e.kind === 'pdf' ? e.file_path : e.kind === 'info' ? e.body : e.url;
  return configured ? undefined : 'Not yet available';
}

export function EntryList({ section, snapshot }: { section: Section; snapshot: ContentSnapshot }) {
  const { refresh, loading } = useContent();
  const entries = entriesFor(snapshot, section);
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
          icon={sectionIcons[section.key] ?? 'file-outline'}
          onPress={() => openEntry(item)}
        />
      )}
    />
  );
}
