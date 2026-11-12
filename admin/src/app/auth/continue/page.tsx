// Second step of an invite / password-reset email link: the person confirms
// with a button, which uses the one-time token (see ../confirm/route.ts).
import Link from 'next/link';
import { confirmEmailLink } from '@/app/actions';
import { AuthForm } from '@/components/Forms';

export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash = '', type = '' } = await searchParams;
  const invite = type === 'invite';
  const valid = !!token_hash && (invite || type === 'recovery');
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-logo" src="/brand/logo.png" alt="Glencore" />
        <h1>{invite ? 'Welcome to MRM App Admin' : 'Reset your password'}</h1>
        {valid ? (
          <>
            <p className="muted">{invite ? 'Continue to choose your password.' : 'Continue to choose a new password.'}</p>
            <AuthForm action={confirmEmailLink} submit="Continue">
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
            </AuthForm>
          </>
        ) : (
          <div className="alert error" role="alert">This link is incomplete. Request a new one below.</div>
        )}
        <p style={{ marginTop: '1rem' }}><Link href="/forgot">Request a new link</Link> · <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
