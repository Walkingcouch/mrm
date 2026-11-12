import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheName, isCacheable, looksLikePdf, toDownload, toEvict, type CacheIndex } from './pdf-cache-core.ts';

const U = (n: number) => `https://x.supabase.co/storage/v1/object/public/content/${n}/doc.pdf`;
const rec = (n: number, size: number, lastUsed: number) => ({ url: U(n), name: cacheName(U(n)), size, lastUsed });

test('cache names are stable, distinct and filesystem-safe', () => {
  assert.equal(cacheName(U(1)), cacheName(U(1)));
  assert.notEqual(cacheName(U(1)), cacheName(U(2)));
  assert.match(cacheName(U(1)), /^[0-9a-z]+\.pdf$/);
});

test('only https URLs are cacheable', () => {
  assert.ok(isCacheable(U(1)));
  assert.ok(!isCacheable('http://x/doc.pdf'));
  assert.ok(!isCacheable(null));
  assert.ok(!isCacheable('file:///a.pdf'));
});

test('downloads skip cached, failed, duplicate and non-https URLs, keeping order', () => {
  const index: CacheIndex = { [U(2)]: rec(2, 10, 0) };
  assert.deepEqual(toDownload([U(1), U(2), U(3), U(1), 'http://bad', U(4)], index, new Set([U(3)])), [U(1), U(4)]);
});

test('unreferenced copies go after 30 days; referenced ones stay', () => {
  const day = 24 * 3600 * 1000, now = 100 * day;
  const index: CacheIndex = { [U(1)]: rec(1, 10, 0), [U(2)]: rec(2, 10, 0), [U(3)]: rec(3, 10, now - day) };
  assert.deepEqual(toEvict(index, new Set([U(2)]), now), [U(1)]);
});

test('over budget: least recently used unreferenced first, then referenced', () => {
  const limits = { budgetBytes: 25, maxFileBytes: 100, keepUnreferencedMs: 1e12 };
  const index: CacheIndex = { [U(1)]: rec(1, 10, 1), [U(2)]: rec(2, 10, 5), [U(3)]: rec(3, 10, 2), [U(4)]: rec(4, 10, 9) };
  // 40 bytes, budget 25: drop unreferenced U(3) (older) then U(4).
  assert.deepEqual(toEvict(index, new Set([U(1), U(2)]), 10, limits), [U(3), U(4)]);
  // Everything referenced: oldest first.
  assert.deepEqual(toEvict(index, new Set([U(1), U(2), U(3), U(4)]), 10, limits), [U(1), U(3)]);
});

test('PDF sniffing rejects error pages', () => {
  const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  assert.ok(looksLikePdf(enc('%PDF-1.7\n')));
  assert.ok(!looksLikePdf(enc('<html>Not found</html>')));
});
