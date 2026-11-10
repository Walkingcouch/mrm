import React, { useLayoutEffect } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { InAppWeb } from '@/components/InAppWeb';
import { Notice } from '@/components/ui';

export default function WebScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const nav = useNavigation();
  useLayoutEffect(() => { nav.setOptions({ title: title ?? '' }); }, [nav, title]);
  if (!url || !/^https:\/\//i.test(url)) return <Notice title="Link not available" />;
  return <InAppWeb url={url} />;
}
