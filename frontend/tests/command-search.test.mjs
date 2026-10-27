import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRoomNumberQuery, matchRooms, newestFirst } from '../src/components/command/command-search.ts';
import { formatStayPeriod } from '../src/utils/format.ts';

const rooms = [
  { id: 'a', number: 204 }, { id: 'b', number: 20 }, { id: 'c', number: 2041 },
  { id: 'd', number: 115, displayNumber: '115/116' }, { id: 'e', number: 102 },
];

test('up to four digits is a room number; longer numbers go to CPF and phone search', () => {
  assert.equal(isRoomNumberQuery('204'), true);
  assert.equal(isRoomNumberQuery(' 7 '), true);
  assert.equal(isRoomNumberQuery('12345'), false);
  assert.equal(isRoomNumberQuery('Menezes'), false);
});
test('typing "204" finds room 204 first, then rooms that start with 204', () => {
  assert.deepEqual(matchRooms(rooms, '204').map(r => r.id), ['a', 'c']);
  assert.deepEqual(matchRooms(rooms, '20').map(r => r.id), ['b', 'a', 'c']);
});
test('connected rooms match either number', () => {
  assert.deepEqual(matchRooms(rooms, '116').map(r => r.id), ['d']);
  assert.deepEqual(matchRooms(rooms, '115').map(r => r.id), ['d']);
});
test('reservations come newest first by check-in date', () => {
  const sorted = newestFirst([{ checkInDate: '2026-01-02' }, { checkInDate: '2026-10-27' }, { checkInDate: '2025-12-30' }]);
  assert.deepEqual(sorted.map(r => r.checkInDate), ['2026-10-27', '2026-01-02', '2025-12-30']);
});
test('stay period drops the repeated month', () => {
  assert.equal(formatStayPeriod('2026-10-27', '2026-10-30'), '27 → 30 out');
  assert.equal(formatStayPeriod('2026-10-27', '2026-11-02'), '27 out → 2 nov');
});
