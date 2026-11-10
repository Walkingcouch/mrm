import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ContentProvider } from '@/lib/content-context';
import { setUpPush } from '@/lib/notifications';
import { handledNotifications } from '@/lib/seen';
import { shouldNavigateForTap } from '@/lib/seen-core';
import { colors } from '@/lib/theme';

/**
 * Opens a message ONLY when the user deliberately taps its OS notification.
 * Received notifications, app launch, resume and reconnect never navigate.
 */
function NotificationTapHandler() {
  useEffect(() => {
    const open = async (r: Notifications.NotificationResponse) => {
      const id = await shouldNavigateForTap(
        handledNotifications,
        r.notification.request.identifier,
        r.notification.request.content.data,
        r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER,
      );
      if (id) router.push({ pathname: '/message/[id]', params: { id } });
    };
    // Cold start from a tap.
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) open(r); }).catch(() => {});
    // Taps while running / backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}

export default function RootLayout() {
  useEffect(() => { setUpPush(); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ContentProvider>
          <StatusBar style="light" />
          <NotificationTapHandler />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.header },
              headerTintColor: colors.headerText,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            <Stack.Screen name="doc/[id]" options={{ title: 'Document' }} />
            <Stack.Screen name="web" options={{ title: '' }} />
            <Stack.Screen name="message/[id]" options={{ title: 'Message' }} />
            <Stack.Screen name="info/[id]" options={{ title: '' }} />
          </Stack>
        </ContentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
