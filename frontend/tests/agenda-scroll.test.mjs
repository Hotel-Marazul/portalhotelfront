import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaFetchRange, agendaRangeCovers, wheelToDays } from '../src/components/agenda/agenda-data.ts';

test('the agenda loads 14 days around the visible period, across the year turn', () => {
  assert.deepEqual(agendaFetchRange('2026-12-22', 14), { from: '2026-12-08', to: '2027-01-18' });
});

test('moving a few days inside the loaded range does not fetch again', () => {
  const range = agendaFetchRange('2026-12-22', 14);
  assert.equal(agendaRangeCovers(range, '2026-12-22', 14), true);
  assert.equal(agendaRangeCovers(range, '2026-12-30', 14), true);
  assert.equal(agendaRangeCovers(range, '2027-01-06', 14), false);
  assert.equal(agendaRangeCovers(range, '2026-12-07', 14), false);
  assert.equal(agendaRangeCovers(null, '2026-12-22', 14), false);
});

test('wheel deltas turn into whole days and keep the remainder', () => {
  assert.deepEqual(wheelToDays(0, 100, 80), { days: 1, rest: 20 });
  assert.deepEqual(wheelToDays(20, 70, 80), { days: 1, rest: 10 });
  assert.deepEqual(wheelToDays(0, -170, 80), { days: -2, rest: -10 });
  assert.deepEqual(wheelToDays(0, 30, 80), { days: 0, rest: 30 });
});
