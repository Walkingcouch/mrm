'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createEntry, deleteEntry, moveEntries, reorderEntries, setEntryIcon, updateEntry } from '@/app/actions';
import { Feedback } from './Forms';
import { PdfUpload, type NotifyOptions } from './PdfUpload';
import type { Result } from '@/lib/result';

export type Kind = 'pdf' | 'url' | 'info' | 'phone' | 'map' | 'folder';
export interface EntryVM {
  id: string; label: string; kind: Kind; url: string | null; body: string | null; phone: string | null;
  file_name: string | null; file_path: string | null; updated: string; perms: { upload: boolean; edit: boolean; delete: boolean };
  icon: string | null; itemCount?: number;
}

const KIND_LABEL: Record<Kind, string> = { pdf: 'PDF document', url: 'Website / form link', info: 'Information text', phone: 'Phone number', map: 'Map / directions link', folder: 'Folder' };

/** Icons the app can show next to an item (Material Community icon names). */
export const ICONS: { id: string; label: string }[] = [
  { id: '', label: 'Section default' },
  { id: 'handshake-outline', label: 'Handshake' },
  { id: 'account-group-outline', label: 'People' },
  { id: 'briefcase-outline', label: 'Briefcase' },
  { id: 'clipboard-text-outline', label: 'Clipboard / form' },
  { id: 'calendar-clock-outline', label: 'Calendar with clock' },
  { id: 'file-document-outline', label: 'Document' },
  { id: 'folder-outline', label: 'Folder' },
  { id: 'information-outline', label: 'Information' },
  { id: 'web', label: 'Website' },
  { id: 'phone-outline', label: 'Phone' },
  { id: 'map-marker-outline', label: 'Map pin' },
  { id: 'heart-pulse', label: 'Health' },
  { id: 'airplane', label: 'Plane' },
  { id: 'bus', label: 'Bus' },
  { id: 'silverware-fork-knife', label: 'Food' },
  { id: 'cash', label: 'Money' },
];
const iconLabel = (id: string | null) => ICONS.find((i) => i.id === (id ?? ''))?.label ?? id ?? 'Section default';

function ValueField({ kind, value, onChange, id }: { kind: Kind; value: string; onChange: (v: string) => void; id: string }) {
  if (kind === 'info') return <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={20000} />;
  if (kind === 'phone') return <input id={id} type="tel" inputMode="tel" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. +61 8 …" />;
  return <input id={id} type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />;
}
const valueLabel = (k: Kind) => (k === 'info' ? 'Text shown in the app' : k === 'phone' ? 'Phone number' : 'Link (https://…)');

