import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentStayLabel, guestSituation, initials, pageRangeLabel, splitStays, stayPeople, stayTotals, vehicleLabel } from '../src/components/hospedes/hospedes-data.ts';

const today = '2026-10-27';
const stay = (id, status, checkInDate, checkOutDate, totalPrice = 100, roomNumber = 101, guests = 0) => ({
  id, status, checkInDate, checkOutDate, totalPrice,
  room: { id: `r${roomNumber}`, roomNumber, status: 'Disponível', categoryName: 'Standard', categoryPrice: 100 },
  guests: Array.from({ length: guests }, (_, i) => ({ id: `${id}-g${i}`, name: 'x', age: 30, pricingRuleDescription: '', pricingRulePrice: 0 })),
});

test('the stay in progress is the current one, even with an earlier open reservation', () => {
  const { current, upcoming, history } = splitStays([
    stay('futura', 'Confirmada', '2026-11-02', '2026-11-06'),
    stay('agora', 'EmAndamento', '2026-10-25', '2026-10-30', 100, 103),
    stay('antiga', 'Concluída', '2026-01-10', '2026-01-12'),
  ], today);
  assert.equal(current.id, 'agora');
  assert.deepEqual(upcoming.map(s => s.id), ['futura']);
  assert.deepEqual(history.map(s => s.id), ['antiga']);
});

test('without a stay in progress, the next open reservation becomes current', () => {
  const { current, upcoming } = splitStays([
    stay('depois', 'Pendente', '2026-12-01', '2026-12-03'),
    stay('proxima', 'Confirmada', '2026-11-02', '2026-11-06'),
  ], today);
  assert.equal(current.id, 'proxima');
  assert.deepEqual(upcoming.map(s => s.id), ['depois']);
});

test('history keeps cancelled, done and past open reservations, newest first', () => {
  const { current, history } = splitStays([
    stay('c1', 'Concluida', '2025-03-01', '2025-03-04'),
    stay('x', 'Cancelada', '2026-11-10', '2026-11-12'),
    stay('velha', 'Confirmada', '2026-09-01', '2026-09-03'),
  ], today);
  assert.equal(current, null);
  assert.deepEqual(history.map(s => s.id), ['x', 'velha', 'c1']);
});

test('no reservations: nothing current, empty lists', () => {
  assert.deepEqual(splitStays(undefined, today), { current: null, upcoming: [], history: [] });
});

test('totals count only stays done or in progress', () => {
  const totals = stayTotals([
    stay('a', 'Concluída', '2026-01-10', '2026-01-13', 900),
    stay('b', 'EmAndamento', '2026-10-25', '2026-10-30', 1240.5),
    stay('c', 'Cancelada', '2026-02-01', '2026-02-05', 500),
    stay('d', 'Confirmada', '2026-11-02', '2026-11-06', 700),
  ]);
  assert.deepEqual(totals, { stays: 2, nights: 8, total: 2140.5 });
});

test('situation of the day for the list', () => {
  assert.deepEqual(guestSituation([stay('a', 'EmAndamento', '2026-10-25', '2026-10-30', 0, 103)], today), { tone: 'staying', label: 'No quarto 103' });
  assert.deepEqual(guestSituation([stay('a', 'Confirmada', today, '2026-10-30', 0, 102)], today), { tone: 'arriving', label: 'Chega hoje · 102' });
  assert.deepEqual(guestSituation([stay('a', 'Pendente', '2026-10-26', '2026-10-30', 0, 104)], today), { tone: 'late', label: 'Entrada pendente · 104' });
  assert.deepEqual(guestSituation([stay('a', 'Confirmada', '2026-11-02', '2026-11-06')], today), { tone: 'future', label: 'Reserva em 2 nov' });
  assert.deepEqual(guestSituation([stay('a', 'Cancelada', today, '2026-10-30')], today), { tone: 'none', label: 'Sem reserva' });
});

test('label of the current stay block', () => {
  assert.equal(currentStayLabel(stay('a', 'EmAndamento', '2026-10-25', '2026-10-30'), today), 'Hospedagem em andamento');
  assert.equal(currentStayLabel(stay('a', 'EmAndamento', '2026-10-25', today), today), 'Hospedagem · saída hoje');
  assert.equal(currentStayLabel(stay('a', 'Confirmada', today, '2026-10-30'), today), 'Chega hoje');
  assert.equal(currentStayLabel(stay('a', 'Pendente', '2026-10-25', '2026-10-30'), today), 'Entrada pendente desde 25 out');
  assert.equal(currentStayLabel(stay('a', 'Confirmada', '2026-11-02', '2026-11-06'), today), 'Próxima estadia');
});

test('small formatters', () => {
  assert.equal(initials('Mariana de Carvalho'), 'MC');
  assert.equal(initials('Paulo'), 'P');
  assert.equal(initials('  '), '?');
  assert.equal(vehicleLabel({ automovel: 'Compass', placa: 'RLK-4E21' }), 'Compass · RLK-4E21');
  assert.equal(vehicleLabel({ automovel: '', placa: '' }), '—');
  assert.equal(stayPeople(stay('a', 'Confirmada', today, '2026-10-30', 0, 101, 2)), 3);
  assert.equal(pageRangeLabel(1, 20, 1284), '1–20 de 1.284');
  assert.equal(pageRangeLabel(65, 20, 1284), '1.281–1.284 de 1.284');
  assert.equal(pageRangeLabel(1, 20, 0), '0 de 0');
});
