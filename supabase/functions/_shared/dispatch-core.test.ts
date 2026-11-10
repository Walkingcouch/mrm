// Run: node --test supabase/functions/_shared/dispatch-core.test.ts  (Node 22.18+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchMessage, toExpoMessage, type ClaimedRecipient, type Deps, type DeliveryResult, type ExpoMessage, type ExpoTicket } from './dispatch-core.ts';

const NOW = 1_800_000_000;
const rec = (id: string, exp = NOW + 3600): ClaimedRecipient => ({
  installation_id: id, push_token: `ExponentPushToken[${id}]`, title: 'Kitchen', body: 'Lunch at 12:30',
  expiration: exp, message_id: 'm1',
});

function fakeDeps(batches: ClaimedRecipient[][], send: (m: ExpoMessage[]) => Promise<ExpoTicket[]>) {
  const recorded: DeliveryResult[][] = [];
  const sent: ExpoMessage[][] = [];
  let finished = 0;
  const deps: Deps = {
    claimBatch: async () => batches.shift() ?? [],
    recordResults: async (_id, r) => { recorded.push(r); },
    finish: async () => { finished++; return 'done'; },
    sendToExpo: async (m) => { sent.push(m); return send(m); },
    now: () => NOW,
  };
  return { deps, recorded, sent, finished: () => finished };
}

test('payload uses source name as title, excerpt as body, id only in data, absolute expiration', () => {
  const m = toExpoMessage(rec('a'));
  assert.equal(m.title, 'Kitchen');
  assert.equal(m.body, 'Lunch at 12:30');
  assert.deepEqual(m.data, { message_id: 'm1' });
  assert.equal(m.expiration, NOW + 3600);
  assert.equal('ttl' in m, false, 'ttl would override expiration and could reset the window');
});

test('sends each claimed recipient once and records ticket results', async () => {
  const f = fakeDeps([[rec('a'), rec('b')]], async (m) => m.map((_, i) => ({ status: 'ok' as const, id: `t${i}` })));
  const s = await dispatchMessage(f.deps, 'm1');
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].length, 2);
  assert.deepEqual(f.recorded[0].map((r) => r.ok), [true, true]);
  assert.equal(s.sent, 2);
  assert.equal(f.finished(), 1);
});

test('per-ticket errors are recorded with the provider error code', async () => {
  const f = fakeDeps([[rec('a'), rec('b')]], async () => [
    { status: 'ok', id: 't0' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }]);
  await dispatchMessage(f.deps, 'm1');
  assert.deepEqual(f.recorded[0][1], { installation_id: 'b', ok: false, error_code: 'DeviceNotRegistered' });
});

test('transport failure records errors and stops (sweep retries later)', async () => {
  const f = fakeDeps([[rec('a')], [rec('b')]], async () => { throw Object.assign(new Error('x'), { name: 'ExpoHttp503' }); });
  const s = await dispatchMessage(f.deps, 'm1');
  assert.equal(f.sent.length, 1, 'does not continue claiming after an outage');
  assert.equal(f.recorded[0][0].error_code, 'ExpoHttp503');
  assert.equal(s.failed, 1);
});

test('never sends a recipient whose 24h window has closed', async () => {
  const f = fakeDeps([[rec('a', NOW - 1), rec('b')]], async (m) => m.map(() => ({ status: 'ok' as const, id: 't' })));
  await dispatchMessage(f.deps, 'm1');
  assert.deepEqual(f.sent[0].map((m) => m.to), ['ExponentPushToken[b]']);
  assert.ok(f.recorded[0].some((r) => r.installation_id === 'a' && r.error_code === 'Expired'));
});

test('nothing claimed => nothing sent, still finishes', async () => {
  const f = fakeDeps([], async () => []);
  const s = await dispatchMessage(f.deps, 'm1');
  assert.equal(f.sent.length, 0);
  assert.equal(s.status, 'done');
});
