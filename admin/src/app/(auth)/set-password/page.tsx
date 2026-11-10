import { setPassword } from '@/app/actions';
import { AuthForm } from '@/components/Forms';

export default function SetPasswordPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Choose a password</h1>
        <AuthForm action={setPassword} submit="Save password">
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </div>
        </AuthForm>
      </div>
    </div>
  );
}
