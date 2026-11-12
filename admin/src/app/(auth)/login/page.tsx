import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signIn } from '@/app/actions';
import { AuthForm } from '@/components/Forms';
import { getMe } from '@/lib/me';

export default async function LoginPage() {
  if (await getMe()) redirect('/');
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        {/* PLACEHOLDER until the authorised Glencore logo is supplied (same file as the phone app). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-logo" src="/brand/logo.png" alt="Glencore" />
        <h1>MRM App Admin</h1>
        <p className="muted">Sign in to manage the McArthur River Mine app.</p>
        <AuthForm action={signIn} submit="Sign in">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required inputMode="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
        </AuthForm>
        <p style={{ marginTop: '1rem' }}><Link href="/forgot">Forgot your password?</Link></p>
      </div>
    </div>
  );
}
