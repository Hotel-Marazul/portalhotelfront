import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuests, clientPayload, excludedRoomsMessage, formatDocument, groupRooms, hasPriceAdjustment,
  parsePriceAdjustment, peopleSummary, periodError, validateClientForm, emptyClientForm,
} from '../src/components/nova-reserva/nova-reserva-data.ts';

const room = (number, capacity, categoryId = 'std', type = 'Standard', couplePrice = 473) =>
  ({ id: `r${number}`, number, displayNumber: String(number), type, capacity, categoryId, couplePrice });

test('grupo de três: o 102 sai da lista e a tela diz por quê', () => {
  const rooms = [room(106, 3), room(102, 2), room(104, 4, 'lux', 'Luxo', 495)];
  const { groups, excluded } = groupRooms(rooms, 3, { lux: 'Luxo', std: 'Standard' });
  assert.deepEqual(groups.map((g) => [g.name, g.couplePrice, g.rooms.map((r) => r.number)]), [['Luxo', 495, [104]], ['Standard', 473, [106]]]);
  assert.equal(excludedRoomsMessage(excluded), 'O 102 não aparece porque comporta só 2 pessoas.');
});

test('vários quartos de fora são agrupados pela capacidade', () => {
  const { excluded } = groupRooms([room(101, 1), room(102, 2), room(103, 2)], 3);
  assert.equal(excludedRoomsMessage(excluded), 'O 101 não aparece porque comporta só 1 pessoa. Os quartos 102 e 103 não aparecem porque comportam só 2 pessoas.');
  assert.equal(excludedRoomsMessage([]), '');
});

test('acompanhantes: adultos primeiro, nomes pendentes ficam vazios e regra vazia vira null', () => {
  const guests = buildGuests([
    { kind: 'child', name: '', age: 4, pricingRuleId: '' },
    { kind: 'adult', name: ' ', age: 0, pricingRuleId: null },
    { kind: 'adult', name: 'Marcos Lima', age: 0, pricingRuleId: 'rule' },
  ]);
  assert.deepEqual(guests, [
    { name: '', age: 18, pricingRuleId: null },
    { name: 'Marcos Lima', age: 18, pricingRuleId: 'rule' },
    { name: '', age: 4, pricingRuleId: null },
  ]);
  assert.deepEqual(buildGuests([{ kind: 'child', name: '', age: 4, pricingRuleId: null }]), buildGuests([{ kind: 'child', name: '', age: 4, pricingRuleId: null }]));
});

test('resumo de pessoas conta o cliente como adulto', () => {
  assert.equal(peopleSummary([]), '1 adulto');
  assert.equal(peopleSummary([{ kind: 'adult', name: '', age: 0, pricingRuleId: null }, { kind: 'child', name: '', age: 4, pricingRuleId: null }]), '2 adultos + criança (4)');
  assert.equal(peopleSummary([{ kind: 'child', name: '', age: 4, pricingRuleId: null }, { kind: 'child', name: '', age: 7, pricingRuleId: null }]), '1 adulto + 2 crianças (4 e 7)');
});

test('cadastro mínimo: nome e telefone; CPF e e-mail opcionais, mas válidos quando preenchidos', () => {
  assert.deepEqual(validateClientForm({ ...emptyClientForm, fullName: 'Patrícia Gomes', fone: '(41) 99620-1187' }), {});
  const errors = validateClientForm({ ...emptyClientForm, fullName: 'Pa', fone: '123', cpf: '11111111111', email: 'x@' });
  assert.deepEqual(Object.keys(errors).sort(), ['cpf', 'email', 'fone', 'fullName']);
  assert.deepEqual(validateClientForm({ ...emptyClientForm, fullName: 'Ana Souza', fone: '41999990000', cpf: '***.***.***-12' }, 'editar'), {});
});

test('payload: CPF em dígitos na criação; na edição, vazio ou mascarado não vai', () => {
  const form = { ...emptyClientForm, fullName: ' Ana Souza ', fone: '41999990000', cpf: '529.982.247-25' };
  assert.equal(clientPayload(form).cpf, '52998224725');
  assert.equal(clientPayload(form).fullName, 'Ana Souza');
  assert.equal(clientPayload({ ...form, cpf: '' }).cpf, '');
  assert.equal('cpf' in clientPayload({ ...form, cpf: '***.***.***-25' }, 'editar'), false);
  assert.equal('cpf' in clientPayload({ ...form, cpf: '' }, 'editar'), false);
  assert.equal(formatDocument('52998224725'), '529.982.247-25');
  assert.equal(formatDocument('***.***.***-25'), '***.***.***-25');
});

test('ajuste manual exige motivo quando há diária ou desconto', () => {
  const none = { dailyRateOverride: '', discountAmount: '', priceOverrideReason: '' };
  assert.equal(hasPriceAdjustment(none), false);
  assert.deepEqual(parsePriceAdjustment(none), { error: null });
  assert.deepEqual(parsePriceAdjustment({ ...none, discountAmount: '0' }), { error: null, discountAmount: 0 });
  assert.equal(parsePriceAdjustment({ ...none, dailyRateOverride: '450' }).error, 'Informe o motivo do ajuste manual de preço.');
  assert.equal(parsePriceAdjustment({ ...none, discountAmount: '50' }).error, 'Informe o motivo do ajuste manual de preço.');
  assert.equal(parsePriceAdjustment({ ...none, dailyRateOverride: '0' }).error, 'Informe uma diária válida.');
  assert.equal(parsePriceAdjustment({ ...none, discountAmount: '-1' }).error, 'Informe um desconto válido.');
  assert.deepEqual(parsePriceAdjustment({ dailyRateOverride: '450,50', discountAmount: '', priceOverrideReason: ' cliente antigo ' }),
    { error: null, dailyRateOverride: 450.5, priceOverrideReason: 'cliente antigo' });
});

test('check-out antes ou no dia do check-in é erro', () => {
  assert.equal(periodError('2026-12-20', '2026-12-20'), 'O check-out deve ser posterior ao check-in.');
  assert.equal(periodError('2026-12-20', '2026-12-19'), 'O check-out deve ser posterior ao check-in.');
  assert.equal(periodError('2026-12-20', '2026-12-25'), null);
  assert.equal(periodError(null, '2026-12-25'), null);
});
