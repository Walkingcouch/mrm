import { requireTop } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { RoutingForm } from '@/components/SimpleForms';

export default async function ConfigPage() {
  const me = await requireTop();
  const db = await userClient();
  const { data } = await db.rpc('app_public_config');
  return (
    <>
      <h1>App settings</h1>
      <RoutingForm mode={(data?.departmental_push_mode as 'subscribers' | 'everyone') ?? 'subscribers'} isAppDeveloper={me.tier === 'app_developer'} />
    </>
  );
}
