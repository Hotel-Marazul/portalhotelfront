import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendPrivacyNotice, availabilityRows, firstName, gapNotice, percentOf, remainingGaps } from '../src/components/whatsapp/whatsapp-view.ts';

const parts = [
  { text: 'Oi, Paty! Temos vaga. ', gap: false },
  { text: '[confirmar vaga para 2 carros]', gap: true },
  { text: ' [horário]', gap: true },
];

test('only gaps still present in the reply block sending', () => {
  assert.deepEqual(remainingGaps('Oi, Paty! Temos vaga. [confirmar vaga para 2 carros] [horário]', parts), ['[confirmar vaga para 2 carros]', ' [horário]']);
  assert.deepEqual(remainingGaps('Oi, Paty! Temos vaga para 2 carros às 14h', parts), []);
  assert.deepEqual(remainingGaps('qualquer texto', null), []);
});

test('gap notice speaks singular and plural', () => {
  assert.equal(gapNotice(0), null);
  assert.equal(gapNotice(1), 'Complete o trecho destacado antes de enviar.');
  assert.equal(gapNotice(3), 'Complete os 3 trechos destacados antes de enviar.');
});

test('privacy notice goes to the end of the reply once', () => {
  assert.equal(appendPrivacyNotice('', 'Aviso.'), 'Aviso.');
  assert.equal(appendPrivacyNotice('Olá!  ', 'Aviso.'), 'Olá!\n\nAviso.');
  assert.equal(appendPrivacyNotice('Olá!\n\nAviso.', 'Aviso.'), 'Olá!\n\nAviso.');
  assert.equal(appendPrivacyNotice('Olá!', '  '), 'Olá!');
});

test('first name keeps phone numbers whole', () => {
  assert.equal(firstName('Patrícia Gomes'), 'Patrícia');
  assert.equal(firstName('+55 47 99123-0045'), '+55 47 99123-0045');
});

test('availability and prices merge by category', () => {
  assert.deepEqual(
    availabilityRows([{ category: 'Standard', roomsFree: 2 }, { category: 'Luxo', roomsFree: 1 }], [{ category: 'Luxo', total: '900.00' }, { category: 'Suíte', total: '1500.00' }]),
    [
      { category: 'Standard', roomsFree: 2, total: null },
      { category: 'Luxo', roomsFree: 1, total: '900.00' },
      { category: 'Suíte', roomsFree: null, total: '1500.00' },
    ],
  );
});

test('percent is empty without a total', () => {
  assert.equal(percentOf(1, 0), null);
  assert.equal(percentOf(13, 32), 41);
});
