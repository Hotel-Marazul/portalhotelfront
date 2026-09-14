import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTimelineRange, assignTimelineLanes } from '../src/components/clientes/timeline-layout.ts';

test('checkout is exclusive: consecutive stays do not overlap', () => {
  assert.deepEqual(getTimelineRange('2026-09-01', '2026-09-03', '2026-09-01', 14), { start: 0, end: 2 });
  assert.deepEqual(getTimelineRange('2026-09-03', '2026-09-04', '2026-09-01', 14), { start: 2, end: 3 });
});
test('clips both edges and omits stays outside the window', () => {
  assert.deepEqual(getTimelineRange('2026-08-29', '2026-09-20', '2026-09-01', 14), { start: 0, end: 14 });
  assert.equal(getTimelineRange('2026-08-29', '2026-09-01', '2026-09-01', 14), null);
  assert.equal(getTimelineRange('2026-09-15', '2026-09-16', '2026-09-01', 14), null);
});
test('invalid dates and zero-night stays do not render', () => {
  assert.equal(getTimelineRange('invalid', '2026-09-02', '2026-09-01', 14), null);
  assert.equal(getTimelineRange('2026-09-02', '2026-09-02', '2026-09-01', 14), null);
});
test('overlapping historical records use separate lanes; consecutive stays share a lane', () => {
  const items = [ { id: 'a', start: 0, end: 3 }, { id: 'b', start: 1, end: 2 }, { id: 'c', start: 3, end: 4 } ];
  assert.deepEqual(assignTimelineLanes(items).map(x => [x.id, x.lane]), [['a', 0], ['b', 1], ['c', 0]]);
  assert.equal(items[0].lane, undefined);
});
