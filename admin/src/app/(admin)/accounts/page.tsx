import { requireTop } from '@/lib/me';
import { userClient } from '@/lib/supabase/server';
import { AccountCard, NewAccount, type AccountVM } from '@/components/Accounts';

export default async function AccountsPage() {
  const me = await requireTop();
  const db = await userClient();
  const [{ data: accounts }, { data: roles }, { data: links }] = await Promise.all([
    db.from('admin_accounts').select('user_id,email,display_name,tier,disabled').order('email'),
    db.from('roles').select('id,name').order('name'),
    db.from('account_roles').select('user_id,role_id'),
  ]);
  const isDev = me.tier === 'app_developer';
  const vms: AccountVM[] = (accounts ?? []).map((a) => ({
    ...a,
    roles: (links ?? []).filter((l) => l.user_id === a.user_id).map((l) => l.role_id),
    self: a.user_id === me.user_id,
    // Hierarchy default: Super Admins manage delegated administrators; only the
    // App Developer manages Super Admins / App Developers. The database enforces this.
    manageable: a.user_id !== me.user_id && (isDev || a.tier === 'delegate'),
  }));
  return (
    <>
      <h1>Administrators</h1>
      <p className="muted">
        Hierarchy default: Super Admins add, disable and remove administrators and assign their roles. Only the App Developer appoints or removes Super Admins.
      </p>
      <NewAccount isAppDeveloper={isDev} />
      {vms.map((a) => <AccountCard key={a.user_id} a={a} roles={roles ?? []} />)}
    </>
  );
}
