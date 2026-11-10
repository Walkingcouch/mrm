'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRole, setConfig, upsertSource } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

export function NewRole() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [result, setResult] = useState<Result<string> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <div className="field"><label htmlFor="role">New role name</label>
        <input id="role" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Kitchen/Mess" /></div>
      <Feedback result={result} />
      <button type="button" disabled={pending || !name.trim()} onClick={() => start(async () => {
        const r = await createRole(name); setResult(r);
        if (r.ok && r.data) router.push(`/roles/${r.data}`);
      })}>Create role</button>
    </div>
  );
}

export function SourceRow({ s }: { s: { id: string | null; label: string; subscribable: boolean; is_active: boolean } }) {
  const router = useRouter();
  const [label, setLabel] = useState(s.label);
  const [sub, setSub] = useState(s.subscribable);
  const [active, setActive] = useState(s.is_active);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <div className="field"><label htmlFor={`src-${s.id ?? 'new'}`}>{s.id ? 'Name shown on messages' : 'New source name'}</label>
        <input id={`src-${s.id ?? 'new'}`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Kitchen" /></div>
      <label className="check"><input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} /><span>Phone users can choose to follow this source</span></label>
      <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>Active</span></label>
      <Feedback result={result} okText={s.id ? 'Saved.' : undefined} />
      <button type="button" disabled={pending || !label.trim()} onClick={() => start(async () => {
        const r = await upsertSource(s.id, label, sub, active); setResult(r);
        if (r.ok) { if (!s.id) setLabel(''); router.refresh(); }
      })}>{s.id ? 'Save' : 'Add source'}</button>
    </div>
  );
}

export function RoutingForm({ mode, isAppDeveloper }: { mode: 'subscribers' | 'everyone'; isAppDeveloper: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(mode);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <h2>Team (departmental) notifications</h2>
      <p><span className="badge warn">Awaiting owner decision</span></p>
      <label className="check"><input type="radio" name="mode" checked={value === 'subscribers'} disabled={!isAppDeveloper} onChange={() => setValue('subscribers')} />
        <span>Only devices that follow the team (users choose in the app&apos;s Settings)</span></label>
      <label className="check"><input type="radio" name="mode" checked={value === 'everyone'} disabled={!isAppDeveloper} onChange={() => setValue('everyone')} />
        <span>Every device (no follow options shown in the app)</span></label>
      <p className="muted">Either way, every message appears in Employee Messages for everyone. Site-wide and emergency messages always notify every device.</p>
      <Feedback result={result} okText="Saved." />
      {isAppDeveloper ? <button type="button" disabled={pending || value === mode} onClick={() => start(async () => {
        const r = await setConfig('departmental_push_mode', value); setResult(r); if (r.ok) router.refresh();
      })}>Save</button> : <p className="muted">Changed by the App Developer once the owner confirms.</p>}
    </div>
  );
}
