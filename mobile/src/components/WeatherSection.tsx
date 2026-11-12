// Weather: the owner's free WillyWeather widget (shown first), with a switch to
// the full WillyWeather page for McArthur River Mine Airport. No weather data is
// fetched by our servers. If the widget fails to load, the full page is shown.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Section } from '@/lib/api';
import { Notice } from './ui';
import { InAppWeb } from './InAppWeb';
import { colors, fonts } from '@/lib/theme';

// The WillyWeather widget is set to 400px wide (its minimum). A 424px-wide page
// (400 + padding) lets phones narrower than that shrink it to fit instead of
// scrolling sideways; wider phones show it at full size.
function widgetPage(widgetHtml: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=424">
<style>html,body{margin:0;padding:12px;background:#fff;font-family:-apple-system,Roboto,sans-serif}iframe{max-width:100%}</style></head>
<body>${widgetHtml}</body></html>`;
}

type Mode = 'widget' | 'web';

function Switch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const item = (m: Mode, label: string) => {
    const on = mode === m;
    return (
      <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(m)}
        style={[styles.tab, on && styles.tabOn]}>
        <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {item('widget', 'Summary')}
      {item('web', 'Full forecast')}
    </View>
  );
}

export function WeatherSection({ section }: { section: Section }) {
  const [widgetFailed, setWidgetFailed] = useState(false);
  const hasWidget = !!section.widget_html && !widgetFailed;
  const [mode, setMode] = useState<Mode>('widget');

  if (!hasWidget && !section.url) {
    return <Notice title="Weather not set up yet" body="An administrator needs to add the WillyWeather location." />;
  }
  if (!hasWidget) return <InAppWeb url={section.url!} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {section.url ? <Switch mode={mode} onChange={setMode} /> : null}
      {mode === 'widget' || !section.url ? (
        <InAppWeb
          key="widget"
          html={widgetPage(section.widget_html!)}
          baseUrl="https://www.willyweather.com.au/"
          fallbackUrl={section.url ?? undefined}
          onError={() => setWidgetFailed(true)}
        />
      ) : (
        <InAppWeb key="web" url={section.url} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', margin: 12, marginBottom: 4, borderWidth: 1, borderColor: colors.teal, borderRadius: 8, overflow: 'hidden' },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  tabOn: { backgroundColor: colors.teal },
  tabText: { fontFamily: fonts.medium, fontSize: 15, color: colors.tealText },
  tabTextOn: { color: '#FFFFFF' },
});
