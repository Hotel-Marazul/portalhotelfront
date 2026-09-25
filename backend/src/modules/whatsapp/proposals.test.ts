import assert from "node:assert/strict";
import test from "node:test";
import { matchesCondition } from "./proposals.job.js";

test("condição de aprendizado só casa quando todos os sinais coincidem", () => {
  assert.equal(matchesCondition({ intent: "preco", has_dates: false }, { intent: "preco", has_dates: false, is_supplier: false }), true);
  assert.equal(matchesCondition({ intent: "preco", has_dates: false }, { intent: "preco", has_dates: true }), false);
  assert.equal(matchesCondition({ unknown_contact: true }, { unknown_contact: false }), false);
});
