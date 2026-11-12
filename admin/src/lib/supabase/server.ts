import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/** Acts as the signed-in administrator. All permission checks run in the database. */
export async function userClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a Server Component: the proxy refreshes cookies */ }
      },
    },
  });
}

/**
 * Service-role client. Server-only; never imported by client components.
 * Used ONLY for: issuing signed upload URLs after a permission check,
 * deleting replaced files, auth user creation/ban, and triggering push dispatch.
 */
/** Server-only Supabase key. Vercel variable SUPABASE_SERVICE_ROLE_KEY, or Supabase_private (as set in this project). */
export function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.Supabase_private || undefined;
}

export function serviceClient() {
  const key = serviceKey();
  if (!key) throw new Error('The Supabase private key (SUPABASE_SERVICE_ROLE_KEY or Supabase_private) is not configured');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
