import assert from "node:assert/strict";
import test from "node:test";
import { calculateNights, formatCurrency } from "../src/utils/format.ts";
import { formatCPF, maskCPF, validateCPF } from "../src/utils/cpf.ts";

test("formata moeda e calcula noites por data civil", () => {
  assert.equal(formatCurrency(1234.5).replace(/\u00a0/g, " "), "R$ 1.234,50");
  assert.equal(formatCurrency(null), "R$ 0,00");
  assert.equal(calculateNights("2039-01-31", "2039-02-01"), 1);
  assert.equal(calculateNights("2039-02-01", "2039-02-07"), 6);
});

test("valida e formata CPF, preservando máscara redigida", () => {
  assert.equal(validateCPF("529.982.247-25"), true);
  assert.equal(validateCPF("529.982.247-24"), false);
  assert.equal(maskCPF("52998224725"), "529.982.247-25");
  assert.equal(formatCPF("52998224725"), "529.982.247-25");
  assert.equal(formatCPF("***.***.***-25"), "***.***.***-25");
});
