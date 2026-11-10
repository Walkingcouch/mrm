'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEntry, deleteEntry, reorderEntries, updateEntry } from '@/app/actions';
import { Feedback } from './Forms';
import { PdfUpload } from './PdfUpload';
import type { Result } from '@/lib/result';

export type Kind = 'pdf' | 'url' | 'info' | 'phone' | 'map';
export interface EntryVM {
  id: string; label: string; kind: Kind; url: string | null; body: string | null; phone: string | null;
  file_name: string | null; file_path: string | null; updated: string; perms: { upload: boolean; edit: boolean; delete: boolean };
}

const KIND_LABEL: Record<Kind, string> = { pdf: 'PDF document', url: 'Website / form link', info: 'Information text', phone: 'Phone number', map: 'Map / directions link' };

function ValueField({ kind, value, onChange, id }: { kind: Kind; value: string; onChange: (v: string) => void; id: string }) {
  if (kind === 'info') return <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={20000} />;
  if (kind === 'phone') return <input id={id} type="tel" inputMode="tel" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. +61 8 …" />;
  return <input id={id} type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />;
}
const valueLabel = (k: Kind) => (k === 'info' ? 'Text shown in the app' : k === 'phone' ? 'Phone number' : 'Link (https://…)');

export function EntryCard({ entry, sectionId, canMove, onMove }: {
  entry: EntryVM; sectionId: string; canMove: boolean; onMove?: (dir: -1 | 1) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(entry.label);
  const [kind, setKind] = useState<Kind>(entry.kind);
  const [value, setValue] = useState(entry.kind === 'info' ? entry.body ?? '' : entry.kind === 'phone' ? entry.phone ?? '' : entry.url ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await updateEntry(sectionId, entry.id, label, kind === 'pdf' ? null : kind, kind === 'pdf' ? null : value);
    setResult(r);
    if (r.ok) { setEditing(false); router.refresh(); }
  });
  const remove = () => {
    if (!confirm(`Remove “${entry.label}” from the app? This cannot be undone.`)) return;
    start(async () => { const r = await deleteEntry(sectionId, entry.id); setResult(r); if (r.ok) router.refresh(); });
  };

  const configured = entry.kind === 'pdf' ? entry.file_path : entry.kind === 'info' ? entry.body : entry.kind === 'phone' ? entry.phone : entry.url;
  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>{entry.label}</h2>
        <span className={`badge${configured ? '' : ' warn'}`}>{configured ? KIND_LABEL[entry.kind] : 'Not set up yet'}</span>
      </div>
      {entry.kind === 'pdf' && entry.file_name ? <p className="file-note">Current file: {entry.file_name} · {entry.updated}</p> : null}
      {entry.kind !== 'pdf' && configured && !editing ? <p className="file-note">{entry.kind === 'info' ? `${configured.slice(0, 140)}${configured.length > 140 ? '…' : ''}` : configured}</p> : null}

      {editing ? (
        <div className="stack" style={{ gap: '.25rem' }}>
          <div className="field"><label htmlFor={`l-${entry.id}`}>Name in app</label>
            <input id={`l-${entry.id}`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></div>
          {entry.kind !== 'pdf' ? (
            <>
              <div className="field"><label htmlFor={`k-${entry.id}`}>Type</label>
                <select id={`k-${entry.id}`} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  {(['url', 'info', 'phone', 'map'] as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select></div>
              <div className="field"><label htmlFor={`v-${entry.id}`}>{valueLabel(kind)}</label>
                <ValueField id={`v-${entry.id}`} kind={kind} value={value} onChange={setValue} /></div>
            </>
          ) : null}
          <div className="row">
            <button type="button" onClick={save} disabled={pending}>Save</button>
            <button type="button" className="secondary" onClick={() => { setEditing(false); setResult(null); }} disabled={pending}>Cancel</button>
          </div>
        </div>
      ) : null}

      <Feedback result={result} />
      {!editing ? (
        <div className="stack" style={{ gap: '.5rem' }}>
          {entry.kind === 'pdf' && entry.perms.upload
            ? <PdfUpload mode="replace" nodeId={entry.id} sectionId={sectionId} buttonLabel={entry.file_path ? 'Replace PDF' : 'Upload PDF'} />
            : null}
          <div className="row">
            {entry.perms.edit ? <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit</button> : null}
            {canMove && onMove ? (
              <>
                <button type="button" className="secondary icon-btn" aria-label={`Move ${entry.label} up`} onClick={() => onMove(-1)} disabled={pending}>↑</button>
                <button type="button" className="secondary icon-btn" aria-label={`Move ${entry.label} down`} onClick={() => onMove(1)} disabled={pending}>↓</button>
              </>
            ) : null}
            {entry.perms.delete ? <button type="button" className="danger" onClick={remove} disabled={pending}>Remove</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EntryList({ sectionId, entries, canReorder }: { sectionId: string; entries: EntryVM[]; canReorder: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState(entries.map((e) => e.id));
  const [result, setResult] = useState<Result | null>(null);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const ids = order.filter((id) => byId.has(id)).concat(entries.map((e) => e.id).filter((id) => !order.includes(id)));

  const move = async (id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice(); [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    const r = await reorderEntries(sectionId, next);
    setResult(r.ok ? null : r);
    if (!r.ok) setOrder(ids); else router.refresh();
  };

  if (!ids.length) return <div className="card muted">Nothing here yet.</div>;
  return (
    <>
      <Feedback result={result} />
      {ids.map((id) => (
        <EntryCard key={id} entry={byId.get(id)!} sectionId={sectionId} canMove={canReorder} onMove={(d) => move(id, d)} />
      ))}
    </>
  );
}

export function AddEntry({ sectionId, canUpload, canEdit }: { sectionId: string; canUpload: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Exclude<Kind, 'pdf'>>('url');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!canUpload && !canEdit) return null;
  const add = () => start(async () => {
    const r = await createEntry(sectionId, kind, label, value);
    setResult(r);
    if (r.ok) { setLabel(''); setValue(''); router.refresh(); }
  });
  return (
    <div className="card">
      <h2>Add to this section</h2>
      {canUpload ? (
        <details open={!canEdit}>
          <summary>Upload a new PDF</summary>
          <PdfUpload mode="new-entry" nodeId={sectionId} sectionId={sectionId} buttonLabel="Choose PDF and publish" allowLabel />
        </details>
      ) : null}
      {canEdit ? (
        <details>
          <summary>Add a link, form, information, phone number or map</summary>
          <div className="field"><label htmlFor="new-kind">Type</label>
            <select id="new-kind" value={kind} onChange={(e) => setKind(e.target.value as Exclude<Kind, 'pdf'>)}>
              {(['url', 'info', 'phone', 'map'] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select></div>
          <div className="field"><label htmlFor="new-label">Name in app</label>
            <input id="new-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></div>
          <div className="field"><label htmlFor="new-value">{valueLabel(kind)}</label>
            <ValueField id="new-value" kind={kind} value={value} onChange={setValue} /></div>
          <Feedback result={result} />
          <button type="button" onClick={add} disabled={pending || !label.trim()}>Add</button>
        </details>
      ) : null}
    </div>
  );
}
