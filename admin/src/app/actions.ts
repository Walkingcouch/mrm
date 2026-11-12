'use server';
// Server actions. Each one runs as the signed-in administrator; the database
// functions enforce permissions independently of what the UI shows. The
// service-role client is used only where noted.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMe } from '@/lib/me';
import { serviceClient, userClient, serviceKey } from '@/lib/supabase/server';
import { LIMITS, SITE_URL, SUPABASE_URL, publicFileUrl } from '@/lib/env';
import { friendly, type Result } from '@/lib/result';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

// ---------------------------------------------------------------- auth

export async function signIn(_prev: Result, form: FormData): Promise<Result> {
  const db = await userClient();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? ''),
  });
  if (error) return { ok: false, error: 'Email or password is incorrect.' };
  const me = await getMe();
  if (!me) { await db.auth.signOut(); return { ok: false, error: 'This account does not have administrator access.' }; }
  redirect('/');
}

export async function signOut() {
  const db = await userClient();
  await db.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(_prev: Result, form: FormData): Promise<Result> {
  const db = await userClient();
  const { error } = await db.auth.resetPasswordForEmail(String(form.get('email') ?? '').trim(), { redirectTo: `${SITE_URL}/auth/confirm` });
  // Email sending is limited per hour for the whole project, so saying so
  // reveals nothing about whether this address has an account.
  if (error && (error.status === 429 || error.code === 'over_email_send_rate_limit')) {
    return { ok: false, error: 'Too many emails have been sent in the last hour. Please try again later.' };
  }
  // Otherwise the same response whether or not the address exists.
  return { ok: true };
}

/** Use the one-time token from an invite / reset email (button press on /auth/continue). */
export async function confirmEmailLink(_prev: Result, form: FormData): Promise<Result> {
  const token_hash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '');
  if (!token_hash || (type !== 'invite' && type !== 'recovery')) return { ok: false, error: 'This link is incomplete. Request a new one.' };
  const db = await userClient();
  const { error } = await db.auth.verifyOtp({ token_hash, type });
  if (error) return { ok: false, error: 'This link has expired or has already been used. Use "Request a new link" below.' };
  redirect('/set-password');
}

export async function setPassword(_prev: Result, form: FormData): Promise<Result> {
  const pw = String(form.get('password') ?? '');
  if (pw.length < 10) return { ok: false, error: 'Use at least 10 characters.' };
  if (pw !== String(form.get('confirm') ?? '')) return { ok: false, error: 'The passwords do not match.' };
  const db = await userClient();
  const { error } = await db.auth.updateUser({ password: pw });
  if (error) return { ok: false, error: 'Could not set the password. The link may have expired — request a new one.' };
  redirect('/');
}

// ---------------------------------------------------------------- uploads

/** Check a file's first bytes so a renamed non-PDF/image is rejected. */
async function sniff(bucket: 'content' | 'messages', path: string): Promise<string | null> {
  const res = await fetch(publicFileUrl(bucket, path), { headers: { range: 'bytes=0-1023' }, cache: 'no-store' });
  if (!res.ok) return null;
  const b = new Uint8Array(await res.arrayBuffer());
  const ascii = new TextDecoder('latin1').decode(b);
  if (ascii.includes('%PDF-')) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image/png';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp' && /hei[cx]|mif1|heim|heis/.test(ascii.slice(8, 12))) return 'image/heic';
  return null;
}

export type UploadTicket = { bucket: 'content' | 'messages'; path: string; token: string; entryId?: string };

/**
 * Issue a one-time signed upload URL. The browser uploads straight to storage
 * (no size limit from our server), always to a NEW path, so a failed upload
 * never touches the live document. Nothing is published until finalize.
 */
export async function createUpload(input: {
  kind: 'replace' | 'new-entry' | 'attachment'; nodeId?: string; requestId?: string;
  fileName: string; size: number; mime: string;
}): Promise<Result<UploadTicket>> {
  const me = await getMe();
  if (!me) return { ok: false, error: 'Please sign in again.' };
  const rand = crypto.randomUUID();

  if (input.kind === 'attachment') {
    if (!isUuid(input.requestId)) return { ok: false, error: 'Invalid request.' };
    if (!me.sources.length) return { ok: false, error: 'You do not have permission to send messages.' };
    if (!(LIMITS.attachmentMimes as readonly string[]).includes(input.mime)) return { ok: false, error: 'Attach PDFs or images (JPG, PNG, WEBP, HEIC) only.' };
    if (input.size > LIMITS.attachmentBytes) return { ok: false, error: 'Attachments must be 15 MB or smaller.' };
    const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }[input.mime];
    const path = `${input.requestId}/${rand}.${ext}`;
    const { data, error } = await serviceClient().storage.from('messages').createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: 'Could not start the upload.' };
    return { ok: true, data: { bucket: 'messages', path, token: data.token } };
  }

  if (!isUuid(input.nodeId)) return { ok: false, error: 'Invalid request.' };
  if (input.mime !== 'application/pdf' || !/\.pdf$/i.test(input.fileName)) return { ok: false, error: 'Choose a PDF file.' };
  if (input.size > LIMITS.pdfBytes) return { ok: false, error: 'PDFs must be 25 MB or smaller.' };
  if (!me.content[input.nodeId]?.upload) return { ok: false, error: 'You do not have permission to upload here.' };
  const entryId = input.kind === 'new-entry' ? crypto.randomUUID() : input.nodeId;
  const path = `${entryId}/${rand}.pdf`;
  const { data, error } = await serviceClient().storage.from('content').createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: 'Could not start the upload.' };
  return { ok: true, data: { bucket: 'content', path, token: data.token, entryId } };
}

