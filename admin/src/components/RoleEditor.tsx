'use client';
// Checkbox permissions for one custom role. Grants are stored against stable
// permission ids + section/entry/source ids — never the role's name — so
// renaming a role never changes access.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteRole, renameRole, setRoleGrants } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

export interface Grant { permission_id: string; node_id?: string | null; source_id?: string | null }
export interface SectionVM { id: string; label: string; type: string; entries: { id: string; label: string; kind: string }[] }

const key = (g: Grant) => `${g.permission_id}|${g.node_id ?? ''}|${g.source_id ?? ''}`;
const CONTENT_ACTIONS = [
  { id: 'content.upload', label: 'Upload / replace PDFs', pdfOnly: true },
  { id: 'content.edit', label: 'Edit information & links' },
  { id: 'content.delete', label: 'Delete documents / entries' },
];

export function RoleEditor({ roleId, name, grants, sections, sources }: {
  roleId: string; name: string; grants: Grant[]; sections: SectionVM[]; sources: { id: string; label: string }[];
}) {
  const router = useRouter();
  const initial = useMemo(() => new Set(grants.map(key)), [grants]);
  const [sel, setSel] = useState<Set<string>>(initial);
  const [roleName, setRoleName] = useState(name);
  const [result, setResult] = useState<Result | null>(null);
  const [okText, setOkText] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const has = (p: string, node?: string, src?: string) => sel.has(key({ permission_id: p, node_id: node, source_id: src }));
  const toggle = (p: string, on: boolean, node?: string, src?: string) => {
    const n = new Set(sel);
    const k = key({ permission_id: p, node_id: node, source_id: src });
    if (on) n.add(k); else n.delete(k);
    // Section scope and action must both be granted: an action implies access,
    // and removing access removes the actions at that level.
    if (node && on && p !== 'content.access') n.add(key({ permission_id: 'content.access', node_id: node }));
    if (node && !on && p === 'content.access') CONTENT_ACTIONS.forEach((a) => n.delete(key({ permission_id: a.id, node_id: node })));
    setSel(n);
  };

  const save = () => start(async () => {
    const list: Grant[] = [...sel].map((k) => {
      const [permission_id, node_id, source_id] = k.split('|');
      return { permission_id, ...(node_id ? { node_id } : {}), ...(source_id ? { source_id } : {}) };
    });
    const r = await setRoleGrants(roleId, list);
    setOkText('Permissions saved. They apply immediately.'); setResult(r);
    if (r.ok) router.refresh();
  });

  // Plain render helper (not a component) so checkboxes keep focus across re-renders.
  const box = (p: string, label: string, node?: string, src?: string, k?: string) => (
    <label className="check" key={k ?? `${p}-${node ?? src ?? ''}`}>
      <input type="checkbox" checked={has(p, node, src)} onChange={(e) => toggle(p, e.target.checked, node, src)} /><span>{label}</span>
    </label>
  );

  return (
    <>
      <div className="card">
        <div className="field"><label htmlFor="role-name">Role name</label>
          <input id="role-name" type="text" value={roleName} onChange={(e) => setRoleName(e.target.value)} maxLength={80} /></div>
        <div className="row">
          <button type="button" className="secondary" disabled={pending || roleName.trim() === name || !roleName.trim()}
            onClick={() => start(async () => { const r = await renameRole(roleId, roleName); setOkText('Renamed.'); setResult(r); if (r.ok) router.refresh(); })}>Rename</button>
          <button type="button" className="danger" disabled={pending} onClick={() => {
            if (confirm(`Delete the role “${name}”? Everyone who has it loses these permissions immediately.`)) start(async () => { setResult(await deleteRole(roleId)); });
          }}>Delete role</button>
        </div>
      </div>

      <h2>Content</h2>
      {sections.map((s) => {
        const isList = s.type === 'list';
        return (
          <div key={s.id} className="card">
            <h2 style={{ marginBottom: 0 }}>{s.label}</h2>
            {box('content.access', isList ? 'Access whole section' : 'Access', s.id)}
            {CONTENT_ACTIONS.filter((a) => isList || a.id === 'content.edit').map((a) =>
              box(a.id, a.id === 'content.edit' && isList ? 'Add, edit, rename & reorder entries' : a.label, s.id))}
            {isList && s.entries.length ? (
              <details className="perm-group">
                <summary>Individual entries only</summary>
                {s.entries.map((e) => (
                  <div key={e.id} className="perm-group">
                    <strong>{e.label}</strong>
                    {box('content.access', 'Access', e.id)}
                    {CONTENT_ACTIONS.filter((a) => !a.pdfOnly || e.kind === 'pdf').map((a) => box(a.id, a.label, e.id))}
                  </div>
                ))}
              </details>
            ) : null}
          </div>
        );
      })}

      <h2>Messages</h2>
      {sources.length ? sources.map((s) => (
        <div key={s.id} className="card">
          <h2 style={{ marginBottom: 0 }}>{s.label}</h2>
          {box('message.publish', 'Publish messages from this source', undefined, s.id)}
          {box('push.department', 'Send phone notifications for this source', undefined, s.id)}
        </div>
      )) : <p className="muted">No message sources yet — add them under Message sources.</p>}
      <div className="card">
        <h2 style={{ marginBottom: 0 }}>Site-wide</h2>
        {box('push.global_general', 'Send site-wide general messages & notifications')}
        {box('push.global_emergency', 'Send emergency messages & notifications')}
        <p className="muted">Site-wide sending also needs “Publish” on at least one source above.</p>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '.5rem 0' }}>
        <Feedback result={result} okText={okText} />
        <button type="button" onClick={save} disabled={pending} style={{ width: '100%' }}>Save permissions</button>
      </div>
    </>
  );
}
