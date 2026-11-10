'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount, deleteAccount, setAccountDisabled, setAccountRoles } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

type Tier = 'app_developer' | 'super_admin' | 'delegate';
const TIER: Record<Tier, string> = { app_developer: 'App Developer', super_admin: 'Super Admin', delegate: 'Administrator' };
export interface AccountVM { user_id: string; email: string; display_name: string | null; tier: Tier; disabled: boolean; roles: string[]; manageable: boolean; self: boolean }

export function NewAccount({ isAppDeveloper }: { isAppDeveloper: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tier, setTier] = useState<Tier>('delegate');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="card">
      <summary>Add an administrator</summary>
      <p className="muted">They&apos;ll receive an email invitation to choose a password. Then tick the roles they need below.</p>
      <div className="field"><label htmlFor="na-email">Email</label>
        <input id="na-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="na-name">Name</label>
        <input id="na-name" type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {isAppDeveloper ? (
        <div className="field"><label htmlFor="na-tier">Access level</label>
          <select id="na-tier" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="delegate">Administrator (access from roles)</option>
            <option value="super_admin">Super Admin</option>
            <option value="app_developer">App Developer</option>
          </select></div>
      ) : null}
      <Feedback result={result} okText="Invitation sent." />
      <button type="button" disabled={pending || !email} onClick={() => start(async () => {
        const r = await createAccount({ email, name, tier }); setResult(r);
        if (r.ok) { setEmail(''); setName(''); setTier('delegate'); router.refresh(); }
      })}>Send invitation</button>
    </details>
  );
}

export function AccountCard({ a, roles }: { a: AccountVM; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(new Set(a.roles));
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const dirty = sel.size !== a.roles.length || a.roles.some((r) => !sel.has(r));
  const run = (fn: () => Promise<Result>) => start(async () => { const r = await fn(); setResult(r); if (r.ok) router.refresh(); });

  return (
    <div className="card">
      <div className="card-head">
        <div><strong>{a.display_name ?? a.email}</strong><div className="file-note">{a.email}</div></div>
        <span className="badge">{TIER[a.tier]}</span>
        {a.disabled ? <span className="badge danger">Disabled</span> : null}
      </div>
      {a.tier === 'delegate' && a.manageable ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="muted">Roles</legend>
          {roles.length ? roles.map((r) => (
            <label key={r.id} className="check">
              <input type="checkbox" checked={sel.has(r.id)} onChange={(e) => {
                const n = new Set(sel); if (e.target.checked) n.add(r.id); else n.delete(r.id); setSel(n);
              }} />
              <span>{r.name}</span>
            </label>
          )) : <p className="muted">No roles yet — create one under Roles &amp; permissions.</p>}
          {dirty ? <button type="button" disabled={pending} onClick={() => run(() => setAccountRoles(a.user_id, [...sel]))}>Save roles</button> : null}
        </fieldset>
      ) : null}
      <Feedback result={result} />
      {a.manageable ? (
        <div className="row" style={{ marginTop: '.5rem' }}>
          <button type="button" className="secondary" disabled={pending}
            onClick={() => run(() => setAccountDisabled(a.user_id, !a.disabled))}>{a.disabled ? 'Enable' : 'Disable'}</button>
          <button type="button" className="danger" disabled={pending} onClick={() => {
            if (confirm(`Remove ${a.email}? They will lose all access.`)) run(() => deleteAccount(a.user_id));
          }}>Remove</button>
        </div>
      ) : a.self ? <p className="muted">This is you.</p> : <p className="muted">Managed by the App Developer.</p>}
    </div>
  );
}
