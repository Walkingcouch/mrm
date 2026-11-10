import { requireMe, TIER_LABEL } from '@/lib/me';
import { loadNodes, visibleSections } from '@/lib/content';
import { Shell, type NavItem } from '@/components/Shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const nodes = await loadNodes();
  const items: NavItem[] = visibleSections(nodes, me).map((s) => ({ href: `/content/${s.id}`, label: s.label, group: 'Content' }));
  if (me.sources.length) items.push({ href: '/messages', label: 'Employee Messages', group: 'Messages' });
  if (me.is_top) {
    items.push(
      { href: '/accounts', label: 'Administrators', group: 'Administration' },
      { href: '/roles', label: 'Roles & permissions', group: 'Administration' },
      { href: '/sources', label: 'Message sources', group: 'Administration' },
      { href: '/config', label: 'App settings', group: 'Administration' },
    );
  }
  return <Shell items={items} who={`${me.display_name ?? me.email} · ${TIER_LABEL[me.tier]}`}>{children}</Shell>;
}
