// A folder inside a list section (e.g. HR & Payroll → Benefits & Rewards).
// Shows its items with the same rows, icons and behaviour as the section.
import React, { useLayoutEffect } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useContent } from '@/lib/content-context';
import { EntryList } from '@/components/EntryList';
import { Loading, Notice } from '@/components/ui';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useNavigation();
  const { snapshot, error, refresh } = useContent();

  const folder = snapshot?.entries.find((e) => e.id === id && e.kind === 'folder');
  const section = folder ? snapshot?.sections.find((s) => s.id === folder.parent_id) : undefined;
  const title = folder?.label ?? '';
  useLayoutEffect(() => { nav.setOptions({ title }); }, [nav, title]);

  if (!snapshot) {
    return error
      ? <Notice title="Can't connect" body="Check your connection and try again." actionLabel="Try again" onAction={refresh} />
      : <Loading />;
  }
  if (!folder || !section) return <Notice title="Folder not found" body="It may have been removed." />;
  return <EntryList section={section} snapshot={snapshot} parent={{ id: folder.id, icon: folder.icon }} />;
}
