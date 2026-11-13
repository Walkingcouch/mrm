// Web build only (the showcase/demo site). Phones use InAppWeb.tsx with the
// native web view. Embedded HTML (e.g. the WillyWeather widget) and document
// previews show in an iframe; other websites usually refuse to be embedded,
// so they get a card with an "Open in a new tab" link instead.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

// Our own PDF viewer (admin website), Google's document viewer and direct PDF links.
const EMBEDDABLE = [/\/pdf-viewer\/index\.html\?file=/i, /^https:\/\/docs\.google\.com\/gview/i, /\.pdf(\?|#|$)/i];

function siteName(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Web page'; }
}

const frame = { border: 0, width: '100%', height: '100%', display: 'block', background: '#fff' } as const;

export function InAppWeb({ url, html }: { url?: string; html?: string; [k: string]: unknown }) {
  if (html) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <iframe title="Embedded content" srcDoc={html} style={frame} sandbox="allow-scripts allow-same-origin allow-popups" />
      </View>
    );
  }
  if (url && EMBEDDABLE.some((r) => r.test(url))) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <iframe title="Document" src={url} style={frame} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#DADADA', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.text, textAlign: 'center' }}>{url ? siteName(url) : 'Web page'}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          In the phone app this page opens right here, inside the app. Websites can&apos;t be shown inside this demo.
        </Text>
        {url ? (
          <Pressable accessibilityRole="link" onPress={() => window.open(url, '_blank', 'noopener')}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.tealText, textDecorationLine: 'underline', marginTop: 6 }}>
              Open the page in a new tab
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
