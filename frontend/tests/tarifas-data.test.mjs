import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOTEL_STAY_RULES, bookableUnitCount, categoryUnits, describeRule, formatCapacity, formatRate, formatUnitNumbers,
  moneyInput, outOfSeasonNotice, parseMoney, periodLabel, seasonName, seasonStatus, sortCategories, validityBand, validityPeriods,
} from '../src/components/categorias/tarifas-data.ts';

const room = (number, categoryId, capacity = 4, extra = {}) => ({ number, categoryId, capacity, status: 'Disponível', ...extra });

const ROOMS = [
  ...[201, 202, 203, 204, 205].map((n) => room(n, 'sl')),
  ...[103, 104, 105, 122, 123, 131, 132].map((n) => room(n, 'lx')),
  room(102, 'st', 2), ...[106, 108, 110, 111, 121, 130].map((n) => room(n, 'st')),
  room(101, 'st', 4, { status: 'Manutenção' }),
  ...[107, 109, 112, 113].map((n) => room(n, 'si')),
  room(115, 'si', 5, { connectedRoomNumber: 116, displayNumber: '115/116' }),
  ...[117, 118, 119, 120].map((n) => room(n, 'si')),
];

test('summer table: couple rates for café and half board, most expensive first', () => {
  const categories = [
    { id: 'si', name: 'Simples', price: 440, couplePrice: 440, halfBoardPrice: 550 },
    { id: 'st', name: 'Standard', price: 473, couplePrice: 473, halfBoardPrice: 583 },
    { id: 'sl', name: 'Super Luxo', price: 528, couplePrice: 528, halfBoardPrice: 638 },
    { id: 'lx', name: 'Luxo', price: 495, couplePrice: 495, halfBoardPrice: 605 },
  ];
  assert.deepEqual(
    sortCategories(categories).map((c) => `${c.name} ${formatRate(c.couplePrice)} / ${formatRate(c.halfBoardPrice)}`),
    ['Super Luxo R$ 528 / R$ 638', 'Luxo R$ 495 / R$ 605', 'Standard R$ 473 / R$ 583', 'Simples R$ 440 / R$ 550'],
  );
  assert.equal(formatRate(1250.5), 'R$ 1.250,50');
});

test('units list the numbers and capacity exceptions of each category', () => {
  assert.deepEqual(categoryUnits(ROOMS, 'sl'), { count: 5, numbers: '201 a 205', capacity: 'até 4 pessoas', maintenance: '' });
  assert.equal(categoryUnits(ROOMS, 'lx').numbers, '103–105, 122, 123, 131, 132');
  assert.deepEqual(categoryUnits(ROOMS, 'st'), {
    count: 7, numbers: '102, 106, 108, 110, 111, 121, 130', capacity: '102 até 2 · demais até 4', maintenance: '101',
  });
  assert.deepEqual(categoryUnits(ROOMS, 'si'), {
    count: 9, numbers: '107, 109, 112, 113, 115/116, 117–120', capacity: 'até 4 · 115/116 até 5', maintenance: '',
  });
  assert.equal(bookableUnitCount(ROOMS), 28);
  assert.equal(categoryUnits(ROOMS, 'none').count, 0);
  assert.equal(formatCapacity([room(1, 'x', 1)]), 'até 1 pessoa');
  assert.equal(formatUnitNumbers([room(5, 'x'), room(4, 'x')]), '4, 5');
});

test('additional guest rules read as age, billing basis and value', () => {
  assert.deepEqual(describeRule({ minAge: 3, maxAge: 5, price: 100, billingBasis: 'per_stay' }),
    { age: '3 a 5 anos', basis: 'Uma vez por hospedagem', value: 'R$ 100', free: false });
  assert.deepEqual(describeRule({ minAge: 0, maxAge: 2, price: 0, billingBasis: 'per_daily' }),
    { age: '0 a 2 anos', basis: 'Sem cobrança', value: 'grátis', free: true });
  assert.equal(describeRule({ minAge: 12, maxAge: 120, price: 200, billingBasis: 'per_daily' }).age, '12 anos ou mais');
  assert.equal(describeRule({ minAge: 6, maxAge: 11, price: 120 }).basis, 'Por diária');
});

test('before the summer: band from October to March and the out-of-season notice', () => {
  const period = { from: '2026-12-01', until: '2027-03-01' };
  assert.equal(seasonStatus(period, '2026-10-27'), 'before');
  assert.equal(seasonName(period), 'Verão 2026/27');
  assert.equal(periodLabel(period), '1 dez → 28 fev');
  assert.equal(outOfSeasonNotice(period, '2026-10-27'),
    'Até 30 nov e a partir de 1 mar as reservas usam a diária atual destas categorias.');

  const band = validityBand(period, '2026-10-27');
  assert.deepEqual(band.months.map((m) => m.label), ['out', 'nov', 'dez', 'jan', 'fev', 'mar']);
  assert.deepEqual(band.segments.map((s) => s.kind), ['past', 'gap', 'valid', 'after']);
  const valid = band.segments.find((s) => s.kind === 'valid');
  assert.ok(band.today > 0 && band.today < valid.left);
  assert.ok(Math.abs(band.segments.reduce((sum, s) => sum + s.width, 0) - 100) < 0.05);
});

test('inside the validity there is no notice; the last day of departure is exclusive', () => {
  const period = { from: '2026-12-01', until: '2027-03-01' };
  assert.equal(outOfSeasonNotice(period, '2027-01-10'), null);
  assert.equal(outOfSeasonNotice(period, '2027-02-28'), null);
  assert.equal(seasonStatus(period, '2027-03-01'), 'after');
  assert.equal(outOfSeasonNotice({ from: null, until: '2027-03-01' }, '2027-04-01'),
    'A partir de 1 mar as reservas usam a diária atual destas categorias.');
  assert.equal(seasonName({ from: '2026-05-01', until: '2026-08-01' }), null);
});

test('validity periods group categories and skip the ones without validity', () => {
  const periods = validityPeriods([
    { id: 'a', name: 'Luxo', price: 1, rateValidFrom: '2026-12-01', rateValidUntil: '2027-03-01' },
    { id: 'b', name: 'Simples', price: 1, rateValidFrom: '2026-12-01', rateValidUntil: '2027-03-01' },
    { id: 'c', name: 'Antiga', price: 1, rateValidFrom: null, rateValidUntil: null },
  ]);
  assert.deepEqual(periods, [{ from: '2026-12-01', until: '2027-03-01', categories: ['Luxo', 'Simples'] }]);
});

test('money typed in reais and the fixed stay rules', () => {
  assert.equal(parseMoney('528'), 528);
  assert.equal(parseMoney('R$ 1.250,50'), 1250.5);
  assert.equal(parseMoney('473.5'), 473.5);
  assert.equal(parseMoney('  '), null);
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.equal(moneyInput(528.5), '528,50');
  assert.equal(moneyInput(null), '');
  assert.deepEqual({ ...HOTEL_STAY_RULES }, { checkIn: '14:00', checkOut: '12:00', minimumStay: 'Nenhuma' });
});