export function EntryCard({ entry, sectionId, canMove, onMove, notify, selectable, selected, onSelect }: {
  entry: EntryVM; sectionId: string; canMove: boolean; onMove?: (dir: -1 | 1) => void; notify?: NotifyOptions;
  selectable?: boolean; selected?: boolean; onSelect?: (on: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(entry.label);
  const [kind, setKind] = useState<Kind>(entry.kind);
  const [value, setValue] = useState(entry.kind === 'info' ? entry.body ?? '' : entry.kind === 'phone' ? entry.phone ?? '' : entry.url ?? '');
  const [icon, setIcon] = useState(entry.icon ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const isFolder = entry.kind === 'folder';
  const save = () => start(async () => {
    const plain = kind === 'pdf' || kind === 'folder';
    let r = await updateEntry(sectionId, entry.id, label, plain ? kind === 'folder' ? 'folder' : null : kind, plain ? null : value);
    if (r.ok && icon !== (entry.icon ?? '')) r = await setEntryIcon(sectionId, entry.id, icon || null);
    setResult(r);
    if (r.ok) { setEditing(false); router.refresh(); }
  });
  const remove = () => {
    if (!confirm(`Remove “${entry.label}” from the app? This cannot be undone.`)) return;
    start(async () => { const r = await deleteEntry(sectionId, entry.id); setResult(r); if (r.ok) router.refresh(); });
  };

  const configured = isFolder ? 'folder' : entry.kind === 'pdf' ? entry.file_path : entry.kind === 'info' ? entry.body : entry.kind === 'phone' ? entry.phone : entry.url;
  return (
    <div className="card">
      <div className="card-head">
        {selectable ? (
          <input type="checkbox" className="select-box" checked={!!selected} onChange={(e) => onSelect?.(e.target.checked)}
            aria-label={`Select ${entry.label} to move`} />
        ) : null}
        <h2 style={{ margin: 0 }}>{entry.label}</h2>
        <span className={`badge${configured ? '' : ' warn'}`}>
          {isFolder ? `Folder · ${entry.itemCount ?? 0} item${entry.itemCount === 1 ? '' : 's'}` : configured ? KIND_LABEL[entry.kind] : 'Not set up yet'}
        </span>
      </div>
      <p className="file-note">Icon in app: {iconLabel(entry.icon)}</p>
      {entry.kind === 'pdf' && entry.file_name ? <p className="file-note">Current file: {entry.file_name} · {entry.updated}</p> : null}
      {entry.kind !== 'pdf' && !isFolder && configured && !editing ? <p className="file-note">{entry.kind === 'info' ? `${configured.slice(0, 140)}${configured.length > 140 ? '…' : ''}` : configured}</p> : null}

      {editing ? (
        <div className="stack" style={{ gap: '.25rem' }}>
          <div className="field"><label htmlFor={`l-${entry.id}`}>Name in app</label>
            <input id={`l-${entry.id}`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></div>
          <div className="field"><label htmlFor={`i-${entry.id}`}>Icon in app</label>
            <select id={`i-${entry.id}`} value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICONS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select></div>
          {entry.kind !== 'pdf' && !isFolder ? (
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
          {isFolder ? <Link className="list-link" href={`/content/${entry.id}`}><span>Open folder to manage its items</span><span aria-hidden>›</span></Link> : null}
          {entry.kind === 'pdf' && entry.perms.upload
            ? <PdfUpload mode="replace" nodeId={entry.id} sectionId={sectionId} buttonLabel={entry.file_path ? 'Replace PDF' : 'Upload PDF'}
                notify={notify ? { ...notify, itemLabel: entry.label } : undefined} />
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

/** Where items on this page can be moved to (a folder, or the section's main list). */
export interface MoveTarget { id: string; label: string; isFolder: boolean }

export function EntryList({ sectionId, entries, canReorder, notify, moveTargets = [] }: {
  sectionId: string; entries: EntryVM[]; canReorder: boolean; notify?: NotifyOptions; moveTargets?: MoveTarget[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState(entries.map((e) => e.id));
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [moving, startMove] = useTransition();
  const canSelect = (e: EntryVM) => moveTargets.length > 0 && e.perms.edit;
  // Folders can't go inside folders, so only offer the main list when a folder is selected.
  const folderSelected = selected.some((id) => entries.find((e) => e.id === id)?.kind === 'folder');
  const targets = moveTargets.filter((t) => !selected.includes(t.id) && !(folderSelected && t.isFolder));
  const move = () => startMove(async () => {
    const dest = targets.find((t) => t.id === target) ?? targets[0];
    if (!dest) return;
    const r = await moveEntries(sectionId, selected, dest.id);
    setResult(r.ok ? { ok: true, data: undefined } : r);
    if (r.ok) { setSelected([]); setTarget(''); router.refresh(); }
  });
  const byId = new Map(entries.map((e) => [e.id, e]));
  const ids = order.filter((id) => byId.has(id)).concat(entries.map((e) => e.id).filter((id) => !order.includes(id)));

  const moveBy = async (id: string, dir: -1 | 1) => {
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
      <Feedback result={result} okText="Moved." />
      {moveTargets.length ? (
        <p className="muted">Tick items, then choose where to move them.</p>
      ) : null}
      {ids.map((id) => {
        const e = byId.get(id)!;
        return (
          <EntryCard key={id} entry={e} sectionId={sectionId} canMove={canReorder} onMove={(d) => moveBy(id, d)} notify={notify}
            selectable={canSelect(e)} selected={selected.includes(id)}
            onSelect={(on) => setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)))} />
        );
      })}
      {selected.length ? (
        <div className="move-bar" role="region" aria-label="Move selected items">
          <strong>{selected.length} selected</strong>
          <label htmlFor="move-target" className="sr-only">Move to</label>
          <select id="move-target" value={target || targets[0]?.id || ''} onChange={(e) => setTarget(e.target.value)} disabled={!targets.length}>
            {targets.length ? targets.map((t) => <option key={t.id} value={t.id}>{t.isFolder ? `📁 ${t.label}` : t.label}</option>)
              : <option value="">No other place to move to</option>}
          </select>
          <button type="button" onClick={move} disabled={moving || !targets.length}>{moving ? 'Moving…' : 'Move'}</button>
          <button type="button" className="secondary" onClick={() => setSelected([])} disabled={moving}>Cancel</button>
        </div>
      ) : null}
    </>
  );
}

/** Simple line icons (teal) for the "Add" tiles. */
const TILE_ICON: Record<Kind, React.ReactNode> = {
  pdf: <path d="M7 3h7l5 5v13H7zM14 3v5h5M9.5 13h5M9.5 16.5h5" />,
  url: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5" />,
  phone: <path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />,
  map: <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21zM12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  folder: <path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z" />,
};
const TILE_TEXT: Record<Kind, { title: string; hint: string }> = {
  pdf: { title: 'PDF document', hint: 'Upload a file' },
  url: { title: 'Link or form', hint: 'A web page or online form' },
  info: { title: 'Information', hint: 'A short piece of text' },
  phone: { title: 'Phone number', hint: 'Tap to call in the app' },
  map: { title: 'Map', hint: 'Directions or a location' },
  folder: { title: 'Folder', hint: 'A heading that groups items' },
};

export function AddEntry({ sectionId, canUpload, canEdit, canAddFolder = false, inFolder = false, notify }: {
  sectionId: string; canUpload: boolean; canEdit: boolean; canAddFolder?: boolean; inFolder?: boolean; notify?: NotifyOptions;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!canUpload && !canEdit) return null;
  const kinds: Kind[] = [
    ...(canUpload ? ['pdf' as const] : []),
    ...(canEdit ? (['url', 'info', 'phone', 'map'] as const) : []),
    ...(canEdit && canAddFolder ? ['folder' as const] : []),
  ];
  const choose = (k: Kind) => { setKind(kind === k ? null : k); setResult(null); };
  const add = () => start(async () => {
    if (!kind || kind === 'pdf') return;
    const r = await createEntry(sectionId, kind, label, kind === 'folder' ? '' : value);
    setResult(r);
    if (r.ok) { setLabel(''); setValue(''); setKind(null); router.refresh(); }
  });
  return (
    <div className="card add-card">
      <h2>{inFolder ? 'Add to this folder' : 'Add to this section'}</h2>
      <p className="muted">Choose what to add.</p>
      <div className="add-grid" role="group" aria-label="Type of item to add">
        {kinds.map((k) => (
          <button key={k} type="button" className={`add-tile${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => choose(k)}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TILE_ICON[k]}</svg>
            <span className="add-tile-title">{TILE_TEXT[k].title}</span>
            <span className="add-tile-hint">{TILE_TEXT[k].hint}</span>
          </button>
        ))}
      </div>

      {kind === 'pdf' ? (
        <div className="add-form">
          <PdfUpload mode="new-entry" nodeId={sectionId} sectionId={sectionId} buttonLabel="Choose PDF and publish" allowLabel notify={notify} />
        </div>
      ) : kind ? (
        <div className="add-form">
          <div className="field"><label htmlFor="new-label">{kind === 'folder' ? 'Folder name (shown as a heading in the app)' : 'Name in app'}</label>
            <input id="new-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} autoFocus
              placeholder={kind === 'folder' ? 'e.g. Benefits & Rewards' : kind === 'phone' ? 'e.g. Call Security' : ''} /></div>
          {kind === 'folder' ? <p className="muted">Then tick the items that belong in it and use Move.</p> : (
            <div className="field"><label htmlFor="new-value">{valueLabel(kind)}</label>
              <ValueField id="new-value" kind={kind} value={value} onChange={setValue} /></div>
          )}
          <Feedback result={result} />
          <div className="row">
            <button type="button" onClick={add} disabled={pending || !label.trim()}>{pending ? 'Adding…' : `Add ${TILE_TEXT[kind].title.toLowerCase()}`}</button>
            <button type="button" className="secondary" onClick={() => setKind(null)} disabled={pending}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "+ New folder": one field and one button, at the top of a section. */
export function NewFolder({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="secondary" onClick={() => { setOpen(true); setResult(null); }}>+ New folder</button>;
  const create = () => start(async () => {
    const r = await createEntry(sectionId, 'folder', name, '');
    setResult(r);
    if (r.ok) { setName(''); setOpen(false); router.refresh(); }
  });
  return (
    <div className="card">
      <div className="field"><label htmlFor="new-folder">Folder name (shown as a heading in the app)</label>
        <input id="new-folder" type="text" value={name} maxLength={120} autoFocus placeholder="e.g. Benefits & Rewards"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) create(); }} /></div>
      <Feedback result={result} />
      <div className="row">
        <button type="button" onClick={create} disabled={pending || !name.trim()}>Create folder</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
      </div>
      <p className="muted" style={{ marginTop: '.5rem', marginBottom: 0 }}>Then tick the items that belong in it and use Move.</p>
    </div>
  );
}
