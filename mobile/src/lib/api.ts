// Read-only access to the shared backend. The app has no login: it uses the
// public (anon) key, which can only read public content and call the
// installation functions. All admin writes happen on the website.
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { sampleEntries, sampleMessage, sampleMessages, sampleSections } from './sample';

// Phone builds read these from app.config.ts (extra). The web build can't, so
// it falls back to the same public EXPO_PUBLIC_* values, inlined at build time.
const fromConfig = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const extra: Record<string, string | undefined> = {
  supabaseUrl: fromConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: fromConfig.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  pdfViewerUrl: fromConfig.pdfViewerUrl || process.env.EXPO_PUBLIC_PDF_VIEWER_URL,
};
export const SUPABASE_URL = extra.supabaseUrl ?? '';
export const PDF_VIEWER_URL = extra.pdfViewerUrl ?? '';
export const IS_CONFIGURED = Boolean(extra.supabaseUrl && extra.supabaseAnonKey);
/** Test builds with no backend show the built-in sample content (lib/sample.ts). */
export const SAMPLE_MODE = !IS_CONFIGURED;

export const supabase = createClient(SUPABASE_URL || 'https://not-configured.invalid', extra.supabaseAnonKey ?? 'x', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export type SectionType = 'home' | 'list' | 'web' | 'weather' | 'messages' | 'settings';
export type EntryKind = 'pdf' | 'url' | 'info' | 'phone' | 'map' | 'folder';

export interface Section {
  id: string; key: string; label: string; position: number;
  section_type: SectionType; sort_mode: 'manual' | 'newest_first';
  url: string | null; widget_html: string | null;
}
export interface Entry {
  id: string; parent_id: string; kind: EntryKind; label: string; position: number;
  url: string | null; body: string | null; phone: string | null;
  file_path: string | null; file_updated_at: string | null; created_at: string; is_demo: boolean;
  icon: string | null; // Material Community icon name set on the admin website (null = section icon)
}
export interface MessageRow { id: string; source_label: string; scope: string; body: string; created_at: string; link_node_id?: string | null }
export interface Attachment { id: string; message_id: string; file_path: string; file_name: string; mime_type: string; position: number }
export interface Source { id: string; label: string; subscribable: boolean; is_active: boolean; position: number }

export function publicFileUrl(bucket: 'content' | 'messages', path: string): string {
  if (/^https:\/\//i.test(path)) return path; // sample content links straight to its file
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

const CONTENT_CACHE_KEY = 'content-cache-v1';

export interface ContentSnapshot { sections: Section[]; entries: Entry[]; fetchedAt: number; fromCache: boolean }

/**
 * Load all menu sections and entries. On network failure, fall back to the
 * last successfully loaded structure so the menu keeps working (PDFs are
 * cached separately, see pdf-cache.ts).
 */
export async function loadContent(): Promise<ContentSnapshot> {
  if (SAMPLE_MODE) return { sections: sampleSections, entries: sampleEntries, fetchedAt: Date.now(), fromCache: false };
  try {
    const { data, error } = await supabase
      .from('content_nodes')
      .select('id,parent_id,key,kind,section_type,sort_mode,label,position,url,body,phone,widget_html,file_path,file_updated_at,created_at,is_demo,icon')
      .order('position');
    if (error) throw error;
    const rows = data ?? [];
    const snap = {
      sections: rows.filter((r) => r.kind === 'section') as unknown as Section[],
      entries: rows.filter((r) => r.kind !== 'section') as unknown as Entry[],
      fetchedAt: Date.now(),
    };
    AsyncStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(snap)).catch(() => {});
    return { ...snap, fromCache: false };
  } catch (e) {
    const cached = await AsyncStorage.getItem(CONTENT_CACHE_KEY).catch(() => null);
    if (cached) return { ...JSON.parse(cached), fromCache: true };
    throw e;
  }
}

/** Items directly inside a section or a folder. Folders follow their section's sort order. */
export function entriesFor(snap: ContentSnapshot, parent: { id: string; sort_mode: Section['sort_mode'] }): Entry[] {
  const list = snap.entries.filter((e) => e.parent_id === parent.id);
  return parent.sort_mode === 'newest_first'
    ? list.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    : list.sort((a, b) => a.position - b.position);
}

const MESSAGES_CACHE_KEY = 'messages-cache-v1';

/** The last list of messages seen on this device (shown instantly while the live list loads). */
export async function cachedMessages(): Promise<MessageRow[] | null> {
  if (SAMPLE_MODE) return null;
  const raw = await AsyncStorage.getItem(MESSAGES_CACHE_KEY).catch(() => null);
  try { return raw ? (JSON.parse(raw) as MessageRow[]) : null; } catch { return null; }
}

export async function loadMessages(): Promise<MessageRow[]> {
  if (SAMPLE_MODE) return sampleMessages;
  const { data, error } = await supabase
    .from('messages').select('id,source_label,scope,body,created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  AsyncStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(rows)).catch(() => {});
  return rows;
}

export async function loadMessage(id: string): Promise<{ message: MessageRow; attachments: Attachment[] } | null> {
  if (SAMPLE_MODE) return sampleMessage(id);
  const [m, a] = await Promise.all([
    supabase.from('messages').select('id,source_label,scope,body,created_at,link_node_id').eq('id', id).maybeSingle(),
    supabase.from('message_attachments').select('id,message_id,file_path,file_name,mime_type,position').eq('message_id', id).order('position'),
  ]);
  if (m.error) throw m.error;
  if (a.error) throw a.error;
  if (!m.data) return null;
  return { message: m.data as MessageRow, attachments: (a.data ?? []) as Attachment[] };
}

export async function loadSources(): Promise<Source[]> {
  if (SAMPLE_MODE) return [];
  const { data, error } = await supabase.from('message_sources')
    .select('id,label,subscribable,is_active,position').eq('is_active', true).order('position');
  if (error) throw error;
  return (data ?? []) as Source[];
}

export async function loadPublicConfig(): Promise<{ departmental_push_mode: 'subscribers' | 'everyone'; support_text: string }> {
  if (SAMPLE_MODE) return { departmental_push_mode: 'subscribers', support_text: '' };
  const { data, error } = await supabase.rpc('app_public_config');
  if (error) throw error;
  return { departmental_push_mode: data?.departmental_push_mode ?? 'subscribers', support_text: data?.support_text ?? '' };
}
