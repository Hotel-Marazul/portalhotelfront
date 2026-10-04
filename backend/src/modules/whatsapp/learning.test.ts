import assert from "node:assert/strict";
import test from "node:test";
import { canonicalConditionKey, canonicalInstructionKey, learningSteps } from "./learning.service.js";

test("condição canônica ignora a ordem das chaves e instrução ignora acentos", () => {
  assert.equal(
    canonicalConditionKey({ intent: "preco", nested: { z: true, a: 1 } }),
    canonicalConditionKey({ nested: { a: 1, z: true }, intent: "preco" })
  );
  assert.equal(canonicalInstructionKey("  Chamar   pelo HÓSPEDE  "), "chamar pelo hospede");
});

test("passos do aprendizado marcam o que já tem dados suficientes", () => {
  const steps = learningSteps({ leadsWithoutOutcome: 2, outcomes90d: 8, corrections30d: 1, editedSuggestions30d: 5 });
  assert.deepEqual(
    steps.map((step) => [step.key, step.done, step.current, step.target]),
    [
      ["outcomes_pending", false, 2, null],
      ["edited_suggestions", true, 5, 5],
      ["corrections", false, 1, 3],
      ["outcomes", true, 8, 8]
    ]
  );
  assert.equal(learningSteps({ leadsWithoutOutcome: 0, outcomes90d: 0, corrections30d: 0, editedSuggestions30d: 0 })[0]?.done, true);
});
