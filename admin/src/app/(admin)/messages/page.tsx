import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { formatDarwin } from '@/lib/time';
import { Composer } from '@/components/Composer';
import { MessageList, type MessageDay, type MessageVM } from '@/components/MessageList';

export default async function MessagesPage() {
  const me = await requireMe();
  if (!me.sources.length) redirect('/');
  const db = await userClient();
  const [{ data: rows }, { data: cfg }] = await Promise.all([
    db.rpc('admin_list_messages', { p_limit: 50 }),
    db.rpc('app_public_config'),
  ]);
  type Row = { id: string; source_label: string; scope: string; body: string; created_at: string; push_status: string; can_delete: boolean;
    sent_by_name: string | null; sent_by_email: string | null; attachment_count: number | null; link_label: string | null };
  const days = groupByDay((rows ?? []) as Row[], (m) => ({
    id: m.id, source_label: m.source_label, scope: m.scope, body: m.body,
    time: darwinTime(m.created_at), fullWhen: formatDarwin(m.created_at),
    status: m.push_status, can_delete: m.can_delete,
    senderName: m.sent_by_name?.trim() || null, senderEmail: m.sent_by_email,
    attachments: m.attachment_count ?? 0, linkLabel: m.link_label,
  }));
  return (
    <>
      <h1>Employee Messages</h1>
      <Composer sources={me.sources} globalGeneral={me.global_general} globalEmergency={me.global_emergency}
        routing={(cfg?.departmental_push_mode as 'subscribers' | 'everyone') ?? 'subscribers'} />
      <h2 style={{ marginTop: '1.5rem' }}>Recent messages</h2>
      <MessageList days={days} />
    </>
  );
}

const DARWIN_MS = 570 * 60_000; // UTC+9:30, no daylight saving
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function darwinTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DARWIN_MS);
  const h = d.getUTCHours();
  return `${((h + 11) % 12) + 1}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Today", "Yesterday", "Mon 10 Nov", or "Mon 10 Nov 2025" for other years (Darwin time). */
function groupByDay<R extends { created_at: string }>(rows: R[], toVM: (r: R) => MessageVM): MessageDay[] {
  const dayOf = (ms: number) => Math.floor((ms + DARWIN_MS) / 86_400_000);
  const today = dayOf(Date.now());
  const thisYear = new Date(Date.now() + DARWIN_MS).getUTCFullYear();
  const out: MessageDay[] = [];
  for (const r of rows) {
    const ms = new Date(r.created_at).getTime();
    const day = dayOf(ms);
    const d = new Date(ms + DARWIN_MS);
    const label = day === today ? 'Today' : day === today - 1 ? 'Yesterday'
      : `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${d.getUTCFullYear() !== thisYear ? ` ${d.getUTCFullYear()}` : ''}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.messages.push(toVM(r)); else out.push({ label, messages: [toVM(r)] });
  }
  return out;
}
