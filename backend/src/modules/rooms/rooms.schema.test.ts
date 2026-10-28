import assert from "node:assert/strict";
import test from "node:test";
import { housekeepingBodySchema } from "./rooms.schema.js";

test("limpeza aceita só os três estados", () => {
  for (const status of ["limpo", "em_limpeza", "precisa_limpar"]) {
    assert.equal(housekeepingBodySchema.safeParse({ status }).success, true);
  }
  for (const status of ["sujo", "Limpo", "", undefined]) {
    assert.equal(housekeepingBodySchema.safeParse({ status }).success, false);
  }
});
