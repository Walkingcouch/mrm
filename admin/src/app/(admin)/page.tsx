import Link from 'next/link';
import { requireMe } from '@/lib/me';
import { loadNodes, visibleSections } from '@/lib/content';

export default async function AdminHome() {
  const me = await requireMe();
  const sections = visibleSections(await loadNodes(), me);
  return (
    <>
      <h1>Hello{me.display_name ? `, ${me.display_name}` : ''}</h1>
      <p className="muted">Choose what you&apos;d like to update. Changes appear in both apps without a store update.</p>
      {me.sources.length ? <Link className="list-link" href="/messages"><span>Send a message</span><span aria-hidden>›</span></Link> : null}
      {sections.map((s) => (
        <Link key={s.id} className="list-link" href={`/content/${s.id}`}><span>{s.label}</span><span aria-hidden>›</span></Link>
      ))}
      {!sections.length && !me.sources.length && !me.is_top
        ? <div className="card">You don&apos;t have access to any sections yet. Ask your Super Admin to assign you a role.</div>
        : null}
    </>
  );
}
