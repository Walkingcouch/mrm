'use client';
// Message composer: source (only if several), destination (only if several),
// text, optional attachments, Send. No title, category, schedule, preview,
// approval or confirmation step. A request id makes repeated Sends safe.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUpload, sendMessage } from '@/app/actions';
import { browserClient } from '@/lib/supabase/browser';
import { LIMITS } from '@/lib/env';

type Scope = 'department' | 'global_general' | 'global_emergency';
interface Att { path: string; name: string; mime: string; size: number }

export function Composer({ sources, globalGeneral, globalEmergency, routing }: {
  sources: { id: string; label: string; push: boolean }[]; globalGeneral: boolean; globalEmergency: boolean;
  routing: 'subscribers' | 'everyone';
}) {
  const router = useRouter();
  const requestId = useRef<string>(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [scope, setScope] = useState<Scope>('department');
  const [body, setBody] = useState('');
  const [atts, setAtts] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const source = sources.find((s) => s.id === sourceId);
  const scopes: { value: Scope; label: string }[] = [
    { value: 'department', label: 'Team message' },
    ...(globalGeneral ? [{ value: 'global_general' as const, label: 'Site-wide message' }] : []),
    ...(globalEmergency ? [{ value: 'global_emergency' as const, label: 'Emergency (site-wide)' }] : []),
  ];
  const reach = scope !== 'department'
    ? 'Sends a notification to every device with notifications on.'
    : !source?.push ? 'Saved to Employee Messages without a phone notification.'
    : routing === 'everyone' ? 'Sends a notification to every device with notifications on.'
    : `Sends a notification to devices that follow ${source.label}.`;

  async function addFiles(files: FileList) {
    setMsg(null);
    const list = Array.from(files);
    if (atts.length + list.length > LIMITS.attachmentsPerMessage) return setMsg({ ok: false, text: `Up to ${LIMITS.attachmentsPerMessage} attachments.` });
    setUploading(true);
    try {
      for (const f of list) {
        const mime = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '');
        if (!(LIMITS.attachmentMimes as readonly string[]).includes(mime)) throw new Error(`“${f.name}”: attach PDFs or images only.`);
        if (f.size > LIMITS.attachmentBytes) throw new Error(`“${f.name}” is larger than 15 MB.`);
        const t = await createUpload({ kind: 'attachment', requestId: requestId.current, fileName: f.name, size: f.size, mime });
        if (!t.ok || !t.data) throw new Error(t.ok ? 'Upload failed.' : t.error);
        const { error } = await browserClient().storage.from('messages').uploadToSignedUrl(t.data.path, t.data.token, f, { contentType: mime, cacheControl: '31536000' });
        if (error) throw new Error(`Couldn't upload “${f.name}”. Check your connection.`);
        setAtts((a) => [...a, { path: t.data!.path, name: f.name, mime, size: f.size }]);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function send() {
    if (sending) return;
    setSending(true); setMsg(null);
    try {
      const r = await sendMessage({ requestId: requestId.current, sourceId, scope, body, attachments: atts });
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: r.data?.pushed ? 'Sent. It is in Employee Messages and notifications are on their way.' : 'Sent. It is in Employee Messages.' });
      setBody(''); setAtts([]); requestId.current = crypto.randomUUID();
      router.refresh();
    } catch {
      // Network failure: keep the same request id so pressing Send again
      // cannot create a duplicate message.
      setMsg({ ok: false, text: 'Not confirmed — check your connection and press Send again. It will not be sent twice.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <h2>New message</h2>
      {sources.length > 1 ? (
        <div className="field"><label htmlFor="src">From</label>
          <select id="src" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select></div>
      ) : <p className="muted">From: <strong>{source?.label}</strong></p>}
      {scopes.length > 1 ? (
        <div className="field"><label htmlFor="scope">Send as</label>
          <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></div>
      ) : null}
      <p className="muted">{reach}</p>
      <div className="field"><label htmlFor="body">Message</label>
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></div>

      <input ref={fileInput} type="file" multiple hidden accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
      {atts.length ? (
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '0 0 .5rem' }}>
          {atts.map((a) => (
            <li key={a.path} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="file-note">📎 {a.name}</span>
              <button type="button" className="plain" onClick={() => setAtts((x) => x.filter((y) => y.path !== a.path))} aria-label={`Remove ${a.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <div className={`alert ${msg.ok ? 'ok' : 'error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div> : null}
      <div className="row">
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()} disabled={uploading || sending}>
          {uploading ? 'Uploading…' : 'Attach PDF or image'}
        </button>
        <button type="button" onClick={send} disabled={sending || uploading || !body.trim() || !sourceId}
          className={scope === 'global_emergency' ? 'danger' : undefined}>
          {sending ? 'Sending…' : scope === 'global_emergency' ? 'Send emergency message' : 'Send'}
        </button>
      </div>
    </div>
  );
}
