import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTodoItems, indicatorState, movementCounts, nextAction, reservationPeople } from '../src/components/today/today-data.ts';

const reservation = (status, guests = 0, id = status) => ({ id, status, guests: Array.from({ length: guests }, () => ({})) });

test('"A fazer" uses only the existing sources and keeps at most four items', () => {
  const items = buildTodoItems({ overdue: 3, urgentConversations: 2, maintenanceRooms: 1 });
  assert.deepEqual(items.map(i => i.title), [
    '2 conversas no WhatsApp para responder agora',
    '3 reservas passaram da saída sem fechar',
    '1 quarto em manutenção',
  ]);
  assert.deepEqual(items.map(i => i.href), ['/whatsapp', '/reservas?vista=lista', '/quarto']);
  assert.ok(items.length <= 4);
});

test('"A fazer" leaves out sources that are zero or did not load', () => {
  assert.deepEqual(buildTodoItems({ overdue: 0, urgentConversations: null, maintenanceRooms: 2 }).map(i => i.title), ['2 quartos em manutenção']);
  assert.deepEqual(buildTodoItems({ overdue: null, urgentConversations: null, maintenanceRooms: null }), []);
});

test('an indicator whose route failed shows the error, never zero', () => {
  assert.deepEqual(indicatorState({ loading: false, error: 'Erro 500', data: null }), { kind: 'error' });
  assert.deepEqual(indicatorState({ loading: true, error: null, data: null }), { kind: 'loading' });
  assert.deepEqual(indicatorState({ loading: false, error: null, data: { waiting: 0 } }), { kind: 'ready', data: { waiting: 0 } });
});

test('movement counts: arrivals checked in, departures done, guests staying with people', () => {
  const counts = movementCounts({
    arrivals: [reservation('Confirmada'), reservation('EmAndamento', 1, 'a2'), reservation('Concluída', 0, 'a3')],
    departures: [reservation('EmAndamento'), reservation('Concluída', 0, 'd2'), reservation('Concluida', 0, 'd3')],
    staying: [reservation('EmAndamento', 1), reservation('EmAndamento', 3, 's2')],
  });
  assert.deepEqual(counts, { arrivals: 3, arrived: 2, departures: 3, departed: 2, staying: 2, people: 6 });
});

test('the first guest is the client, so people = 1 + extra guests', () => {
  assert.equal(reservationPeople(reservation('Confirmada')), 1);
  assert.equal(reservationPeople(reservation('Confirmada', 2)), 3);
});

test('each row offers the next step of the lifecycle', () => {
  assert.equal(nextAction('arrivals', 'Confirmada'), 'checkin');
  assert.equal(nextAction('arrivals', 'Pendente'), 'open');
  assert.equal(nextAction('departures', 'EmAndamento'), 'checkout');
  assert.equal(nextAction('departures', 'Concluída'), 'open');
  assert.equal(nextAction('staying', 'EmAndamento'), 'open');
});
