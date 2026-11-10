'use client';
import { useActionState } from 'react';
import type { Result } from '@/lib/result';

type Action = (prev: Result, form: FormData) => Promise<Result>;
const INITIAL: Result<string> = { ok: true, data: '__initial__' };

/** Simple server-action form for sign-in / password screens. */
export function AuthForm({ action, submit, children, successMessage }: {
  action: Action; submit: string; children: React.ReactNode; successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL as Result);
  const submittedOk = state.ok && state.data !== '__initial__';
  if (submittedOk && successMessage) return <div className="alert ok" role="status">{successMessage}</div>;
  return (
    <form action={formAction} className="stack">
      {!state.ok ? <div className="alert error" role="alert">{state.error}</div> : null}
      {children}
      <button type="submit" disabled={pending}>{pending ? 'Please wait…' : submit}</button>
    </form>
  );
}

export function Feedback({ result, okText }: { result: Result<unknown> | null; okText?: string }) {
  if (!result) return null;
  if (!result.ok) return <div className="alert error" role="alert">{result.error}</div>;
  return okText ? <div className="alert ok" role="status">{okText}</div> : null;
}
