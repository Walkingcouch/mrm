'use client';
// Choose → upload → published. No title/date fields, no preview, no draft.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUpload, finalizePdf, sendMessage } from '@/app/actions';
import { browserClient } from '@/lib/supabase/browser';
import { LIMITS } from '@/lib/env';

/** Teams this admin may send as (from admin_me), for the optional notification. */
export interface NotifyOptions { sources: { id: string; label: string; push: boolean }[]; itemLabel?: string; placeLabel: string }

export function PdfUpload({ mode, nodeId, sectionId, buttonLabel, allowLabel, notify }: {
  mode: 'replace' | 'new-entry'; nodeId: string; sectionId: string; buttonLabel: string; allowLabel?: boolean;
  notify?: NotifyOptions;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [label, setLabel] = useState('');
  // Optional "Notify phones?" — sends an Employee Message (with a push when the
  // team is allowed to push) after the PDF is live. Off unless chosen.
  const canNotify = !!notify && notify.sources.length > 0;
  const [notifyOn, setNotifyOn] = useState(false);
  const [sourceId, setSourceId] = useState(notify?.sources[0]?.id ?? '');
  const defaultText = () => {
    const name = (mode === 'replace' ? notify?.itemLabel : label.trim()) || '';
    return name
      ? `${name} has been updated. Open ${notify?.placeLabel} → ${name} to view it.`
      : `A new document has been added to ${notify?.placeLabel}.`;
  };
  const [text, setText] = useState('');
  const source = notify?.sources.find((x) => x.id === sourceId);

  async function onFile(file: File) {
    setMsg(null);
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setMsg({ ok: false, text: 'Choose a PDF file.' });
    if (file.size > LIMITS.pdfBytes) return setMsg({ ok: false, text: 'PDFs must be 25 MB or smaller.' });
    try {
      setBusy('Uploading…');
      const t = await createUpload({ kind: mode, nodeId, fileName: file.name, size: file.size, mime: 'application/pdf' });
      if (!t.ok || !t.data) throw new Error(t.ok ? 'Could not start the upload.' : t.error);
      const { error } = await browserClient().storage.from(t.data.bucket).uploadToSignedUrl(t.data.path, t.data.token, file, { contentType: 'application/pdf' });
      if (error) throw new Error('Upload failed. Check your connection — the current document has not changed.');
      setBusy('Publishing…');
      const r = await finalizePdf({ kind: mode, nodeId, entryId: t.data.entryId!, path: t.data.path, fileName: file.name, size: file.size, label, sectionId });
      if (!r.ok) throw new Error(r.error);
      const done = mode === 'replace' ? 'Replaced. The apps now show the new PDF.' : 'Added. It now appears in the apps.';
      if (canNotify && notifyOn && sourceId) {
        setBusy('Sending notification…');
        const n = await sendMessage({ requestId: crypto.randomUUID(), sourceId, scope: 'department', body: (text || defaultText()).trim(), attachments: [] });
        setMsg(n.ok
          ? { ok: true, text: `${done} ${n.data?.pushed ? `Notification sent from ${source?.label}.` : `Message posted in Employee Messages from ${source?.label} (this team can't send push notifications).`}` }
          : { ok: false, text: `${done} But the notification couldn't be sent: ${n.error}` });
      } else {
        setMsg({ ok: true, text: done });
      }
      setLabel(''); setNotifyOn(false); setText('');
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="stack" style={{ gap: '.5rem' }}>
      {allowLabel ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`lbl-${nodeId}`}>Name in app <span className="muted">(optional — defaults to the file name)</span></label>
          <input id={`lbl-${nodeId}`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
        </div>
      ) : null}
      {canNotify ? (
        <fieldset className="notify-choice" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: '.25rem' }}>Notify phones about this update?</legend>
          <div className="row" role="radiogroup">
            <label className="row" style={{ gap: '.35rem' }}>
              <input type="radio" name={`notify-${mode}-${nodeId}`} checked={!notifyOn} onChange={() => setNotifyOn(false)} /> No
            </label>
            <label className="row" style={{ gap: '.35rem' }}>
              <input type="radio" name={`notify-${mode}-${nodeId}`} checked={notifyOn} onChange={() => { setNotifyOn(true); if (!text) setText(defaultText()); }} /> Yes
            </label>
          </div>
          {notifyOn ? (
            <div className="stack" style={{ gap: '.25rem', marginTop: '.5rem' }}>
              {notify!.sources.length > 1 ? (
                <div className="field" style={{ marginBottom: 0 }}><label htmlFor={`src-${mode}-${nodeId}`}>From</label>
                  <select id={`src-${mode}-${nodeId}`} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                    {notify!.sources.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select></div>
              ) : <p className="muted" style={{ margin: 0 }}>From: {source?.label}</p>}
              <div className="field" style={{ marginBottom: 0 }}><label htmlFor={`txt-${mode}-${nodeId}`}>Notification text</label>
                <textarea id={`txt-${mode}-${nodeId}`} value={text} maxLength={500} rows={2} onChange={(e) => setText(e.target.value)} /></div>
              <p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>
                {source?.push
                  ? 'Sent once the PDF is live: phones that follow this team get a notification, and it appears in Employee Messages.'
                  : 'This team can post in Employee Messages but not send push notifications.'}
              </p>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="row">
        <button type="button" className={mode === 'replace' ? 'secondary' : undefined} disabled={!!busy} onClick={() => input.current?.click()}>
          {busy ?? buttonLabel}
        </button>
      </div>
      {msg ? <div className={`alert ${msg.ok ? 'ok' : 'error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div> : null}
    </div>
  );
}
