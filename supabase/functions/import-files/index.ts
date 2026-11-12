// ONE-OFF Supabase Edge Function: import-files
// Copies the live app's PDFs (loaded by supabase/setup/live_content.sql as full
// https URLs) into this project's storage and points the rows at the copies.
// Safe to run more than once: rows already pointing at storage are skipped.
// Only fetches from the old app's attachment folder. Delete the function after use.
//
// POST with header x-dispatch-secret = the Vault secret 'push_dispatch_secret'.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SOURCE = 'https://storage.googleapis.com/gs.appbuild.io/apps/mcarthur/attachments/';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function copy(bucket: 'content' | 'messages', src: string, dest: string): Promise<number> {
  if (!src.startsWith(SOURCE)) throw new Error('not an allowed source');
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('not a PDF');
  const { error } = await db.storage.from(bucket).upload(dest, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  return bytes.length;
}

const safeName = (n: string) => n.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 150);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = req.headers.get('x-dispatch-secret') ?? '';
  const { data: ok } = await db.rpc('push_check_dispatch_secret', { p_secret: secret });
  if (ok !== true) return new Response('Unauthorised', { status: 401 });

  const report: { item: string; result: string }[] = [];

  const { data: nodes, error: e1 } = await db.from('content_nodes')
    .select('id,label,file_path,file_name').like('file_path', `${SOURCE}%`);
  if (e1) return new Response(e1.message, { status: 500 });
  for (const n of nodes ?? []) {
    const dest = `${n.id}/${safeName(n.file_name ?? 'document.pdf')}`;
    try {
      const size = await copy('content', n.file_path, dest);
      const { error } = await db.from('content_nodes').update({ file_path: dest, file_size: size }).eq('id', n.id);
      report.push({ item: n.label, result: error ? `row update failed: ${error.message}` : `copied (${size} bytes)` });
    } catch (e) {
      report.push({ item: n.label, result: `kept old link: ${e instanceof Error ? e.message : 'error'}` });
    }
  }

  const { data: atts, error: e2 } = await db.from('message_attachments')
    .select('id,file_path,file_name,message_id,messages(request_id)').like('file_path', `${SOURCE}%`);
  if (e2) return new Response(e2.message, { status: 500 });
  for (const a of atts ?? []) {
    const reqId = (a as unknown as { messages: { request_id: string } }).messages.request_id;
    const dest = `${reqId}/${safeName(a.file_name)}`;
    try {
      const size = await copy('messages', a.file_path, dest);
      const { error } = await db.from('message_attachments').update({ file_path: dest, file_size: size }).eq('id', a.id);
      report.push({ item: a.file_name, result: error ? `row update failed: ${error.message}` : `copied (${size} bytes)` });
    } catch (e) {
      report.push({ item: a.file_name, result: `kept old link: ${e instanceof Error ? e.message : 'error'}` });
    }
  }
  return Response.json({ count: report.length, report });
});