/** Publish an uploaded PDF: replace an entry's file, or create a new PDF entry. */
export async function finalizePdf(input: {
  kind: 'replace' | 'new-entry'; nodeId: string; entryId: string; path: string;
  fileName: string; size: number; label?: string; sectionId: string;
}): Promise<Result> {
  const svc = serviceClient();
  if ((await sniff('content', input.path)) !== 'application/pdf') {
    await svc.storage.from('content').remove([input.path]);
    return { ok: false, error: 'That file is not a valid PDF.' };
  }
  const db = await userClient();
  const label = input.label?.trim() || null;
  const { data, error } = input.kind === 'replace'
    ? await db.rpc('admin_attach_pdf', { p_id: input.nodeId, p_path: input.path, p_file_name: input.fileName, p_size: input.size, p_label: label })
    : await db.rpc('admin_create_pdf_entry', { p_section: input.nodeId, p_entry_id: input.entryId, p_path: input.path, p_file_name: input.fileName, p_size: input.size, p_label: label });
  if (error) {
    await svc.storage.from('content').remove([input.path]);
    return { ok: false, error: friendly(error) };
  }
  // Old file removed only after the new one is live (no version archive).
  if (input.kind === 'replace' && typeof data === 'string' && data) await svc.storage.from('content').remove([data]);
  revalidatePath(`/content/${input.sectionId}`);
  return { ok: true };
}

// ---------------------------------------------------------------- content entries

type Kind = 'url' | 'info' | 'phone' | 'map' | 'folder';

export async function createEntry(sectionId: string, kind: Kind, label: string, value: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_create_entry', {
    p_section: sectionId, p_kind: kind, p_label: label,
    p_url: kind === 'url' || kind === 'map' ? value : null,
    p_body: kind === 'info' ? value : null,
    p_phone: kind === 'phone' ? value : null,
  });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

export async function updateEntry(sectionId: string, id: string, label: string | null, kind: Kind | 'pdf' | null, value: string | null): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_update_entry', {
    p_id: id, p_label: label, p_kind: kind,
    p_url: kind === 'url' || kind === 'map' || kind === null ? value : null,
    p_body: kind === 'info' ? value : null,
    p_phone: kind === 'phone' ? value : null,
  });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

/** Move items into a folder, back to the section, or between folders. */
export async function moveEntries(pageId: string, ids: string[], targetId: string): Promise<Result<number>> {
  const db = await userClient();
  const { data, error } = await db.rpc('admin_move_entries', { p_ids: ids, p_target: targetId });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${pageId}`);
  revalidatePath(`/content/${targetId}`);
  return { ok: true, data: (data as number) ?? 0 };
}

export async function setEntryIcon(sectionId: string, id: string, icon: string | null): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_entry_icon', { p_id: id, p_icon: icon });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

export async function deleteEntry(sectionId: string, id: string): Promise<Result> {
  const db = await userClient();
  const { data, error } = await db.rpc('admin_delete_entry', { p_id: id });
  if (error) return { ok: false, error: friendly(error) };
  if (typeof data === 'string' && data) await serviceClient().storage.from('content').remove([data]);
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

export async function reorderEntries(sectionId: string, ids: string[]): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_reorder_entries', { p_section: sectionId, p_ids: ids });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

export async function setWeatherWidget(sectionId: string, html: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_weather_widget', { p_html: html });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/content/${sectionId}`);
  return { ok: true };
}

// ---------------------------------------------------------------- messages

export async function sendMessage(input: {
  requestId: string; sourceId: string; scope: 'department' | 'global_general' | 'global_emergency';
  body: string; attachments: { path: string; name: string; mime: string; size: number }[];
  /** Menu item the message is about; the app shows an "Open …" button for it. */
  linkNodeId?: string;
}): Promise<Result<{ pushed: boolean }>> {
  if (!isUuid(input.requestId) || !isUuid(input.sourceId)) return { ok: false, error: 'Invalid request.' };
  if (input.linkNodeId && !isUuid(input.linkNodeId)) return { ok: false, error: 'Invalid request.' };
  if (!input.body.trim()) return { ok: false, error: 'Write a message first.' };
  for (const a of input.attachments) {
    const real = await sniff('messages', a.path);
    if (!real || real !== a.mime) return { ok: false, error: `“${a.name}” is not a valid PDF or image.` };
  }
  const db = await userClient();
  const { data, error } = await db.rpc('admin_send_message', {
    p_request_id: input.requestId, p_source: input.sourceId, p_scope: input.scope,
    p_body: input.body, p_attachments: input.attachments,
    ...(input.linkNodeId ? { p_link_node: input.linkNodeId } : {}),
  });
  if (error) return { ok: false, error: friendly(error) };
  const row = (Array.isArray(data) ? data[0] : data) as { message_id: string; created: boolean; push_requested: boolean };
  if (row?.push_requested) {
    // Dispatch after responding; if it fails, the scheduled sweep retries
    // within the original 24-hour window. Repeat calls are harmless.
    after(() => triggerDispatch(row.message_id));
  }
  revalidatePath('/messages');
  return { ok: true, data: { pushed: Boolean(row?.push_requested) } };
}

