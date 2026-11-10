import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { userClient } from '@/lib/supabase/server';

export type Tier = 'app_developer' | 'super_admin' | 'delegate';
export interface ContentPerms { access: boolean; upload: boolean; edit: boolean; delete: boolean }
export interface Me {
  user_id: string; email: string; display_name: string | null; tier: Tier; is_top: boolean;
  content: Record<string, ContentPerms>;
  sources: { id: string; label: string; push: boolean }[];
  global_general: boolean; global_emergency: boolean;
}

/** The signed-in, enabled administrator and their effective permissions (from the DB). */
export const getMe = cache(async (): Promise<Me | null> => {
  const db = await userClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.rpc('admin_me');
  if (error || !data) return null;
  return data as Me;
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect('/login');
  return me;
}

export async function requireTop(): Promise<Me> {
  const me = await requireMe();
  if (!me.is_top) redirect('/');
  return me;
}

export const TIER_LABEL: Record<Tier, string> = {
  app_developer: 'App Developer',
  super_admin: 'Super Admin',
  delegate: 'Administrator',
};
