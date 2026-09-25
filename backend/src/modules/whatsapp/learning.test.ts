import assert from "node:assert/strict";
import test from "node:test";
import { canonicalConditionKey, canonicalInstructionKey } from "./learning.service.js";

test("condição canônica ignora a ordem das chaves e instrução ignora acentos", () => {
  assert.equal(
    canonicalConditionKey({ intent: "preco", nested: { z: true, a: 1 } }),
    canonicalConditionKey({ nested: { a: 1, z: true }, intent: "preco" })
  );
  assert.equal(canonicalInstructionKey("  Chamar   pelo HÓSPEDE  "), "chamar pelo hospede");
});
