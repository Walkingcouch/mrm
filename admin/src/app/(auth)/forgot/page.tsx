import Link from 'next/link';
import { requestPasswordReset } from '@/app/actions';
import { AuthForm } from '@/components/Forms';

export default function ForgotPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Reset password</h1>
        <p className="muted">We&apos;ll email you a link to choose a new password.</p>
        <AuthForm action={requestPasswordReset} submit="Send reset link"
          successMessage="If that address belongs to an administrator, a reset link is on its way. Check your inbox.">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required inputMode="email" />
          </div>
        </AuthForm>
        <p style={{ marginTop: '1rem' }}><Link href="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
