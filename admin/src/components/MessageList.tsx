'use client';
// Message log on the admin website: grouped by day (Darwin time), newest first.
// Each entry: team + time on one line, the message, what it carries
// (attachments / linked item), then who sent it, its notification status and
// a small Delete action.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMessage } from '@/app/actions';
import { Feedback } from './Forms';
import type { Result } from '@/lib/result';

export interface MessageVM {
  id: string; source_label: string; scope: string; body: string;
  time: string;            // "7:24 pm"
  fullWhen: string;        // "12 Nov 2026, 7:24 pm" (tooltip)
  status: string; can_delete: boolean;
  senderName: string | null; senderEmail: string | null;
  attachments: number; linkLabel: string | null;
}
export interface MessageDay { label: string; messages: MessageVM[] }

const STATUS: Record<string, { text: string; tone: 'ok' | 'busy' | 'off' }> = {
  pending: { text: 'Notifying…', tone: 'busy' },
  dispatching: { text: 'Notifying…', tone: 'busy' },
  done: { text: 'Notifications sent', tone: 'ok' },
  expired: { text: 'Notification window closed', tone: 'off' },
  not_requested: { text: 'No notification', tone: 'off' },
};

function initials(name: string | null, email: string | null): string {
  const src = (name || email || '?').replace(/@.*/, '');
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Body({ text }: { text: string }) {
  const long = text.length > 280 || text.split('\n').length > 5;
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={`msg-body${long && !open ? ' clamped' : ''}`}>{text}</p>
      {long ? <button type="button" className="link-button" onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show more'}</button> : null}
    </>
  );
}

export function MessageList({ days }: { days: MessageDay[] }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (!days.length) return <p className="muted">No messages yet.</p>;
  return (
    <>
      <Feedback result={result} />
      {days.map((d) => (
        <section key={d.label} className="msg-day" aria-label={d.label}>
          <h3 className="msg-day-label">{d.label}</h3>
          <ul className="msg-list">
            {d.messages.map((m) => {
              const st = STATUS[m.status] ?? { text: m.status, tone: 'off' as const };
              const who = m.senderName && m.senderName.toLowerCase() !== m.senderEmail?.toLowerCase() ? m.senderName : m.senderEmail;
              return (
                <li key={m.id} className={`msg${m.scope === 'global_emergency' ? ' emergency' : ''}`}>
                  <div className="msg-head">
                    <strong className="msg-team">{m.source_label}</strong>
                    {m.scope === 'global_emergency' ? <span className="badge danger">Emergency</span>
                      : m.scope === 'global_general' ? <span className="badge">Site-wide</span> : null}
                    <time className="msg-time" title={m.fullWhen}>{m.time}</time>
                  </div>
                  <Body text={m.body} />
                  {m.attachments || m.linkLabel ? (
                    <p className="msg-extras">
                      {m.attachments ? <span>📎 {m.attachments} attachment{m.attachments === 1 ? '' : 's'}</span> : null}
                      {m.linkLabel ? <span>↗ Opens “{m.linkLabel}”</span> : null}
                    </p>
                  ) : null}
                  <div className="msg-foot">
                    <span className="msg-sender" title={m.senderEmail ?? undefined}>
                      <span className="avatar" aria-hidden="true">{who ? initials(m.senderName, m.senderEmail) : '–'}</span>
                      {who ?? <span className="muted">Sender not recorded</span>}
                    </span>
                    <span className={`chip ${st.tone}`}>{st.text}</span>
                    {m.can_delete ? (
                      <button type="button" className="link-button danger" disabled={pending} aria-label={`Delete message from ${m.source_label}, ${m.fullWhen}`}
                        onClick={() => {
                          if (!confirm('Delete this message from the app? Notifications already delivered stay on phones.')) return;
                          start(async () => { const r = await deleteMessage(m.id); setResult(r); if (r.ok) router.refresh(); });
                        }}>Delete</button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
