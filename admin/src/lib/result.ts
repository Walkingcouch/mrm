export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Turn database / API errors into short, non-technical messages. */
export function friendly(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Something went wrong. Please try again.';
  if (err.code === '42501') {
    return err.message && err.message !== 'Not permitted' && !err.message.startsWith('permission denied')
      ? err.message : 'You do not have permission to do that.';
  }
  if (err.code === '22023' || err.code === 'P0002' || err.code === '23514' || err.code === '23505') {
    if (err.code === '23505') return 'That name is already in use.';
    if (err.code === '23514') return 'Please check the details you entered.';
    return err.message ?? 'Please check the details you entered.';
  }
  return 'Something went wrong. Please try again.';
}
