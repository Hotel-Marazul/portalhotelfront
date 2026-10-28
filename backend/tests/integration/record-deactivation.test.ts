import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { buildConversationFacts } from "../../src/modules/whatsapp/facts.service.js";
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
  const futureReservationId = randomUUID();
  await pool.query("INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 150)", [categoryId, `Desativação ${categoryId}`]);
  for (const [id, number] of [[pastRoomId, 9100001], [futureRoomId, 9100002]] as const) {
    await pool.query("INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)", [id, number, categoryId]);
  }
  for (const [id, cpf] of [[pastClientId, "52998224725"], [futureClientId, "11144477735"]] as const) {
    await pool.query("INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, 'Hóspede Fixture', $2, $3, '48999990000')", [id, cpf, `${id}@example.test`]);
  }
  await pool.query(
    `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
     VALUES ($1, $2, $3, '2020-01-01', '2020-01-03', 'Concluída', 200),
            ($4, $5, $6, '2040-01-01', '2040-01-03', 'Confirmada', 200)`,
    [pastReservationId, pastRoomId, pastClientId, futureReservationId, futureRoomId, futureClientId]
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

    // Desativado some das listas da recepção; o gerente vê quando pede.
    const ids = (body: { items?: Array<{ id: string }> } | Array<{ id: string }>) =>
      (Array.isArray(body) ? body : body.items ?? []).map((item) => item.id);
    assert.ok(!ids((await call(reception, "GET", "/client?pageSize=100")).body).includes(pastClientId));
    assert.ok(!ids((await call(reception, "GET", "/client?pageSize=100&includeInactive=true")).body).includes(pastClientId), "recepção não vê desativados");
    const adminClients = (await call(admin, "GET", "/client?pageSize=100&includeInactive=true")).body;
    assert.equal(adminClients.items.find((item: { id: string }) => item.id === pastClientId)?.active, false);
    assert.ok(!ids((await call(reception, "GET", "/rooms")).body).includes(pastRoomId));
    assert.ok(ids((await call(admin, "GET", "/rooms?includeInactive=true")).body).includes(pastRoomId));

    // Quarto desativado não aparece na disponibilidade nem conta no resumo.
    const available = await call(reception, "GET", "/rooms/availability?checkIn=2041-01-01&checkOut=2041-01-03&guestCount=1");
    assert.equal(available.status, 200);
    const availableIds = (Array.isArray(available.body) ? available.body : available.body.rooms ?? available.body.items).map((room: { id: string }) => room.id);
    assert.ok(availableIds.includes(futureRoomId));
    assert.ok(!availableIds.includes(pastRoomId));

    // Desativado não entra em reserva nova.
    const stay = { checkInDate: "2041-02-01", checkOutDate: "2041-02-03", guests: [] };
    assert.equal((await call(reception, "POST", "/reservations/quote", { ...stay, roomId: pastRoomId, clientId: futureClientId })).status, 400, "quarto desativado");
    const inactiveGuest = await call(reception, "POST", "/reservations/quote", { ...stay, roomId: futureRoomId, clientId: pastClientId });
    assert.equal(inactiveGuest.status, 400, "hóspede desativado");
    assert.match(inactiveGuest.body.message, /Hóspede desativado/);
    const blocked = await call(reception, "POST", "/reservations", { ...stay, roomId: pastRoomId, clientId: futureClientId, idempotencyKey: randomUUID() });
    assert.equal(blocked.status, 400, JSON.stringify(blocked.body));
    assert.match(blocked.body.message, /desativad/);

    // Reserva que já usava o hóspede continua editável sem trocá-lo.
    await pool.query("UPDATE clients SET active = FALSE WHERE id = $1", [futureClientId]);
    const kept = await call(reception, "POST", "/reservations/quote", {
      checkInDate: "2040-01-01", checkOutDate: "2040-01-03", guests: [], roomId: futureRoomId, clientId: futureClientId, reservationId: futureReservationId
    });
    assert.equal(kept.status, 200, JSON.stringify(kept.body));
    await pool.query("UPDATE clients SET active = TRUE WHERE id = $1", [futureClientId]);

    // Recadastrar o CPF ou o número de um desativado devolve o id para reativar.
    const sameCpf = await call(admin, "POST", "/client/create", { fullName: "Hóspede Repetido", cpf: "529.982.247-25", fone: "48999990000" });
    assert.equal(sameCpf.status, 409);
    assert.deepEqual(sameCpf.body.details, { code: "inactive_duplicate", id: pastClientId });
    const sameRoom = await call(admin, "POST", "/Rooms", { roomNumber: 9100001, categoryId, capacity: 2, status: "Disponível" });
    assert.equal(sameRoom.status, 409);
    assert.deepEqual(sameRoom.body.details, { code: "inactive_duplicate", id: pastRoomId });

    // A IA para de cotar uma categoria desativada.
    const aiCategoryId = randomUUID();
    const aiRoomId = randomUUID();
    const aiCategory = `IA ${aiCategoryId}`;
    await pool.query("INSERT INTO categories (id, name, price, single_price, couple_price, half_board_price) VALUES ($1, $2, 100, 100, 150, 200)", [aiCategoryId, aiCategory]);
    await pool.query("INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, 9100003, 'Teste', 2, 100, 'Disponível', $2)", [aiRoomId, aiCategoryId]);
    const reading = { checkIn: "2041-03-01", checkOut: "2041-03-03", adults: 2, childrenAges: [] };
    const before = await buildConversationFacts(randomUUID(), reading);
    assert.ok(before.prices.some((price) => price.category.startsWith(aiCategory)));
    assert.equal((await call(admin, "POST", `/rooms/${aiRoomId}/deactivate`)).status, 200);
    assert.equal((await call(admin, "POST", `/categories/${aiCategoryId}/deactivate`)).status, 200);
    const after = await buildConversationFacts(randomUUID(), reading);
    assert.ok(!after.prices.some((price) => price.category.startsWith(aiCategory)), "preço de categoria desativada");
    assert.ok(!after.availability.some((item) => item.category === aiCategory), "disponibilidade de categoria desativada");
    assert.equal((await call(admin, "POST", `/rooms/${aiRoomId}/reactivate`)).status, 409, "quarto de categoria desativada");

    // Reativar devolve o cadastro.
    assert.equal((await call(admin, "POST", `/clients/${pastClientId}/reactivate`)).status, 200);
    assert.deepEqual(await activeOf("clients", pastClientId), { active: true, deactivated_by: null });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
