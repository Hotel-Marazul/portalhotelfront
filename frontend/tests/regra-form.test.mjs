import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_RULE_FORM, ruleFormFrom, validateRuleForm } from '../src/components/categorias/regra-form.ts';

const form = (extra = {}) => ({ name: 'Criança 6 a 11', description: '', minAge: '6', maxAge: '11', price: '120', billingBasis: 'per_daily', ...extra });

test('formulário vazio para nova regra e preenchido a partir da regra', () => {
  assert.deepEqual(ruleFormFrom(null), EMPTY_RULE_FORM);
  assert.deepEqual(
    ruleFormFrom({ id: 'r1', name: 'Bebê', minAge: 0, maxAge: 2, price: 52.5, billingBasis: 'per_stay' }),
    { name: 'Bebê', description: '', minAge: '0', maxAge: '2', price: '52,50', billingBasis: 'per_stay' },
  );
  assert.equal(ruleFormFrom({ id: 'r2', name: 'Adulto', minAge: 12, maxAge: 120, price: 100 }).billingBasis, 'per_daily');
});

test('regra válida vira o corpo da rota, com nome e descrição aparados', () => {
  const result = validateRuleForm(form({ name: '  Criança ', description: ' até 11 ', price: '1.234,50', billingBasis: 'per_stay' }));
  assert.deepEqual(result, {
    ok: true,
    body: { name: 'Criança', description: 'até 11', minAge: 6, maxAge: 11, price: 1234.5, billingBasis: 'per_stay' },
  });
});

test('valor zero é gratuidade; mesma idade nas duas pontas é aceita', () => {
  const result = validateRuleForm(form({ price: '0', minAge: '3', maxAge: '3' }));
  assert.equal(result.ok, true);
  assert.equal(result.body.price, 0);
});

test('idade máxima menor que a mínima mostra a mensagem do backend', () => {
  const result = validateRuleForm(form({ minAge: '12', maxAge: '6' }));
  assert.equal(result.ok, false);
  assert.equal(result.errors.maxAge, 'A idade máxima deve ser maior ou igual à mínima.');
});

test('campos inválidos geram um erro por campo', () => {
  const result = validateRuleForm(form({ name: ' x ', minAge: '-1', maxAge: '7,5', price: 'abc' }));
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['maxAge', 'minAge', 'name', 'price']);
  assert.equal(validateRuleForm(form({ price: '' })).errors.price, 'Informe o valor; use 0 para gratuidade.');
  assert.ok(validateRuleForm(form({ maxAge: '151' })).errors.maxAge);
  assert.ok(validateRuleForm(form({ billingBasis: 'per_person' })).errors.billingBasis);
});
