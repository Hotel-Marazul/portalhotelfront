import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countCategories, matchesFilter, matchesSearch, occupancyWindow, parseRoomNumber, roomToday,
  summarizeRooms, upcomingReservations, validateNewRoom, validateRoomUpdate,
} from '../src/components/quartos/rooms-data.ts';

const TODAY = '2026-10-27';
const room = (id, extra = {}) => ({ id, number: Number(id), type: 'Standard', categoryId: 'cat-1', status: 'Disponível', ...extra });
const res = (id, roomId, status, checkInDate, checkOutDate, name = id) => ({ id, roomId, status, checkInDate, checkOutDate, client: { fullName: name } });

test('a room in maintenance is maintenance even with someone arriving', () => {
  const state = roomToday(room('101', { status: 'Manutenção' }), [res('a', '101', 'Confirmada', '2026-10-27', '2026-10-30', 'Andrade')], TODAY);
  assert.equal(state.kind, 'maintenance');
  assert.equal(state.detail, 'Andrade chega hoje');
});

test('a guest in house occupies the room, even with an overdue checkout', () => {
  assert.equal(roomToday(room('103'), [res('a', '103', 'EmAndamento', '2026-10-25', '2026-10-30', 'Carvalho')], TODAY).kind, 'staying');
  const overdue = roomToday(room('103'), [res('a', '103', 'EmAndamento', '2026-10-20', '2026-10-25', 'Carvalho')], TODAY);
  assert.equal(overdue.kind, 'leaving');
  assert.equal(overdue.label, 'Saída vencida');
  assert.ok(overdue.staying);
});

test('departure and arrival on the same day show both guests', () => {
  const state = roomToday(room('104'), [
    res('a', '104', 'EmAndamento', '2026-10-24', '2026-10-27', 'Costa'),
    res('b', '104', 'Confirmada', '2026-10-27', '2026-10-31', 'Freitas'),
  ], TODAY);
  assert.equal(state.label, 'Sai hoje');
  assert.equal(state.detail, 'Costa · Freitas chega');
  assert.deepEqual([state.staying, state.arriving], [true, true]);
});

test('arrivals, late arrivals and free rooms', () => {
  assert.equal(roomToday(room('108'), [res('a', '108', 'Pendente', '2026-10-27', '2026-10-29')], TODAY).kind, 'arriving');
  assert.equal(roomToday(room('108'), [res('a', '108', 'Confirmada', '2026-10-26', '2026-10-29')], TODAY).kind, 'awaiting');
  // Reserva não iniciada que sai hoje não bloqueia mais o quarto.
  assert.equal(roomToday(room('108'), [res('a', '108', 'Confirmada', '2026-10-25', '2026-10-27')], TODAY).kind, 'free');
  // Reserva de outro quarto não conta.
  assert.equal(roomToday(room('109'), [res('a', '108', 'EmAndamento', '2026-10-25', '2026-10-29')], TODAY).kind, 'free');
});

test('timestamps are read in the hotel calendar, not UTC', () => {
  // 01:00 UTC do dia 28 ainda é 27 em São Paulo.
  assert.equal(roomToday(room('110'), [res('a', '110', 'Confirmada', '2026-10-28T01:00:00Z', '2026-10-30T15:00:00Z')], TODAY).kind, 'arriving');
});

test('summary, filters and search', () => {
  const rooms = [room('101', { status: 'Manutenção' }), room('102'), room('103', { type: 'Luxo', categoryId: 'cat-2' })];
  const states = rooms.map((r) => roomToday(r, [res('a', '103', 'EmAndamento', '2026-10-26', '2026-10-29')], TODAY));
  assert.deepEqual(summarizeRooms(states), { staying: 1, arriving: 0, free: 1, maintenance: 1 });
  assert.deepEqual(rooms.filter((r, i) => matchesFilter('livres', r, states[i])).map((r) => r.id), ['102']);
  assert.deepEqual(rooms.filter((r, i) => matchesFilter('ocupados', r, states[i])).map((r) => r.id), ['103']);
  assert.deepEqual(rooms.filter((r) => matchesFilter('manutencao', r, null)).map((r) => r.id), ['101']);
  assert.equal(matchesFilter('livres', rooms[1], null), false);
  assert.ok(matchesSearch(rooms[2], 'luxo'));
  assert.ok(matchesSearch({ ...rooms[0], displayNumber: '101/102' }, '102'));
  assert.equal(countCategories(rooms), 2);
});

test('14-day occupancy counts nights, not days', () => {
  const { days, nights, percent } = occupancyWindow([
    res('a', 'r', 'EmAndamento', '2026-10-25', '2026-10-29'),
    res('b', 'r', 'Confirmada', '2026-11-08', '2026-11-20'),
    res('c', 'r', 'Cancelada', '2026-10-29', '2026-11-02'),
  ], TODAY);
  assert.equal(days.length, 14);
  assert.equal(days[0].date, '2026-10-27');
  assert.equal(days[13].date, '2026-11-09');
  // 27 e 28 (a) + 8 e 9 nov (b).
  assert.equal(nights, 4);
  assert.equal(percent, 29);
  assert.deepEqual(days.filter((d) => d.occupied).map((d) => d.date), ['2026-10-27', '2026-10-28', '2026-11-08', '2026-11-09']);
});

test('an overdue stay still fills tonight', () => {
  const { days } = occupancyWindow([res('a', 'r', 'EmAndamento', '2026-10-20', '2026-10-25')], TODAY);
  assert.deepEqual(days.filter((d) => d.occupied).map((d) => d.date), ['2026-10-27']);
});

test('upcoming reservations are sorted by arrival and skip finished ones', () => {
  const list = upcomingReservations([
    res('late', 'r', 'Confirmada', '2026-11-05', '2026-11-07'),
    res('now', 'r', 'EmAndamento', '2026-10-25', '2026-10-29'),
    res('gone', 'r', 'Confirmada', '2026-10-24', '2026-10-27'),
    res('done', 'r', 'Concluída', '2026-10-26', '2026-10-28'),
    res('soon', 'r', 'Pendente', '2026-10-30', '2026-11-01'),
  ], TODAY);
  assert.deepEqual(list.map((r) => r.id), ['now', 'soon', 'late']);
});

test('form validation keeps the old rules and messages', () => {
  const ok = { number: 101, type: 'Standard', capacity: 2, price: 473, categoryId: 'cat-1' };
  assert.equal(validateNewRoom(ok), null);
  assert.equal(validateNewRoom({ ...ok, capacity: 0 }), 'Preencha todos os campos antes de continuar.');
  assert.equal(validateNewRoom({ ...ok, categoryId: undefined }), 'Preencha todos os campos antes de continuar.');
  assert.equal(validateRoomUpdate({ ...ok, capacity: 0 }), null);
  assert.equal(validateRoomUpdate({ ...ok, price: 0 }), 'Preencha todos os campos corretamente antes de continuar.');
  assert.equal(validateRoomUpdate({ ...ok, type: '  ' }), 'Preencha todos os campos corretamente antes de continuar.');
  assert.equal(parseRoomNumber('1a02'), 102);
  assert.equal(parseRoomNumber(''), 0);
});
