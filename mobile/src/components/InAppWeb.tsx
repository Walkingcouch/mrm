// In-app web view with a system-browser fallback (brief §3: Flight Tracker,
// links, forms). Non-web links (tel:, mailto:, maps) are handed to the OS.
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { Loading, Notice } from './ui';
import { colors, fonts } from '@/lib/theme';

export function InAppWeb({ url, html, baseUrl, fallbackUrl, ...rest }: {
  url?: string; html?: string; baseUrl?: string; fallbackUrl?: string;
} & Partial<WebViewProps>) {
  const [failed, setFailed] = useState(false);
  const external = fallbackUrl ?? url;

  if (failed) {
    return (
      <Notice
        title="Couldn't load this page"
        body="Check your connection, or open it in your browser."
        actionLabel={external ? 'Open in browser' : undefined}
        onAction={external ? () => WebBrowser.openBrowserAsync(external) : undefined}
      />
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebView
        source={html ? { html, baseUrl } : { uri: url! }}
        originWhitelist={['https://*', 'about:*']}
        startInLoadingState
        renderLoading={() => <Loading />}
        onError={() => setFailed(true)}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 400 && !html) setFailed(true); }}
        onShouldStartLoadWithRequest={(req) => {
          if (/^https?:/i.test(req.url) || req.url.startsWith('about:')) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        {...rest}
      />
    </View>
  );
}
