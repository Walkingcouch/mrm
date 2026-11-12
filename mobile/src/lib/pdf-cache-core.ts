// Pure logic for the on-device PDF cache (no React Native imports, unit-tested).
//
// Why this is safe to cache aggressively: every upload gets a new storage path,
// so a URL's bytes never change. A replaced document is simply a new URL; the
// old copy stops being referenced and is cleaned up.

export interface CacheRecord {
  url: string;
  name: string;      // file name inside the cache folder
  size: number;      // bytes
  lastUsed: number;  // ms since epoch (download or open)
}
export type CacheIndex = Record<string, CacheRecord>; // keyed by url

export const LIMITS = {
  budgetBytes: 250 * 1024 * 1024, // whole cache
  maxFileBytes: 30 * 1024 * 1024, // larger PDFs are never stored
  keepUnreferencedMs: 30 * 24 * 3600 * 1000, // opened attachments etc. survive 30 days
};

/** Short, stable, filesystem-safe name for a URL (cyrb53 hash). */
export function cacheName(url: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i++) {
    const ch = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${n.toString(36)}.pdf`;
}

/** Only https documents are cached (callers pass PDF entries only). */
export function isCacheable(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/[^/\s]+\/\S+$/i.test(url);
}

/** Which referenced URLs still need downloading, in menu order, de-duplicated. */
export function toDownload(referenced: string[], index: CacheIndex, failed: Set<string> = new Set()): string[] {
  const seen = new Set<string>();
  return referenced.filter((u) => {
    if (seen.has(u) || index[u] || failed.has(u) || !isCacheable(u)) return false;
    seen.add(u);
    return true;
  });
}

/**
 * Which cached records to delete: unreferenced ones older than the keep window,
 * then least-recently-used first until the cache fits the budget. Referenced
 * documents are evicted last.
 */
export function toEvict(index: CacheIndex, referenced: Set<string>, now: number, limits = LIMITS): string[] {
  const out = new Set<string>();
  for (const r of Object.values(index)) {
    if (!referenced.has(r.url) && now - r.lastUsed > limits.keepUnreferencedMs) out.add(r.url);
  }
  let total = Object.values(index).filter((r) => !out.has(r.url)).reduce((s, r) => s + r.size, 0);
  if (total <= limits.budgetBytes) return [...out];
  const rest = Object.values(index).filter((r) => !out.has(r.url))
    .sort((a, b) => Number(referenced.has(a.url)) - Number(referenced.has(b.url)) || a.lastUsed - b.lastUsed);
  for (const r of rest) {
    if (total <= limits.budgetBytes) break;
    out.add(r.url);
    total -= r.size;
  }
  return [...out];
}

/** Does this byte prefix look like a PDF? (Guards against cached error pages.) */
export function looksLikePdf(head: Uint8Array): boolean {
  // "%PDF" may follow a few junk bytes in real-world files.
  const s = String.fromCharCode(...head.slice(0, 1024));
  return s.includes('%PDF');
}
