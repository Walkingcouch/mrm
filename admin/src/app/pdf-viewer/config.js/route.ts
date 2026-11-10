// Tells the self-hosted PDF viewer which files it may open: only public
// objects in this project's storage.
import { SUPABASE_URL } from '@/lib/env';

export function GET() {
  const prefix = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/` : '';
  return new Response(`export const ALLOWED_PREFIX = ${JSON.stringify(prefix)};\n`, {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
