import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";

function numericIdentifier(length: number) {
  const value = BigInt(`0x${randomUUID().replaceAll("-", "")}`);
  return (value % (10n ** BigInt(length))).toString().padStart(length, "0");
}

test("o banco rejeita uma reserva que sobrepoe uma estadia concluida", async () => {
  const databaseClient = await pool.connect();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const hotelClientId = randomUUID();

  try {
    await databaseClient.query("BEGIN");

    await databaseClient.query(
      `INSERT INTO categories (id, name, price, single_price, couple_price)
       VALUES ($1, $2, 100, 100, 100)`,
      [categoryId, `Teste de sobreposicao ${categoryId}`]
    );
    await databaseClient.query(
      `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
       VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`,
      [roomId, Number(numericIdentifier(8)), categoryId]
    );
    await databaseClient.query(
      `INSERT INTO clients (id, full_name, cpf, email, fone)
       VALUES ($1, 'Cliente de teste', $2, $3, '00000000000')`,
      [hotelClientId, numericIdentifier(11), `overlap-${hotelClientId}@example.test`]
    );

    await databaseClient.query(
      `INSERT INTO reservations
         (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
       VALUES ($1, $2, $3, '2035-01-01T12:00:00Z', '2035-01-03T12:00:00Z', 'Concluída', 200)`,
      [randomUUID(), roomId, hotelClientId]
    );

    // O checkout e o check-in podem encostar: o intervalo e [entrada, saida).
    await databaseClient.query(
      `INSERT INTO reservations
         (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
       VALUES ($1, $2, $3, '2034-12-31T12:00:00Z', '2035-01-01T12:00:00Z', 'Pendente', 100)`,
      [randomUUID(), roomId, hotelClientId]
    );

    // Cancelamento nao bloqueia o quarto.
    await databaseClient.query(
      `INSERT INTO reservations
         (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
       VALUES ($1, $2, $3, '2035-01-02T12:00:00Z', '2035-01-04T12:00:00Z', 'Cancelada', 200)`,
      [randomUUID(), roomId, hotelClientId]
    );

    await assert.rejects(
      databaseClient.query(
        `INSERT INTO reservations
           (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
         VALUES ($1, $2, $3, '2035-01-02T00:00:00Z', '2035-01-03T00:00:00Z', 'Pendente', 100)`,
        [randomUUID(), roomId, hotelClientId]
      ),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23P01"
    );
  } finally {
    await databaseClient.query("ROLLBACK");
    databaseClient.release();
    await pool.end();
  }
});
