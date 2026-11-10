import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTop } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { loadNodes, sortEntries } from '@/lib/content';
import { RoleEditor, type SectionVM } from '@/components/RoleEditor';

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTop();
  const db = await userClient();
  const [{ data: role }, { data: grants }, { data: sources }, nodes] = await Promise.all([
    db.from('roles').select('id,name').eq('id', id).maybeSingle(),
    db.from('role_grants').select('permission_id,node_id,source_id').eq('role_id', id),
    db.from('message_sources').select('id,label').eq('is_active', true).order('position'),
    loadNodes(),
  ]);
  if (!role) notFound();
  const sections: SectionVM[] = nodes
    .filter((n) => n.kind === 'section' && ['list', 'web', 'weather'].includes(n.section_type!))
    .map((s) => ({
      id: s.id, label: s.label, type: s.section_type!,
      entries: sortEntries(s, nodes.filter((n) => n.parent_id === s.id)).map((e) => ({ id: e.id, label: e.label, kind: e.kind })),
    }));
  return (
    <>
      <p><Link href="/roles">← All roles</Link></p>
      <h1>{role.name}</h1>
      <RoleEditor roleId={role.id} name={role.name} grants={grants ?? []} sections={sections} sources={sources ?? []} />
    </>
  );
}
