// Supabase Edge Function: dispatch-push
// POST {"message_id": "<uuid>"}  -> dispatch one message (called right after Send)
// POST {"sweep": true}           -> retry anything pending within its 24h window (pg_cron)
// Caller must present the service-role/secret key (website server) or the
// dispatch secret (pg_cron, header x-dispatch-secret). Deployed with
// --no-verify-jwt; the function checks these itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { dispatchMessage, sendToExpoHttp, type Deps } from '../_shared/dispatch-core.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function rpcOrThrow<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return db.rpc(name, args).then(({ data, error }) => {
    if (error) throw new Error(`${name}: ${error.message}`);
    return data as T;
  });
}

const deps: Deps = {
  claimBatch: (id, limit) => rpcOrThrow('push_claim_batch', { p_message: id, p_limit: limit }),
  recordResults: (id, results) => rpcOrThrow('push_record_results', { p_message: id, p_results: results }),
  finish: (id) => rpcOrThrow('push_finish', { p_message: id }),
  sendToExpo: (msgs) => sendToExpoHttp(msgs, expoToken),
  now: () => Math.floor(Date.now() / 1000),
};

async function authorised(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? '';
  const header = req.headers.get('x-dispatch-secret') ?? '';
  if (auth === `Bearer ${serviceKey}`) return true;
  // New-style secret keys (sb_secret_…): accept if the key can call a
  // service-role-only function.
  if (auth.startsWith('Bearer sb_secret_')) {
    const caller = createClient(url, auth.slice(7), { auth: { persistSession: false } });
    const { error } = await caller.rpc('push_check_dispatch_secret', { p_secret: '' });
    if (!error) return true;
  }
  if (header.length < 32) return false;
  if (dispatchSecret.length >= 32) return header === dispatchSecret;
  // No env secret set: compare with the Vault secret the database generated.
  const { data } = await db.rpc('push_check_dispatch_secret', { p_secret: header });
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!(await authorised(req))) return new Response('Unauthorised', { status: 401 });

  let body: { message_id?: string; sweep?: boolean };
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  try {
    if (body.message_id) {
      const summary = await dispatchMessage(deps, body.message_id);
      return Response.json(summary);
    }
    if (body.sweep) {
      const ids = await rpcOrThrow<string[]>('push_due_messages', {});
      const summaries = [];
      for (const id of ids ?? []) summaries.push(await dispatchMessage(deps, id));
      return Response.json({ swept: summaries.length, summaries });
    }
    return new Response('Nothing to do', { status: 400 });
  } catch (e) {
    // Operational log only: no message text, tokens or personal data.
    console.error('dispatch-push failed', e instanceof Error ? e.message : 'unknown');
    return new Response('Dispatch error', { status: 500 });
  }
});
