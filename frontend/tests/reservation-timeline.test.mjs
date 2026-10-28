import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTimelineRange, assignTimelineLanes, getTimelineOffsets, getTimelineBarPosition } from '../src/components/clientes/timeline-layout.ts';
import { categoryCapacityCaption, groupRoomsByCategory, listSearchParams, listStatusParam, DEFAULT_LIST_STATUSES } from '../src/components/agenda/agenda-data.ts';

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

// Geometria de meio-dia: a barra vai do meio do dia de entrada ao meio do dia de saída.
const W = 48;
const D = 14;
const bar = (checkIn, checkOut, periodStart = '2026-09-01') => {
  const offsets = getTimelineOffsets(checkIn, checkOut, periodStart);
  return offsets && getTimelineBarPosition(offsets.start, offsets.end, D, W);
};

test('same-day swap: departure and arrival take different halves with 2 px between them', () => {
  const costa = bar('2026-08-30', '2026-09-03');
  const freitas = bar('2026-09-03', '2026-09-07');
  assert.equal(costa.right, 2.5 * W - 1);
  assert.equal(freitas.left, 2.5 * W + 1);
  assert.equal(freitas.left - costa.right, 2);
  const lanes = assignTimelineLanes([
    { id: 'costa', ...getTimelineOffsets('2026-08-30', '2026-09-03', '2026-09-01') },
    { id: 'freitas', ...getTimelineOffsets('2026-09-03', '2026-09-07', '2026-09-01') },
  ]);
  assert.deepEqual(lanes.map(x => x.lane), [0, 0]);
});
test('same-day swap on the first visible day still shows the departure half', () => {
  const costa = bar('2026-08-28', '2026-09-01');
  const freitas = bar('2026-09-01', '2026-09-05');
  assert.deepEqual(costa, { left: 0, right: 0.5 * W - 1, flatLeft: true, flatRight: false });
  assert.equal(freitas.left - costa.right, 2);
  assert.equal(getTimelineRange('2026-08-28', '2026-09-01', '2026-09-01', D), null);
});
test('a stay longer than the period touches both edges with square corners', () => {
  assert.deepEqual(bar('2026-08-29', '2026-09-20'), { left: 0, right: D * W, flatLeft: true, flatRight: true });
});
test('a checkout right after the period ends at the edge with a square corner', () => {
  assert.deepEqual(bar('2026-09-12', '2026-09-15'), { left: 11.5 * W + 1, right: D * W, flatLeft: false, flatRight: true });
});
test('a single night spans one day width between the two middays, rounded on both sides', () => {
  const single = bar('2026-09-03', '2026-09-04');
  assert.deepEqual(single, { left: 2.5 * W + 1, right: 3.5 * W - 1, flatLeft: false, flatRight: false });
  assert.equal(single.right - single.left, W - 2);
});
test('a period that starts in the middle of a stay clips only the left side', () => {
  assert.deepEqual(bar('2026-08-29', '2026-09-03'), { left: 0, right: 2.5 * W - 1, flatLeft: true, flatRight: false });
  assert.deepEqual(bar('2026-09-01', '2026-09-03'), { left: 0.5 * W + 1, right: 2.5 * W - 1, flatLeft: false, flatRight: false });
});
test('stays outside the period and invalid stays have no bar', () => {
  assert.equal(bar('2026-08-20', '2026-08-31'), null);
  assert.equal(bar('2026-09-15', '2026-09-18'), null);
  assert.equal(bar('invalid', '2026-09-03'), null);
  assert.equal(bar('2026-09-03', '2026-09-03'), null);
});

const room = (id, number, capacity, categoryId = 'std', type = 'Standard') => ({ id, number, capacity, categoryId, type, status: 'Disponível' });

test('category caption names the exception room and the common capacity', () => {
  assert.equal(categoryCapacityCaption([room('a', 101, 4), room('b', 102, 2), room('c', 106, 4)]), '102 para 2 · demais até 4');
  assert.equal(categoryCapacityCaption([room('a', 103, 4), room('b', 104, 4)]), 'até 4 pessoas');
  assert.equal(categoryCapacityCaption([room('a', 107, 1)]), 'até 1 pessoa');
});
test('rooms are grouped by category and sorted by number', () => {
  const groups = groupRoomsByCategory([room('x', 201, 4, 'sl', 'Super Luxo'), room('b', 102, 2), room('a', 101, 4)]);
  assert.deepEqual(groups.map(g => [g.name, g.rooms.map(r => r.number)]), [['Standard', [101, 102]], ['Super Luxo', [201]]]);
});
test('list search turns a room number into roomId and keeps names as search', () => {
  const rooms = [{ id: 'r104', number: 104 }, { id: 'r201', number: 201, displayNumber: '201/202' }];
  assert.deepEqual(listSearchParams(' 104 ', rooms), { roomId: 'r104' });
  assert.deepEqual(listSearchParams('quarto 104', rooms), { roomId: 'r104' });
  assert.deepEqual(listSearchParams('201/202', rooms), { roomId: 'r201' });
  assert.deepEqual(listSearchParams('999', rooms), { search: '999' });
  assert.deepEqual(listSearchParams('Freitas', rooms), { search: 'Freitas' });
  assert.deepEqual(listSearchParams('  ', rooms), {});
});
test('status toggles go to the backend in a fixed order; none on sends nothing', () => {
  assert.equal(listStatusParam(DEFAULT_LIST_STATUSES), 'Pendente,Confirmada,EmAndamento');
  assert.equal(listStatusParam(['Cancelada', 'Pendente']), 'Pendente,Cancelada');
  assert.equal(listStatusParam([]), null);
});
