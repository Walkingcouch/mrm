'use client';
// Choose → upload → published. No title/date fields, no preview, no draft.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUpload, finalizePdf } from '@/app/actions';
import { browserClient } from '@/lib/supabase/browser';
import { LIMITS } from '@/lib/env';

export function PdfUpload({ mode, nodeId, sectionId, buttonLabel, allowLabel }: {
  mode: 'replace' | 'new-entry'; nodeId: string; sectionId: string; buttonLabel: string; allowLabel?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [label, setLabel] = useState('');

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
      setMsg({ ok: true, text: mode === 'replace' ? 'Replaced. The apps now show the new PDF.' : 'Added. It now appears in the apps.' });
      setLabel('');
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
