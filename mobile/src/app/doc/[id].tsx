// Content PDF (timetable, village, memorandum…) or message attachment.
//   /doc/<entryId>                         -> content entry
//   /doc/att?bucket=messages&path=..&name=.. -> message attachment
import React, { useLayoutEffect } from 'react';
import { Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { publicFileUrl } from '@/lib/api';
import { useContent } from '@/lib/content-context';
import { PdfView } from '@/components/PdfView';
import { Loading, Notice } from '@/components/ui';

export default function DocScreen() {
  const { id, path, name, mime } = useLocalSearchParams<{ id: string; path?: string; name?: string; mime?: string }>();
  const nav = useNavigation();
  const { snapshot } = useContent();

  const entry = id !== 'att' ? snapshot?.entries.find((e) => e.id === id) : undefined;
  const title = entry?.label ?? name ?? 'Document';
  useLayoutEffect(() => { nav.setOptions({ title }); }, [nav, title]);

  if (id === 'att') {
    if (!path) return <Notice title="File not found" />;
    const url = publicFileUrl('messages', path);
    if (mime?.startsWith('image/')) {
      return (
        <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1 }}>
          <Image source={{ uri: url }} style={{ flex: 1, minHeight: 400 }} resizeMode="contain" accessibilityLabel={name} />
        </ScrollView>
      );
    }
    return <PdfView fileUrl={url} />;
  }

  if (!snapshot) return <Loading />;
  if (!entry || entry.kind !== 'pdf') return <Notice title="Document not found" body="It may have been removed." />;
  if (!entry.file_path) return <Notice title="Not yet available" body="This document has not been uploaded yet." />;
  // The path changes on every replacement, so a cached old copy is never shown.
  return <PdfView fileUrl={publicFileUrl('content', entry.file_path)} />;
}
