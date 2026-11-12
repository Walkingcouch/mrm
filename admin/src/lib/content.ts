import 'server-only';
import { userClient } from '@/lib/supabase/server';
import type { Me } from '@/lib/me';

export interface Node {
  id: string; parent_id: string | null; key: string | null; kind: 'section' | 'folder' | 'pdf' | 'url' | 'info' | 'phone' | 'map';
  section_type: 'home' | 'list' | 'web' | 'weather' | 'messages' | 'settings' | null; sort_mode: 'manual' | 'newest_first';
  label: string; position: number; url: string | null; body: string | null; phone: string | null; widget_html: string | null;
  file_path: string | null; file_name: string | null; file_size: number | null; file_updated_at: string | null; created_at: string;
  icon: string | null;
}

export async function loadNodes(): Promise<Node[]> {
  const db = await userClient();
  const { data, error } = await db.from('content_nodes')
    .select('id,parent_id,key,kind,section_type,sort_mode,label,position,url,body,phone,widget_html,file_path,file_name,file_size,file_updated_at,created_at,icon')
    .order('position');
  if (error) throw error;
  return (data ?? []) as Node[];
}

/** Can this admin see the node itself, or anything inside it (one folder level deep)? */
export function canSeeWithin(nodes: Node[], me: Me, id: string): boolean {
  return !!me.content[id]?.access || nodes.some((c) => c.parent_id === id
    && (me.content[c.id]?.access || (c.kind === 'folder' && nodes.some((g) => g.parent_id === c.id && me.content[g.id]?.access))));
}

/** Content-managed sections this admin can see (section grant or any grant inside it). */
export function visibleSections(nodes: Node[], me: Me): Node[] {
  return nodes.filter((n) => n.kind === 'section' && ['list', 'web', 'weather'].includes(n.section_type!) && canSeeWithin(nodes, me, n.id));
}

export function sortEntries(section: Node, entries: Node[]): Node[] {
  return section.sort_mode === 'newest_first'
    ? entries.slice().sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    : entries.slice().sort((a, b) => a.position - b.position);
}
