import assert from "node:assert/strict";
import test from "node:test";
import { clientBodySchema, updateClientBodySchema } from "./clients.schema.js";

const minimum = { fullName: "Maria Silva", fone: "(48) 99999-8888" };

test("cadastro inicial exige somente nome e telefone", () => {
  const client = clientBodySchema.parse(minimum);
  assert.equal(client.cpf, "");
  assert.equal(client.email, "");
  assert.equal(clientBodySchema.safeParse({ ...minimum, cpf: "", email: "" }).success, true);
});

test("dados opcionais informados continuam sendo validados", () => {
  assert.equal(clientBodySchema.safeParse({ ...minimum, cpf: "11111111111" }).success, false);
  assert.equal(clientBodySchema.safeParse({ ...minimum, cpf: "abc" }).success, false);
  assert.equal(clientBodySchema.safeParse({ ...minimum, email: "invalido" }).success, false);
  assert.equal(clientBodySchema.safeParse({ ...minimum, cpf: "111.444.777-35", email: "maria@example.test" }).success, true);
});

test("nome e telefone vazios ou ausentes não permitem cadastro", () => {
  for (const invalid of [
    { fone: minimum.fone }, { fullName: minimum.fullName },
    { ...minimum, fullName: "   " }, { ...minimum, fone: "        " },
  ]) assert.equal(clientBodySchema.safeParse(invalid).success, false);
});

test("edição permite completar cadastro ou manter CPF omitido", () => {
  const partial = updateClientBodySchema.parse(minimum);
  assert.equal(partial.cpf, undefined);
  assert.equal(partial.email, "");
  assert.equal(updateClientBodySchema.safeParse({ ...minimum, cpf: "", email: "" }).success, true);
  assert.equal(updateClientBodySchema.safeParse({ ...minimum, cpf: "11144477735", email: "maria@example.test" }).success, true);
});
