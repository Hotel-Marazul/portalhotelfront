import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../../utils/http-error.js";
import { CLIENT_HAS_RESERVATIONS_MESSAGE, canDeleteClient, deleteClientInTransaction } from "./clients-delete.service.js";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

// Banco falso: guarda cada SQL e responde conforme o cenário, sem tocar no Postgres.
function fakeDb(options: { exists: boolean; reservations: number }) {
  const sql: string[] = [];
  const db = {
    async query(text: string) {
      sql.push(text.replace(/\s+/g, " ").trim());
      if (/FROM clients WHERE id = \$1 FOR UPDATE/.test(text)) return { rows: options.exists ? [{ id: CLIENT_ID }] : [] };
      if (/FROM reservations/.test(text)) return { rows: [{ total: options.reservations }] };
      return { rows: [], rowCount: 1 };
    }
  };
  return { db: db as never, sql };
}

test("só pode excluir hóspede sem nenhuma reserva", () => {
  assert.equal(canDeleteClient(0), true);
  assert.equal(canDeleteClient(1), false);
  assert.equal(canDeleteClient(7), false);
});

test("hóspede inexistente vira 404 sem escrever nada", async () => {
  const { db, sql } = fakeDb({ exists: false, reservations: 0 });
  await assert.rejects(deleteClientInTransaction(db, CLIENT_ID), (error: unknown) => error instanceof HttpError && error.statusCode === 404);
  assert.equal(sql.length, 1);
  assert.match(sql[0], /FOR UPDATE/);
});

test("hóspede com reserva (inclusive cancelada) vira 409 sem escrever nada", async () => {
  const { db, sql } = fakeDb({ exists: true, reservations: 1 });
  await assert.rejects(
    deleteClientInTransaction(db, CLIENT_ID),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409 && error.message === CLIENT_HAS_RESERVATIONS_MESSAGE
  );
  assert.ok(sql.every((statement) => !/^(UPDATE|DELETE)/.test(statement)));
  // A contagem não filtra status: canceladas também contam.
  assert.ok(sql.some((statement) => /FROM reservations WHERE client_id = \$1$/.test(statement)));
});

test("hóspede sem reservas: trava, desvincula contatos do WhatsApp e depois apaga", async () => {
  const { db, sql } = fakeDb({ exists: true, reservations: 0 });
  await deleteClientInTransaction(db, CLIENT_ID);
  const unlink = sql.findIndex((statement) => /^UPDATE whatsapp_contacts SET client_id = NULL/.test(statement));
  const remove = sql.findIndex((statement) => /^DELETE FROM clients/.test(statement));
  assert.match(sql[0], /FOR UPDATE/);
  assert.ok(unlink > 0);
  assert.ok(remove > unlink);
});
