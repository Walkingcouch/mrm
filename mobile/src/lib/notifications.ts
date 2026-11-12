// Push registration and tap handling.
//
// Rules from the brief (§2, §7):
//  - No automatic in-app presentation: no banners while the app is open, no
//    pop-ups, no redirects on launch / resume / reconnect.
//  - Only a deliberately tapped OS notification opens its message.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerInstallation } from './installation';

export const ANDROID_CHANNEL = 'messages';
export const ANDROID_EMERGENCY_CHANNEL = 'emergency';

// Foreground receipt: suppress app-controlled banners and sounds. The
// notification may still sit in the OS notification list (not in the app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPushState(): Promise<PushState> {
  if (!Device.isDevice) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Ask the OS for permission (the system prompt, not an in-app pop-up), obtain
 * an Expo push token, and register this installation. Content and the
 * Messages section work regardless of the outcome (acceptance Q).
 */
export async function setUpPush(): Promise<PushState> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  try {
    if (Platform.OS === 'android') {
      // Channel must exist before requesting permission on Android 13+.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
      });
      // Emergency messages get their own channel at the highest importance, so
      // they make a sound and show at the top even if Messages is turned down.
      await Notifications.setNotificationChannelAsync(ANDROID_EMERGENCY_CHANNEL, {
        name: 'Emergency messages',
        importance: Notifications.AndroidImportance.MAX,
        enableVibrate: true,
      });
    }
    let state = await getPushState();
    if (state === 'undetermined') {
      await Notifications.requestPermissionsAsync();
      state = await getPushState();
    }
    let token: string | null = null;
    if (state === 'granted') {
      const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
        ?? Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    }
    await registerInstallation(platform, token);
    return state;
  } catch {
    // Registration failures must never block the app; they retry next launch.
    return 'unsupported';
  }
}
