import type { ExpoConfig } from 'expo/config';

// Store identifiers are NOT invented here. They must come from the owner's
// verified Apple / Google accounts (see docs/RELEASE.md):
//   IOS_BUNDLE_ID   – read from App Store Connect for app id6450782901
//   ANDROID_PACKAGE – verify in Play Console (public listing shows io.appbuild.mcarthur)
// Local development builds fall back to clearly non-store identifiers.
const APP_ENV = process.env.APP_ENV ?? 'development'; // development | preview | staging | production
const isRelease = APP_ENV === 'production' || APP_ENV === 'staging';

function required(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isRelease) throw new Error(`${name} must be set for ${APP_ENV} builds (see docs/RELEASE.md)`);
  return devFallback;
}

const config: ExpoConfig = {
  name: APP_ENV === 'production' ? 'McArthur River Mine' : APP_ENV === 'preview' ? 'MRM Preview' : `MRM (${APP_ENV})`,
  // Must match the Expo project at expo.dev/accounts/first-geospatial/projects/mrm-mcarthur-river-mine
  owner: 'first-geospatial',
  slug: 'mrm-mcarthur-river-mine',
  version: '2.0.0',
  orientation: 'portrait',
  scheme: 'mrm',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: required('IOS_BUNDLE_ID', 'dev.local.mrm'),
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    // Preview/test builds use a clearly non-store id so they install alongside the live app.
    package: required('ANDROID_PACKAGE', APP_ENV === 'preview' ? 'dev.local.mrm.preview' : 'dev.local.mrm'),
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // No location, contacts, camera etc. Only what notifications need.
    blockedPermissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    'expo-router',
    ['expo-notifications', { color: '#00807A', defaultChannel: 'messages' }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    appEnv: APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    pdfViewerUrl: process.env.EXPO_PUBLIC_PDF_VIEWER_URL,
    // Expo project ID for expo.dev/accounts/first-geospatial/projects/mrm-mcarthur-river-mine
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '7ce70da8-8d9e-443d-89e7-e907dcdfbe10' },
  },
};

export default config;
