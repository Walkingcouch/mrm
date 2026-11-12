import { requireTop } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { SourceRow } from '@/components/SimpleForms';

export default async function SourcesPage() {
  await requireTop();
  const db = await userClient();
  const { data } = await db.from('message_sources').select('id,label,subscribable,is_active').order('position');
  return (
    <>
      <h1>Message sources</h1>
      <p className="muted">
        The team names messages are sent from (e.g. Kitchen, Gun Club, Operations). Administrators can only send as sources their roles allow.
        Renaming or deleting a source does not change messages already sent; they keep the name they were sent under.
      </p>
      {(data ?? []).map((s) => <SourceRow key={s.id} s={s} />)}
      <SourceRow s={{ id: null, label: '', subscribable: true, is_active: true }} />
    </>
  );
}
