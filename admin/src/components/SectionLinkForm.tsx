'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setWeatherWidget, updateEntry } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

export function SectionLinkForm({ sectionId, url, help }: { sectionId: string; url: string | null; help: string }) {
  const router = useRouter();
  const [value, setValue] = useState(url ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <div className="field">
        <label htmlFor="section-url">Link opened in the app</label>
        <input id="section-url" type="url" inputMode="url" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" />
        <p className="muted" style={{ marginTop: '.25rem' }}>{help}</p>
      </div>
      <Feedback result={result} okText="Saved." />
      <button type="button" disabled={pending} onClick={() => start(async () => {
        const r = await updateEntry(sectionId, sectionId, null, null, value); setResult(r); if (r.ok) router.refresh();
      })}>Save link</button>
    </div>
  );
}

export function WeatherWidgetForm({ sectionId, html }: { sectionId: string; html: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(html ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <h2>WillyWeather widget (optional)</h2>
      <p className="muted">
        When set, the app&apos;s Weather page opens on <strong>Summary</strong> (this widget), with a <strong>Full forecast</strong> tab
        for the page link above. Leave empty to show only the page link, with no tabs.
      </p>
      <p className="muted">
        Paste the embed code from WillyWeather&apos;s free widget builder for McArthur River Mine Airport (width 400px suits phones).
        Keep the provider&apos;s attribution in the code. Only code from willyweather.com.au is accepted. Check it on an iPhone and an
        Android phone after changing it.
      </p>
      <div className="field">
        <label htmlFor="widget">Widget embed code</label>
        <textarea id="widget" value={value} onChange={(e) => setValue(e.target.value)} maxLength={8000} spellCheck={false}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }} />
      </div>
      <Feedback result={result} okText="Saved." />
      <button type="button" disabled={pending} onClick={() => start(async () => {
        const r = await setWeatherWidget(sectionId, value); setResult(r); if (r.ok) router.refresh();
      })}>Save widget</button>
    </div>
  );
}
