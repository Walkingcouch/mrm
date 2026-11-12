// Invite and password-recovery email links land here. The Supabase email
// templates link to (see docs/SETUP.md):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite|recovery
//
// The one-time token is NOT used on this GET. Email security scanners
// (Outlook/Hotmail Safe Links, Gmail, antivirus) open links before the person
// does; if the GET used the token, the person's own click would find it
// already spent. Instead this forwards to /auth/continue, where the person
// presses a button (a POST) to use it. Scanners don't press buttons.
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash') ?? '';
  const type = req.nextUrl.searchParams.get('type') ?? '';
  const to = req.nextUrl.clone();
  to.search = '';
  if (/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash) && (type === 'invite' || type === 'recovery')) {
    to.pathname = '/auth/continue';
    to.searchParams.set('token_hash', tokenHash);
    to.searchParams.set('type', type);
  } else {
    to.pathname = '/forgot';
  }
  return NextResponse.redirect(to);
}
