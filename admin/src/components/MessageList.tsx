'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMessage } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

export interface MessageVM { id: string; source_label: string; scope: string; body: string; when: string; status: string; can_delete: boolean }

const STATUS: Record<string, string> = {
  pending: 'Notifying…', dispatching: 'Notifying…', done: 'Notifications sent', expired: 'Notification window closed', not_requested: 'No notification',
};

export function MessageList({ messages }: { messages: MessageVM[] }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!messages.length) return <p className="muted">No messages yet.</p>;
  return (
    <>
      <Feedback result={result} />
      {messages.map((m) => (
        <div key={m.id} className="card">
          <div className="card-head">
            <strong>{m.source_label}</strong>
            {m.scope === 'global_emergency' ? <span className="badge danger">Emergency</span> : m.scope === 'global_general' ? <span className="badge">Site-wide</span> : null}
          </div>
          <p className="muted" style={{ marginBottom: '.25rem' }}>{m.when} · {STATUS[m.status] ?? m.status}</p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
          {m.can_delete ? (
            <button type="button" className="danger" disabled={pending} onClick={() => {
              if (!confirm('Delete this message from the app? Notifications already delivered stay on phones.')) return;
              start(async () => { const r = await deleteMessage(m.id); setResult(r); if (r.ok) router.refresh(); });
            }}>Delete</button>
          ) : null}
        </div>
      ))}
    </>
  );
}
