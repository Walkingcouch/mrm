import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDarwin } from './time.ts';

test('UTC is shown in Darwin time (+09:30, no DST)', () => {
  assert.equal(formatDarwin('2026-11-10T08:37:00Z'), '10 Nov 2026, 6:07 pm');
  assert.equal(formatDarwin('2026-06-30T14:30:00Z'), '1 Jul 2026, 12:00 am');
  assert.equal(formatDarwin('2026-01-01T02:30:00Z'), '1 Jan 2026, 12:00 pm');
});

test('invalid input yields empty string', () => {
  assert.equal(formatDarwin('nope'), '');
});
