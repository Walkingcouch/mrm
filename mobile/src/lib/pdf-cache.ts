// On-device PDF cache: documents open instantly and keep working without signal.
//
// - Prefetch: after the menu loads, every PDF in it is downloaded in the
//   background, one at a time, only on Wi-Fi/Ethernet (never on mobile data).
// - Cache on view: a PDF opened on mobile data is kept for next time.
// - Freshness: storage paths change on every upload, so a cached URL never goes
//   stale. Replaced/removed documents are cleaned up (pdf-cache-core.ts).
// - Limits: 250 MB in total, 30 MB per file. Files live in the OS cache folder,
//   which the OS may clear under storage pressure; the app then re-downloads.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { cacheName, isCacheable, LIMITS, looksLikePdf, toDownload, toEvict, type CacheIndex } from './pdf-cache-core';

const INDEX_KEY = 'pdf-cache-index-v1';
const ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

let dir: Directory | null = null;
function cacheDir(): Directory {
  if (!dir) {
    dir = new Directory(Paths.cache, 'pdf-cache');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** Folder URI the iOS web view is allowed to read cached PDFs from. */
export function cacheDirUri(): string | null {
  return ENABLED ? cacheDir().uri : null;
}

let indexP: Promise<CacheIndex> | null = null;
function loadIndex(): Promise<CacheIndex> {
  if (!indexP) {
    indexP = AsyncStorage.getItem(INDEX_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as CacheIndex) : {}))
      .catch(() => ({}));
  }
  return indexP;
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveIndex(index: CacheIndex) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => {}); }, 500);
}

function fileFor(url: string): File {
  return new File(cacheDir(), cacheName(url));
}

/** The cached copy of a document, if there is a good one on this device. */
export async function getCached(url: string): Promise<File | null> {
  if (!ENABLED || !isCacheable(url)) return null;
  try {
    const index = await loadIndex();
    const rec = index[url];
    if (!rec) return null;
    const f = new File(cacheDir(), rec.name);
    if (!f.exists || f.size === 0) { delete index[url]; saveIndex(index); return null; }
    rec.lastUsed = Date.now();
    saveIndex(index);
    return f;
  } catch {
    return null;
  }
}

const active = new Map<string, Promise<boolean>>();

/** Download one document into the cache (no-op if cached or already downloading). */
function download(url: string): Promise<boolean> {
  const running = active.get(url);
  if (running) return running;
  const p = (async () => {
    const index = await loadIndex();
    if (index[url] && fileFor(url).exists) return true;
    const tmp = new File(cacheDir(), `${cacheName(url)}.part`);
    try {
      if (tmp.exists) tmp.delete();
      await File.downloadFileAsync(url, tmp, { idempotent: true }); // rejects on non-2xx
      const size = tmp.size;
      const h = tmp.open();
      let head: Uint8Array;
      try { head = h.readBytesSync(1024); } finally { h.close(); }
      if (!size || size > LIMITS.maxFileBytes || !looksLikePdf(head)) { tmp.delete(); return false; }
      const dest = fileFor(url);
      if (dest.exists) dest.delete();
      tmp.moveSync(dest);
      index[url] = { url, name: dest.name, size, lastUsed: Date.now() };
      saveIndex(index);
      return true;
    } catch {
      try { if (tmp.exists) tmp.delete(); } catch { /* ignore */ }
      return false;
    }
  })().finally(() => active.delete(url));
  active.set(url, p);
  return p;
}

/** Keep a document the user just opened, whatever the connection. */
export function cacheOnView(url: string): void {
  if (!ENABLED || !isCacheable(url)) return;
  download(url).catch(() => {});
}

async function onUnmeteredNetwork(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return !!s.isConnected && s.isInternetReachable !== false
      && (s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET);
  } catch {
    return false;
  }
}

let prefetching: Promise<void> | null = null;
const failedThisSession = new Set<string>();

/**
 * Bring the cache in line with the menu: remove what is no longer needed, then
 * (on Wi-Fi/Ethernet) download what is missing. Safe to call often.
 */
export function syncCache(referencedUrls: string[]): Promise<void> {
  if (!ENABLED) return Promise.resolve();
  if (prefetching) return prefetching;
  prefetching = (async () => {
    const index = await loadIndex();
    const referenced = new Set(referencedUrls.filter(isCacheable));

    // Forget records whose files the OS has cleared.
    for (const [u, r] of Object.entries(index)) {
      if (!new File(cacheDir(), r.name).exists) delete index[u];
    }
    const evict = (urls: string[]) => {
      for (const u of urls) {
        try { const f = new File(cacheDir(), index[u].name); if (f.exists) f.delete(); } catch { /* ignore */ }
        delete index[u];
      }
    };
    evict(toEvict(index, referenced, Date.now()));
    // Remove stray files (interrupted downloads, files not in the index).
    const known = new Set(Object.values(index).map((r) => r.name));
    for (const u of active.keys()) known.add(`${cacheName(u)}.part`);
    for (const item of cacheDir().list()) {
      if (item instanceof File && !known.has(item.name)) {
        try { item.delete(); } catch { /* ignore */ }
      }
    }
    saveIndex(index);

    for (const url of toDownload([...referenced], index, failedThisSession)) {
      if (!(await onUnmeteredNetwork())) break; // stop as soon as Wi-Fi drops
      const ok = await download(url);
      if (!ok) failedThisSession.add(url);
    }
    evict(toEvict(index, referenced, Date.now()));
    saveIndex(index);
  })().catch(() => {}).finally(() => { prefetching = null; });
  return prefetching;
}
