'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/app/actions';

export interface NavItem { href: string; label: string; group: 'Content' | 'Messages' | 'Administration' }

export function Shell({ items, who, children }: { items: NavItem[]; who: string; children: React.ReactNode }) {
  const path = usePathname();
  // The phone menu closes itself on navigation: it is "open" only for the page it was opened on.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const groups = ['Content', 'Messages', 'Administration'] as const;
  return (
    <>
      <header className="topbar">
        <button className="plain icon-btn menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
          aria-controls="sidenav" onClick={() => setOpenOn(open ? null : path)}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={open ? 'M6 6l12 12M18 6L6 18' : 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z'} stroke={open ? 'currentColor' : undefined} strokeWidth={open ? 2 : undefined} /></svg>
        </button>
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}>MRM App Admin</Link>
        <form action={signOut}><button className="plain" type="submit">Sign out</button></form>
      </header>
      <div className="layout">
        <nav id="sidenav" className={`sidenav${open ? ' open' : ''}`} aria-label="Admin sections">
          <div className="group" style={{ textTransform: 'none' }}>{who}</div>
          {groups.map((g) => {
            const list = items.filter((i) => i.group === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="group">{g}</div>
                {list.map((i) => (
                  <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}>{i.label}</Link>
                ))}
              </div>
            );
          })}
        </nav>
        <main>{children}</main>
      </div>
    </>
  );
}
