import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountToReceive,
  formatCompactCurrency,
  formatMonthChange,
  formatPointsChange,
  monthChange,
  monthHeading,
  occupancyBars,
} from '../src/components/gestao/gestao-data.ts';

test('revenue of R$ 96.400 against R$ 88.900 reads "R$ 96,4 mil" and "+8,4% vs mês anterior"', () => {
  assert.equal(formatCompactCurrency(96400), 'R$ 96,4 mil');
  assert.equal(formatMonthChange(monthChange(96400, 88900)), '+8,4% vs mês anterior');
});

test('a drop uses the typographic minus and no change has no sign', () => {
  assert.equal(formatMonthChange(monthChange(80000, 100000)), '−20,0% vs mês anterior');
  assert.equal(formatMonthChange(monthChange(5000, 5000)), '0,0% vs mês anterior');
});

test('without revenue in the previous month there is no comparison', () => {
  assert.equal(monthChange(1200, 0), null);
  assert.equal(formatMonthChange(monthChange(1200, 0)), null);
  assert.equal(monthChange(Number.NaN, 100), null);
});

test('compact currency for small, thousand and million values', () => {
  assert.equal(formatCompactCurrency(850), 'R$ 850');
  assert.equal(formatCompactCurrency(0), 'R$ 0');
  assert.equal(formatCompactCurrency(25000), 'R$ 25 mil');
  assert.equal(formatCompactCurrency(999_960), 'R$ 1 mi');
  assert.equal(formatCompactCurrency(1_240_000), 'R$ 1,2 mi');
  assert.equal(formatCompactCurrency(-4180), '−R$ 4,2 mil');
});

test('to receive is revenue minus received, and may be negative', () => {
  assert.equal(amountToReceive(96400, 71200), 25200);
  assert.equal(amountToReceive(1000, 1500), -500);
});

test('occupancy change in percentage points', () => {
  assert.equal(formatPointsChange(68.2, 64.4), '+4 pp vs mês anterior');
  assert.equal(formatPointsChange(50, 61), '−11 pp vs mês anterior');
});

test('month heading from the hotel civil date', () => {
  assert.deepEqual(monthHeading('2026-10-27'), { month: 'outubro', title: 'Outubro de 2026', detail: 'dia 27 de 31' });
  assert.equal(monthHeading('2026-02-03').detail, 'dia 3 de 28');
  assert.equal(monthHeading(''), null);
});

test('occupancy bars keep the months the backend sent, in order, the last one being the current month', () => {
  const bars = occupancyBars([
    { mes: 'Mai', taxa: 41.5, quartoNoites: 360 },
    { mes: 'Jun', taxa: 55, quartoNoites: 460 },
    { mes: 'Jul', taxa: 82.3, quartoNoites: 710 },
    { mes: 'Ago', taxa: 77, quartoNoites: 665 },
    { mes: 'Set', taxa: 64.4, quartoNoites: 540 },
    { mes: 'Out', taxa: 68.2, quartoNoites: 590 },
  ]);
  assert.deepEqual(bars.map(b => b.label), ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out']);
  assert.deepEqual(bars.map(b => b.current), [false, false, false, false, false, true]);
  assert.equal(bars[2].height, 82.3);
});

test('occupancy bars do not invent missing months', () => {
  assert.deepEqual(occupancyBars([{ mes: 'Out', taxa: 120, quartoNoites: 10 }]).map(b => [b.label, b.height, b.current]), [['Out', 100, true]]);
  assert.deepEqual(occupancyBars(undefined), []);
  assert.deepEqual(occupancyBars([]), []);
});
