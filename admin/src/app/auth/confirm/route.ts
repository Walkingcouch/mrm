// Handles invite and password-recovery email links. The Supabase email
// templates must link here with the token hash (see docs/SETUP.md):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite|recovery
import { NextResponse, type NextRequest } from 'next/server';
import { userClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');
  const to = req.nextUrl.clone();
  to.search = '';
  if (tokenHash && (type === 'invite' || type === 'recovery')) {
    const db = await userClient();
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) { to.pathname = '/set-password'; return NextResponse.redirect(to); }
  }
  to.pathname = '/forgot';
  return NextResponse.redirect(to);
}
