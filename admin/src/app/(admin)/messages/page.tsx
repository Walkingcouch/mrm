import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { formatDarwin } from '@/lib/time';
import { Composer } from '@/components/Composer';
import { MessageList, type MessageVM } from '@/components/MessageList';

export default async function MessagesPage() {
  const me = await requireMe();
  if (!me.sources.length) redirect('/');
  const db = await userClient();
  const [{ data: rows }, { data: cfg }] = await Promise.all([
    db.rpc('admin_list_messages', { p_limit: 50 }),
    db.rpc('app_public_config'),
  ]);
  type Row = { id: string; source_label: string; scope: string; body: string; created_at: string; push_status: string; can_delete: boolean;
    sent_by_name: string | null; sent_by_email: string | null };
  const messages: MessageVM[] = ((rows ?? []) as Row[])
    .map((m) => ({ id: m.id, source_label: m.source_label, scope: m.scope, body: m.body, when: formatDarwin(m.created_at), status: m.push_status, can_delete: m.can_delete,
      sender: senderLabel(m.sent_by_name, m.sent_by_email) }));
  return (
    <>
      <h1>Employee Messages</h1>
      <Composer sources={me.sources} globalGeneral={me.global_general} globalEmergency={me.global_emergency}
        routing={(cfg?.departmental_push_mode as 'subscribers' | 'everyone') ?? 'subscribers'} />
      <h2 style={{ marginTop: '1.5rem' }}>Recent messages</h2>
      <MessageList messages={messages} />
    </>
  );
}

/** "Kitchen Admin (kitchen@…)", or just the email if there is no separate name. Messages imported from the old app have no sender on record. */
function senderLabel(name: string | null, email: string | null): string {
  const n = name?.trim();
  if (email) return n && n.toLowerCase() !== email.toLowerCase() ? `${n} (${email})` : email;
  return n || 'not recorded';
}
