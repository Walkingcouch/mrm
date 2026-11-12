import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMe, type Me } from '@/lib/me';
import { canSeeWithin, loadNodes, sortEntries, type Node } from '@/lib/content';
import { formatDarwin } from '@/lib/time';
import { AddEntry, EntryList, type EntryVM } from '@/components/EntryEditor';
import { SectionLinkForm, WeatherWidgetForm } from '@/components/SectionLinkForm';

function toVM(nodes: Node[], me: Me, e: Node): EntryVM {
  return {
    id: e.id, label: e.label, kind: e.kind as EntryVM['kind'], url: e.url, body: e.body, phone: e.phone,
    file_name: e.file_name, file_path: e.file_path, updated: formatDarwin(e.file_updated_at), icon: e.icon,
    itemCount: e.kind === 'folder' ? nodes.filter((c) => c.parent_id === e.id).length : undefined,
    perms: { upload: !!me.content[e.id]?.upload, edit: !!me.content[e.id]?.edit, delete: !!me.content[e.id]?.delete },
  };
}

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe();
  const nodes = await loadNodes();
  const node = nodes.find((n) => n.id === id && (n.kind === 'section' || n.kind === 'folder'));
  if (!node) notFound();

  // A folder inside a list section (e.g. HR & Payroll → Benefits & Rewards).
  if (node.kind === 'folder') {
    const parent = nodes.find((n) => n.id === node.parent_id)!;
    const fp = me.content[node.id];
    const items = sortEntries(parent, nodes.filter((n) => n.parent_id === node.id)).filter((e) => me.content[e.id]?.access);
    if (!fp?.access && !items.length) notFound();
    return (
      <>
        <p><Link href={`/content/${parent.id}`}>← {parent.label}</Link></p>
        <h1>{node.label}</h1>
        <p className="muted">A folder in {parent.label}. Shown in the app in this order.</p>
        <EntryList sectionId={node.id} entries={items.map((e) => toVM(nodes, me, e))} canReorder={!!fp?.edit && parent.sort_mode === 'manual'} />
        <AddEntry sectionId={node.id} canUpload={!!fp?.upload} canEdit={!!fp?.edit} inFolder />
      </>
    );
  }

  const section = node;
  const sp = me.content[section.id];
  const visibleEntries = sortEntries(section, nodes.filter((n) => n.parent_id === section.id))
    .filter((e) => me.content[e.id]?.access || (e.kind === 'folder' && canSeeWithin(nodes, me, e.id)));
  if (!sp?.access && !visibleEntries.length) notFound();

  if (section.section_type === 'web') {
    return (
      <>
        <h1>{section.label}</h1>
        <p className="muted">The app opens this page in an in-app browser. Use the FlightAware page for McArthur River Mine Airport — not the FlightAware home or search page.</p>
        {sp?.edit
          ? <SectionLinkForm sectionId={section.id} url={section.url} help="Paste the exact airport page address from FlightAware." />
          : <div className="card file-note">{section.url ?? 'Not set up yet.'}</div>}
      </>
    );
  }

  if (section.section_type === 'weather') {
    return (
      <>
        <h1>{section.label}</h1>
        {sp?.edit
          ? <SectionLinkForm sectionId={section.id} url={section.url} help="The WillyWeather page for McArthur River Mine Airport. Used when no widget is set, or if the widget fails to load." />
          : <div className="card file-note">{section.url ?? 'Not set up yet.'}</div>}
        {me.is_top ? <WeatherWidgetForm sectionId={section.id} html={section.widget_html} /> : null}
      </>
    );
  }

  const vms: EntryVM[] = visibleEntries.map((e) => toVM(nodes, me, e));

  return (
    <>
      <h1>{section.label}</h1>
      {section.sort_mode === 'newest_first'
        ? <p className="muted">Issues are listed newest first in the app. Upload each new monthly issue as a new PDF; older issues stay until removed.</p>
        : <p className="muted">Shown in the app in this order.</p>}
      <EntryList sectionId={section.id} entries={vms} canReorder={!!sp?.edit && section.sort_mode === 'manual'} />
      <AddEntry sectionId={section.id} canUpload={!!sp?.upload} canEdit={!!sp?.edit && section.key !== 'memorandum'} canAddFolder={section.key !== 'memorandum'} />
    </>
  );
}
