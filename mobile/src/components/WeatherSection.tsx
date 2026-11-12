// Weather: the owner's free WillyWeather widget if configured, otherwise the
// fixed WillyWeather location URL. No weather data is fetched by our servers.
// The widget is NOT claimed to work until tested on real devices.
import React, { useState } from 'react';
import type { Section } from '@/lib/api';
import { Notice } from './ui';
import { InAppWeb } from './InAppWeb';

// The WillyWeather widget is set to 400px wide (its minimum). A 424px-wide page
// (400 + padding) lets phones narrower than that shrink it to fit instead of
// scrolling sideways; wider phones show it at full size.
function widgetPage(widgetHtml: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=424">
<style>html,body{margin:0;padding:12px;background:#fff;font-family:-apple-system,Roboto,sans-serif}iframe{max-width:100%}</style></head>
<body>${widgetHtml}</body></html>`;
}

export function WeatherSection({ section }: { section: Section }) {
  const [widgetFailed, setWidgetFailed] = useState(false);
  if (section.widget_html && !widgetFailed) {
    return (
      <InAppWeb
        html={widgetPage(section.widget_html)}
        baseUrl="https://www.willyweather.com.au/"
        fallbackUrl={section.url ?? undefined}
        onError={() => setWidgetFailed(true)}
      />
    );
  }
  if (section.url) return <InAppWeb url={section.url} />;
  return <Notice title="Weather not set up yet" body="An administrator needs to add the WillyWeather location." />;
}
