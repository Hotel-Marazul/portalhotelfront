import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("hóspede, quarto e categoria são desativados, nunca apagados", async () => {
  assert.ok(process.env.DB_NAME?.endsWith("_test"), "Executar somente em banco descartável terminado em _test.");
  await initializeDatabase();

  const admin = { id: randomUUID(), email: `admin-${randomUUID()}@example.test`, role: "admin" as const };
  const reception = { id: randomUUID(), email: `recepcao-${randomUUID()}@example.test`, role: "receptionist" as const };
  for (const user of [admin, reception]) {
    await pool.query("INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Fixture', $2, 'x', $3)", [user.id, user.email, user.role]);
  }

  const categoryId = randomUUID();
  const pastRoomId = randomUUID();
  const futureRoomId = randomUUID();
  const pastClientId = randomUUID();
  const futureClientId = randomUUID();
  const pastReservationId = randomUUID();
  await pool.query("INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 150)", [categoryId, `Desativação ${categoryId}`]);
  for (const [id, number] of [[pastRoomId, 9100001], [futureRoomId, 9100002]] as const) {
    await pool.query("INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)", [id, number, categoryId]);
  }
  for (const [id, cpf] of [[pastClientId, "11122233344"], [futureClientId, "55566677788"]] as const) {
    await pool.query("INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, 'Hóspede Fixture', $2, $3, '48999990000')", [id, cpf, `${id}@example.test`]);
  }
  await pool.query(
    `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
     VALUES ($1, $2, $3, '2020-01-01', '2020-01-03', 'Concluída', 200),
            ($4, $5, $6, '2040-01-01', '2040-01-03', 'Confirmada', 200)`,
    [pastReservationId, pastRoomId, pastClientId, randomUUID(), futureRoomId, futureClientId]
  );

  const server = await new Promise<Server>((resolve) => {
    const listener = createApp().listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;
  const call = async (user: typeof admin | typeof reception, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: { Authorization: `Bearer ${signAccessToken(user)}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const activeOf = async (table: string, id: string) =>
    (await pool.query<{ active: boolean; deactivated_by: string | null }>(`SELECT active, deactivated_by FROM ${table} WHERE id = $1`, [id])).rows[0];

  try {
    // Recepção não desativa nada.
    assert.equal((await call(reception, "POST", `/clients/${pastClientId}/deactivate`)).status, 403);
    assert.equal((await call(reception, "DELETE", `/client/${pastClientId}`)).status, 403);

    // Compromisso futuro trava a desativação.
    assert.equal((await call(admin, "POST", `/clients/${futureClientId}/deactivate`)).status, 409);
    assert.equal((await call(admin, "POST", `/rooms/${futureRoomId}/deactivate`)).status, 409);
    assert.equal((await call(admin, "POST", `/categories/${categoryId}/deactivate`)).status, 409, "categoria com quartos ativos");

    // Estadia antiga não trava, e a linha continua no banco.
    assert.equal((await call(admin, "POST", `/rooms/${pastRoomId}/deactivate`)).status, 200);
    assert.deepEqual(await activeOf("rooms", pastRoomId), { active: false, deactivated_by: admin.id });
    assert.equal((await call(admin, "DELETE", `/client/${pastClientId}`)).status, 204, "rota legada desativa");
    assert.equal((await activeOf("clients", pastClientId))?.active, false);

    // A reserva antiga continua resolvendo quarto e hóspede.
    const history = await call(admin, "GET", `/reservations/${pastReservationId}`);
    assert.equal(history.status, 200);
    assert.equal(history.body.room?.number ?? history.body.roomNumber, 9100001);

    // Reativar devolve o cadastro.
    assert.equal((await call(admin, "POST", `/clients/${pastClientId}/reactivate`)).status, 200);
    assert.deepEqual(await activeOf("clients", pastClientId), { active: true, deactivated_by: null });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
