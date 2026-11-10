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
        Paste the embed code from WillyWeather&apos;s free widget builder, configured for McArthur River Mine Airport. Keep the
        provider&apos;s attribution in the code. Leave empty to show the WillyWeather page link above instead. The widget must be
        tested on real iPhone and Android devices before relying on it.
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
