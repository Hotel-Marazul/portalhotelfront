import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditEntry, canCancel, canEdit, defaultPaymentStage, financialSummary, needsBalanceWarning, nextStep,
  parseMoneyInput, priceLines, progressSteps, reversibleAmount, validatePaymentAmount, validateReservationEdit, validateReversal,
} from '../src/components/reserva/reserva-data.ts';

test('a faixa de andamento marca os passos feitos, o atual e os que faltam', () => {
  assert.deepEqual(progressSteps('EmAndamento').map(s => s.state), ['done', 'done', 'current', 'todo']);
  assert.deepEqual(progressSteps('Pendente').map(s => s.state), ['current', 'todo', 'todo', 'todo']);
  assert.deepEqual(progressSteps('Concluida').map(s => s.state), ['done', 'done', 'done', 'current']);
  assert.deepEqual(progressSteps('Cancelada').map(s => s.state), ['todo', 'todo', 'todo', 'todo']);
  assert.deepEqual(progressSteps('Pendente').map(s => s.label), ['Pendente', 'Confirmada', 'Hospedada', 'Concluída']);
});

test('o próximo passo segue a máquina de estados; cancelar e editar só onde o backend aceita', () => {
  assert.equal(nextStep('Pendente').target, 'Confirmada');
  assert.equal(nextStep('Confirmada').label, 'Iniciar hospedagem');
  assert.equal(nextStep('EmAndamento').target, 'Concluída');
  assert.equal(nextStep('Concluída'), null);
  assert.equal(nextStep('Cancelada'), null);
  assert.ok(canCancel('Pendente') && canCancel('Confirmada'));
  assert.ok(!canCancel('EmAndamento') && !canCancel('Concluída'));
  assert.ok(canEdit('EmAndamento') && !canEdit('Cancelada') && !canEdit('Concluida'));
});

test('o saldo vem do backend; sem os agregados, nada de zero', () => {
  assert.deepEqual(financialSummary({ totalPrice: 2240, totalPaid: 1000, balanceDue: 1240 }), { total: 2240, paid: 1000, balance: 1240 });
  assert.equal(financialSummary({ totalPrice: 2240 }), null);
  assert.equal(financialSummary(null), null);
});

test('concluir com saldo pede aviso só quando o saldo é conhecido e positivo', () => {
  assert.equal(needsBalanceWarning('EmAndamento', 1240), true);
  assert.equal(needsBalanceWarning('EmAndamento', 0), false);
  assert.equal(needsBalanceWarning('EmAndamento', null), false);
  assert.equal(needsBalanceWarning('Confirmada', 1240), false);
});

test('etapa sugerida acompanha o andamento', () => {
  assert.equal(defaultPaymentStage('Pendente'), 'Confirmacao');
  assert.equal(defaultPaymentStage('Confirmada'), 'CheckIn');
  assert.equal(defaultPaymentStage('EmAndamento'), 'CheckOut');
});

test('estorno desconta os estornos anteriores do mesmo pagamento', () => {
  const payments = [
    { id: 'p1', amount: 1000, entryType: 'payment' },
    { id: 'r1', amount: -300.1, entryType: 'reversal', reversedPaymentId: 'p1' },
    { id: 'r2', amount: -50, entryType: 'reversal', reversedPaymentId: 'outro' },
  ];
  assert.equal(reversibleAmount(payments[0], payments), 699.9);
  assert.equal(reversibleAmount(payments[1], payments), 0);
  assert.equal(validateReversal('700', 'erro de digitação', 699.9), 'O estorno não pode passar do valor ainda estornável do pagamento.');
  assert.equal(validateReversal('100', 'ok', 699.9), 'Informe o motivo do estorno.');
  assert.equal(validateReversal('0', 'motivo', 699.9), 'Informe um valor válido para o estorno.');
  assert.equal(validateReversal('699,90', 'lançado em dobro', 699.9), null);
});

test('valor em reais aceita vírgula e ponto de milhar', () => {
  assert.equal(parseMoneyInput('1.240,50'), 1240.5);
  assert.equal(parseMoneyInput('1240.5'), 1240.5);
  assert.equal(parseMoneyInput('R$ 80'), 80);
  assert.ok(Number.isNaN(parseMoneyInput('abc')));
  assert.ok(Number.isNaN(parseMoneyInput('10,123')));
  assert.equal(validatePaymentAmount(''), 'Informe um valor válido para o pagamento');
  assert.equal(validatePaymentAmount('-5'), 'Informe um valor válido para o pagamento');
  assert.equal(validatePaymentAmount('1.240,00'), null);
});

test('edição mantém as mensagens de antes, na mesma ordem', () => {
  const base = {
    checkIn: new Date(2026, 9, 25), checkOut: new Date(2026, 9, 30), guests: [{ name: 'Pedro', age: 38 }],
    dailyRateOverride: '', discountAmount: '', priceOverrideReason: '', hadPricing: true,
  };
  assert.equal(validateReservationEdit({ ...base, checkIn: null }).error, 'Preencha as datas de check-in e check-out');
  assert.equal(validateReservationEdit({ ...base, checkOut: base.checkIn }).error, 'A data de check-out deve ser posterior à data de check-in');
  assert.equal(validateReservationEdit({ ...base, guests: [{ name: '', age: 3 }] }).error, 'Preencha todos os dados dos hóspedes');
  assert.equal(validateReservationEdit({ ...base, dailyRateOverride: '0' }).error, 'Informe uma diária válida.');
  assert.equal(validateReservationEdit({ ...base, discountAmount: '-1' }).error, 'Informe um desconto válido.');
  assert.equal(validateReservationEdit({ ...base, dailyRateOverride: '448' }).error, 'Informe o motivo do ajuste manual de preço.');
  assert.deepEqual(validateReservationEdit({ ...base, dailyRateOverride: '448', priceOverrideReason: 'baixa temporada' }), { dailyRate: 448, discount: 0 });
  assert.deepEqual(validateReservationEdit({ ...base, hadPricing: false }), { dailyRate: undefined, discount: undefined });
});

test('preço detalhado marca a diária ajustada e mostra traço no que é zero', () => {
  const lines = priceLines({ rateType: 'couple', dailyRate: 448, priceSource: 'manual', nights: 5, additionalDailyTotal: 0, additionalStayTotal: 0, discountAmount: 0 });
  assert.deepEqual(lines[0], { label: '5 diárias · casal', value: 2240, adjusted: true });
  assert.deepEqual(lines.slice(1).map(l => l.value), [null, null, null]);
  assert.equal(priceLines({ rateType: 'single', dailyRate: 300, priceSource: 'catalog', nights: 1, additionalDailyTotal: 40, discountAmount: 20 })[3].value, -20);
});

test('a última alteração vira texto em português, sem inventar quem fez', () => {
  assert.deepEqual(auditEntry({ action: 'payment_reversed', actorType: 'user', occurredAt: '2026-10-27 09:02' }),
    { text: 'Pagamento estornado', actor: 'Equipe, pelo portal', occurredAt: '2026-10-27 09:02' });
  assert.equal(auditEntry({ action: 'created', actorType: null, occurredAt: null }).actor, null);
  assert.equal(auditEntry(undefined), null);
});
