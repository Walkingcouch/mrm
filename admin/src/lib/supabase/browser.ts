'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserClient() {
  return (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY));
}
