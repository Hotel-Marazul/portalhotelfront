import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhone, phoneFromJid, phoneVariants } from "./phone.js";

test("normaliza telefones brasileiros para E.164", () => {
  const expected = "+5548999998888";
  assert.equal(normalizePhone("(48) 99999-8888"), expected);
  assert.equal(normalizePhone("48999998888"), expected);
  assert.equal(normalizePhone("+55 48 99999-8888"), expected);
  assert.equal(normalizePhone("005548999998888"), expected);
  assert.equal(phoneFromJid("5548999998888@s.whatsapp.net"), expected);
});

test("gera variantes do nono dígito sem alterar fixos", () => {
  assert.deepEqual(phoneVariants("+5551988412207"), ["+5551988412207", "+555188412207"]);
  assert.deepEqual(phoneVariants("+555188412207"), ["+555188412207", "+5551988412207"]);
  assert.deepEqual(phoneVariants("+555133334444"), ["+555133334444"]);
  assert.deepEqual(phoneVariants("12345"), []);
});
