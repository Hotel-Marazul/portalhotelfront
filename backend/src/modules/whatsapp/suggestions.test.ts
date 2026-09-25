import assert from "node:assert/strict";
import test from "node:test";
import { SuggestionError, validateSuggestionParts } from "./suggestions.service.js";

test("valida preço e tamanho da sugestão", () => {
  const valid = validateSuggestionParts(
    [{ text: "O total fica R$ 250,00.", gap: false }],
    { prices: [{ total: "250.00" }] }
  );
  assert.equal(valid.text, "O total fica R$ 250,00.");

  assert.throws(
    () => validateSuggestionParts([{ text: "O total fica R$ 999,00.", gap: false }], { prices: [{ total: "250.00" }] }),
    (error: unknown) => error instanceof SuggestionError && error.code === "invalid_price"
  );
});

test("limita lacunas editáveis a placeholders curtos", () => {
  assert.throws(
    () => validateSuggestionParts([{ text: "[" + "x".repeat(61) + "]", gap: true }], {}),
    (error: unknown) => error instanceof SuggestionError && error.code === "invalid_parts"
  );
});
