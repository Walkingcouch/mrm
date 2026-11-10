import Link from 'next/link';
import { requireTop } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { NewRole } from '@/components/SimpleForms';

export default async function RolesPage() {
  await requireTop();
  const db = await userClient();
  const { data: roles } = await db.from('roles').select('id,name').order('name');
  return (
    <>
      <h1>Roles &amp; permissions</h1>
      <p className="muted">
        Roles are named sets of checkbox permissions. An administrator can hold several roles and gets everything those roles allow.
        Suggested starting roles: Communications, Operations, Kitchen/Mess, Cleaning, Gun Club, HR. Emergency sending is never included unless you tick it.
      </p>
      {(roles ?? []).map((r) => (
        <Link key={r.id} className="list-link" href={`/roles/${r.id}`}><span>{r.name}</span><span aria-hidden>›</span></Link>
      ))}
      <NewRole />
    </>
  );
}
