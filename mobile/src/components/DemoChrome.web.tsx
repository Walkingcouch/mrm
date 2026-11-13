// Web build only, when the app is opened on its own (not inside the demo
// page's phone frames): makes it obvious this is a demo, and helps the visitor
// go full screen. Android (Chrome) supports real full screen; iPhone Safari
// doesn't let websites do it, so it explains how to hide Safari's toolbar.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/lib/theme';

// Faint diagonal "DEMO" watermark tiled over every screen (taps pass through).
const WATERMARK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160">'
  + '<text x="110" y="88" text-anchor="middle" transform="rotate(-30 110 80)" '
  + 'font-family="Montserrat, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="6" '
  + 'fill="#000" fill-opacity="0.06">DEMO</text></svg>')}")`;

function Watermark() {
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 800,
      backgroundImage: WATERMARK, backgroundRepeat: 'repeat', backgroundPosition: 'center',
    }} />
  );
}

const embedded = typeof window !== 'undefined' && window.self !== window.top;
const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && !isIos;
const isFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenElement;

function goFullscreen() {
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

export function DemoChrome() {
  const [intro, setIntro] = useState(() => {
    try { return sessionStorage.getItem('demo-intro-seen') !== '1'; } catch { return true; }
  });
  const [full, setFull] = useState(isFullscreen());

  useEffect(() => {
    const on = () => setFull(isFullscreen());
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  // Inside the demo page's phone frames: just the watermark (the page itself says it's a demo).
  if (embedded) return <Watermark />;

  const close = () => { setIntro(false); try { sessionStorage.setItem('demo-intro-seen', '1'); } catch { /* ignore */ } };

  return (
    <>
      <Watermark />
      {/* Always-visible marker. */}
      <View pointerEvents="box-none" style={styles.tagWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel="Demo app. Full screen options"
          onPress={() => (canFullscreen && !full ? goFullscreen() : setIntro(true))} style={styles.tag}>
          <Text style={styles.tagText}>DEMO{!full ? '  ·  Full screen' : ''}</Text>
        </Pressable>
      </View>

      {intro ? (
        <View style={styles.backdrop}>
          <View style={styles.card} accessibilityRole="alert">
            <Text style={styles.badge}>DEMO ONLY</Text>
            <Text style={styles.title}>This is a demo of the app</Text>
            <Text style={styles.body}>
              It runs in your web browser to show how the app looks and works. It is not the app staff install
              from the App Store or Google Play. Phone calls, push notifications and some outside websites only
              work in the installed app.
            </Text>
            <Text style={styles.subtitle}>For the best experience, go full screen</Text>
            {canFullscreen ? (
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => { goFullscreen(); close(); }}>
                <Text style={styles.primaryText}>Go full screen</Text>
              </Pressable>
            ) : (
              <View style={styles.steps}>
                <Text style={styles.step}>1. Tap <Text style={styles.bold}>aA</Text> (or <Text style={styles.bold}>•••</Text>) in Safari&apos;s address bar.</Text>
                <Text style={styles.step}>2. Tap <Text style={styles.bold}>Hide Toolbar</Text>.</Text>
                <Text style={styles.step}>3. To bring the toolbar back, tap the very top or bottom of the screen.</Text>
              </View>
            )}
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={close}>
              <Text style={styles.secondaryText}>{canFullscreen ? 'Not now' : 'Got it'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

    </>
  );
}

const styles = StyleSheet.create({
  tagWrap: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', zIndex: 900 },
  tag: { backgroundColor: 'rgba(17,17,17,0.82)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, cursor: 'pointer' } as object,
  tagText: { color: '#fff', fontSize: 12, letterSpacing: 0.6, fontFamily: fonts.semibold },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1100 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 22, gap: 10 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#FFF4E5', color: '#8A4B00', fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: '#111' },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: '#333' },
  subtitle: { fontFamily: fonts.semibold, fontSize: 15, color: '#111', marginTop: 6 },
  steps: { gap: 6 },
  step: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: '#333' },
  bold: { fontFamily: fonts.semibold },
  primary: { backgroundColor: '#00807A', borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 16 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#00807A', fontFamily: fonts.medium, fontSize: 15 },
});
