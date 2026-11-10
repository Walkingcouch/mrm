import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdSet, shouldNavigateForTap, type KV } from './seen-core.ts';

function memKV(): KV {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
}
const MID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

test('a tapped notification navigates exactly once (cold start + listener + resume)', async () => {
  const handled = new IdSet(memKV(), 'h');
  assert.equal(await shouldNavigateForTap(handled, 'n1', { message_id: MID }, true), MID);
  assert.equal(await shouldNavigateForTap(handled, 'n1', { message_id: MID }, true), null);
  assert.equal(await shouldNavigateForTap(handled, 'n1', { message_id: MID }, true), null);
});

test('non-default actions and malformed payloads never navigate', async () => {
  const handled = new IdSet(memKV(), 'h');
  assert.equal(await shouldNavigateForTap(handled, 'n2', { message_id: MID }, false), null);
  assert.equal(await shouldNavigateForTap(handled, 'n3', { message_id: 'javascript:x' }, true), null);
  assert.equal(await shouldNavigateForTap(handled, 'n4', null, true), null);
});

test('seen set persists and is bounded', async () => {
  const kv = memKV();
  const s = new IdSet(kv, 'seen');
  assert.equal(await s.add('a'), true);
  assert.equal(await s.add('a'), false);
  assert.equal(await new IdSet(kv, 'seen').has('a'), true, 'survives reload');
  for (let i = 0; i < 600; i++) await s.add(`x${i}`);
  assert.equal((await s.all()).size, 500);
});
