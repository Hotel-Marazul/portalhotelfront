import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMovePayload, findGaps, gapSummary } from '../src/components/agenda/gaps.ts';

const START = '2026-11-01';
const room = (id, capacity, extra = {}) => ({ id, number: Number(id), capacity, categoryId: capacity > 2 ? 'luxo' : 'std', type: 'X', maintenance: false, ...extra });
const res = (id, roomId, checkIn, checkOut, status = 'Confirmada', guests = 1) => ({
  id, roomId, checkInDate: checkIn, checkOutDate: checkOut, status, guests: Array.from({ length: guests }, () => ({})),
});

test('a gap is 1 to 4 nights between two stays of the same room, inside the period', () => {
  const rooms = [room('102', 2)];
  const reservations = [
    res('a', '102', '2026-11-01', '2026-11-03'),
    res('b', '102', '2026-11-05', '2026-11-06'),
    res('c', '102', '2026-11-11', '2026-11-12'),
  ];
  const gaps = findGaps(rooms, reservations, START, 14, null);
  assert.deepEqual(gaps.map((g) => [g.start, g.end, g.nights]), [[2, 4, 2]]);
  assert.equal(gaps[0].before.reservation.id, 'a');
  assert.equal(gaps[0].after.reservation.id, 'b');
});

test('back-to-back stays leave no gap, and a gap past the period edge is ignored', () => {
  const rooms = [room('102', 2)];
  const reservations = [res('a', '102', '2026-11-01', '2026-11-03'), res('b', '102', '2026-11-03', '2026-11-05'), res('c', '102', '2026-11-07', '2026-11-20')];
  assert.deepEqual(findGaps(rooms, reservations, START, 14, null).map((g) => g.nights), [2]);
  assert.deepEqual(findGaps(rooms, [res('a', '102', '2026-11-10', '2026-11-12'), res('b', '102', '2026-11-16', '2026-11-18')], START, 14, null), []);
});

test('maintenance from today closes the room: no gap after it, gap before it counts', () => {
  const rooms = [room('102', 2, { maintenance: true })];
  const gaps = findGaps(rooms, [res('a', '102', '2026-11-01', '2026-11-03')], START, 14, 5);
  assert.deepEqual(gaps.map((g) => [g.start, g.end]), [[2, 5]]);
  assert.equal(gaps[0].after.kind, 'maintenance');
});

test('candidates: same dates first, or a party that fits leaving a bigger room; never guests already in or too many people', () => {
  const rooms = [room('102', 2), room('205', 4), room('103', 2)];
  const reservations = [
    res('a', '102', '2026-11-01', '2026-11-03'),
    res('b', '102', '2026-11-05', '2026-11-06'),
    res('bigger', '205', '2026-11-03', '2026-11-04', 'Confirmada', 1),
    res('same', '103', '2026-11-03', '2026-11-05', 'Pendente', 1),
    res('toomany', '205', '2026-11-04', '2026-11-05', 'Confirmada', 3),
    res('staying', '205', '2026-11-03', '2026-11-04', 'EmAndamento', 0),
    res('sameSize', '103', '2026-11-04', '2026-11-05', 'Confirmada', 0),
  ];
  const [gap] = findGaps(rooms, reservations, START, 14, null).filter((g) => g.roomId === '102');
  assert.deepEqual(gap.candidates.map((r) => r.id), ['same', 'bigger']);
  assert.equal(gapSummary([gap]), '1 · 1 encaixe');
});

const detail = {
  roomId: 'r205', clientId: 'c1', checkInDate: '2026-11-03T17:00:00.000Z', checkOutDate: '2026-11-05T15:00:00.000Z', version: 4,
  guests: [{ name: 'Ana', age: 30, pricingRuleId: null }],
  pricing: { mealPlan: 'half_board', dailyRate: 583, priceSource: 'catalog', discountAmount: 0 },
};

test('moving within the same category only changes the room and keeps meal plan, guests and version', () => {
  const body = buildMovePayload(detail, { id: 'r102', categoryId: 'std', label: '102' }, { categoryId: 'std', label: '205' });
  assert.deepEqual(body, {
    roomId: 'r102', clientId: 'c1', checkInDate: '2026-11-03', checkOutDate: '2026-11-05', version: 4, mealPlan: 'half_board',
    guests: [{ name: 'Ana', age: 30, pricingRuleId: null }],
  });
});

test('moving to another category keeps the booked daily rate with a reason; discount survives', () => {
  const body = buildMovePayload({ ...detail, pricing: { ...detail.pricing, discountAmount: 50 } }, { id: 'r102', categoryId: 'std', label: '102' }, { categoryId: 'luxo', label: '205' });
  assert.equal(body.dailyRateOverride, 583);
  assert.equal(body.discountAmount, 50);
  assert.equal(body.priceOverrideReason, 'Diária reservada mantida na troca do quarto 205 para o 102.');
});