async function triggerDispatch(messageId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/dispatch-push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceKey()}` },
      body: JSON.stringify({ message_id: messageId }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    console.error('push dispatch trigger failed; sweep will retry');
  }
}

export async function deleteMessage(id: string): Promise<Result> {
  const db = await userClient();
  const { data, error } = await db.rpc('admin_delete_message', { p_id: id });
  if (error) return { ok: false, error: friendly(error) };
  const paths = (data as string[] | null) ?? [];
  if (paths.length) await serviceClient().storage.from('messages').remove(paths);
  revalidatePath('/messages');
  return { ok: true };
}

// ---------------------------------------------------------------- accounts

export async function createAccount(input: { email: string; name: string; tier: 'delegate' | 'super_admin' | 'app_developer' }): Promise<Result> {
  const me = await getMe();
  if (!me?.is_top) return { ok: false, error: 'You do not have permission to do that.' };
  if (input.tier !== 'delegate' && me.tier !== 'app_developer') return { ok: false, error: 'Only the App Developer can appoint Super Admins.' };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const svc = serviceClient();
  const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: `${SITE_URL}/auth/confirm` });
  if (error || !data.user) return { ok: false, error: error?.message?.includes('already') ? 'An account with that email already exists.' : 'Could not send the invitation.' };

  const db = await userClient();
  const reg = await db.rpc('admin_register_account', { p_user_id: data.user.id, p_email: email, p_display_name: input.name.trim() || null, p_tier: input.tier });
  if (reg.error) {
    await svc.auth.admin.deleteUser(data.user.id); // roll back the invite
    return { ok: false, error: friendly(reg.error) };
  }
  revalidatePath('/accounts');
  return { ok: true };
}

export async function setAccountDisabled(userId: string, disabled: boolean): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_disabled', { p_user: userId, p_disabled: disabled });
  if (error) return { ok: false, error: friendly(error) };
  // Also block sign-in/refresh at the auth layer. The database check above
  // already denies every action immediately, even with an unexpired token.
  await serviceClient().auth.admin.updateUserById(userId, { ban_duration: disabled ? '876000h' : 'none' });
  revalidatePath('/accounts');
  return { ok: true };
}

export async function deleteAccount(userId: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_delete_account', { p_user: userId });
  if (error) return { ok: false, error: friendly(error) };
  await serviceClient().auth.admin.deleteUser(userId);
  revalidatePath('/accounts');
  return { ok: true };
}

export async function setAccountRoles(userId: string, roleIds: string[]): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_account_roles', { p_user: userId, p_roles: roleIds });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/accounts');
  return { ok: true };
}

// ---------------------------------------------------------------- roles & sources & config

export async function createRole(name: string): Promise<Result<string>> {
  const db = await userClient();
  const { data, error } = await db.rpc('admin_create_role', { p_name: name });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/roles');
  return { ok: true, data: data as string };
}

export async function renameRole(id: string, name: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_rename_role', { p_role: id, p_name: name });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/roles');
  return { ok: true };
}

export async function deleteRole(id: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_delete_role', { p_role: id });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/roles');
  redirect('/roles');
}

export async function setRoleGrants(id: string, grants: { permission_id: string; node_id?: string | null; source_id?: string | null }[]): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_role_grants', { p_role: id, p_grants: grants });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/roles/${id}`);
  return { ok: true };
}

export async function upsertSource(id: string | null, label: string, subscribable: boolean, active: boolean): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_upsert_source', { p_id: id, p_label: label, p_subscribable: subscribable, p_active: active });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/sources');
  return { ok: true };
}

/** Delete a message source. Messages already sent from it are kept (soft delete). */
export async function deleteSource(id: string): Promise<Result<{ kept: number }>> {
  if (!isUuid(id)) return { ok: false, error: 'Invalid request.' };
  const db = await userClient();
  const { data, error } = await db.rpc('admin_delete_source', { p_id: id });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/sources');
  revalidatePath('/messages');
  return { ok: true, data: { kept: Number(data ?? 0) } };
}

export async function setConfig(key: 'departmental_push_mode' | 'support_text', value: string): Promise<Result> {
  const db = await userClient();
  const { error } = await db.rpc('admin_set_config', { p_key: key, p_value: value });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath('/config');
  return { ok: true };
}
