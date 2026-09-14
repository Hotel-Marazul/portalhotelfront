import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { formatHotelDate, hotelCivilDateToUtc } from "../../src/utils/reservation.js";

const MONTH_LABELS: Record<number, string> = {
  1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
};

function civilDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function moneyDelta(after: number, before: number, expected: number) {
  assert.ok(Math.abs(after - before - expected) < 0.001, `delta=${after - before}, esperado=${expected}`);
}

test("relatórios usam noites civis e separam receita reservada de recebimentos", async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomIds = [randomUUID(), randomUUID(), randomUUID()];
  const clientId = randomUUID();
  const reservationIds = [randomUUID(), randomUUID(), randomUUID()];
  const paymentId = randomUUID();
  const suffix = randomUUID();
  const user = await pool.query<{ id: string; email: string; role: "admin" | "manager" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(user.rows[0]);

  const currentCivil = formatHotelDate(new Date());
  const [year, month, day] = currentCivil.split("-").map(Number);
  const currentMonthStart = civilDate(year, month, 1);
  const nextMonthStart = civilDate(year, month + 1, 1);
  const previousMonthStart = civilDate(year, month - 1, 1);
  const sixNightStart = civilDate(year, month, -2);
  const sixNightEnd = civilDate(year, month, 4);
  const oldCheckIn = civilDate(year, month - 1, 5);
  const oldCheckOut = civilDate(year, month - 1, 6);
  const currentCheckOut = civilDate(year, month, day + 1);
  const sixNightCheckInUtc = hotelCivilDateToUtc(sixNightStart, 14);
  const sixNightCheckOutUtc = hotelCivilDateToUtc(sixNightEnd, 12);
  const oldCheckInUtc = hotelCivilDateToUtc(oldCheckIn, 14);
  const oldCheckOutUtc = hotelCivilDateToUtc(oldCheckOut, 12);
  const currentCheckInUtc = hotelCivilDateToUtc(currentCivil, 14);
  const currentCheckOutUtc = hotelCivilDateToUtc(currentCheckOut, 12);
  const paymentCreatedAt = hotelCivilDateToUtc(currentCivil, 10);
  assert.ok(sixNightCheckInUtc && sixNightCheckOutUtc && oldCheckInUtc && oldCheckOutUtc && currentCheckInUtc && currentCheckOutUtc && paymentCreatedAt);
  assert.ok(sixNightEnd > sixNightStart);

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${signAccessToken(user.rows[0])}`
  };

  const readRevenue = async () => {
    const response = await fetch(`${endpoint}/api/reservations/revenue-summary`, { headers });
    assert.equal(response.status, 200);
    return await response.json() as {
      receitaHoje: number;
      receitaMesAtual: number;
      receitaMesAnterior: number;
      recebidaHoje: number;
      recebidaMesAtual: number;
      recebidaMesAnterior: number;
      metadata: {
        timezone: string;
        indicators: Record<string, { value: number; period: { civilFrom: string; civilToExclusive: string; from: string; to: string; interval: string }; criterion: string }>;
      };
    };
  };
  const readCounter = async () => {
    const response = await fetch(`${endpoint}/api/reservations/counter-summary`, { headers });
    assert.equal(response.status, 200);
    return await response.json() as { taxaOcupacaoMes: Array<{ mes: string; taxa: number; quartoNoites: number }> };
  };

  try {
    const beforeRevenue = await readRevenue();
    const beforeCounter = await readCounter();
    await pool.query(
      `INSERT INTO categories (id, name, price, single_price, couple_price)
       VALUES ($1, $2, 100, 100, 100)`,
      [categoryId, `Relatórios ${suffix}`]
    );
    await pool.query(
      `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
       VALUES ($1, 7101, 'Relatório', 2, 100, 'Disponível', $4),
              ($2, 7102, 'Relatório', 2, 100, 'Disponível', $4),
              ($3, 7103, 'Relatório', 2, 100, 'Disponível', $4)`,
      [...roomIds, categoryId]
    );
    await pool.query(
      `INSERT INTO clients (id, full_name, cpf, email, fone)
       VALUES ($1, $2, '12345678901', $3, '00000000000')`,
      [clientId, `Cliente relatório ${suffix}`, `relatorio-${suffix}@example.test`]
    );
    await pool.query(
      `INSERT INTO reservations
         (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
       VALUES
         ($1, $2, $5, $6, $7, 'Confirmada', 600),
         ($3, $4, $5, $8, $9, 'Confirmada', 321),
         ($10, $11, $5, $12, $13, 'Cancelada', 999)`,
      [
        reservationIds[0], roomIds[0], reservationIds[1], roomIds[1], clientId,
        sixNightCheckInUtc.toISOString(), sixNightCheckOutUtc.toISOString(),
        oldCheckInUtc.toISOString(), oldCheckOutUtc.toISOString(),
        reservationIds[2], roomIds[2], currentCheckInUtc.toISOString(), currentCheckOutUtc.toISOString()
      ]
    );
    await pool.query(
      `INSERT INTO reservation_payments
         (id, reservation_id, stage, method, amount, note, idempotency_key, entry_type, created_at)
       VALUES ($1, $2, 'Confirmacao', 'Pix', 20, '', $3, 'payment', $4)`,
      [paymentId, reservationIds[1], randomUUID(), paymentCreatedAt.toISOString()]
    );

    const afterRevenue = await readRevenue();
    assert.equal(afterRevenue.metadata.timezone, "America/Sao_Paulo");
    for (const indicator of Object.values(afterRevenue.metadata.indicators)) {
      assert.ok(indicator.criterion.length > 20);
      assert.equal(indicator.period.interval, "[from,to)");
      assert.ok(indicator.period.from < indicator.period.to);
    }
    assert.equal(afterRevenue.metadata.indicators.receitaHoje.period.civilFrom, currentCivil);
    assert.equal(afterRevenue.metadata.indicators.receitaMesAtual.period.civilFrom, currentMonthStart);
    assert.equal(afterRevenue.metadata.indicators.receitaMesAtual.period.civilToExclusive, nextMonthStart);
    assert.equal(afterRevenue.metadata.indicators.receitaMesAnterior.period.civilFrom, previousMonthStart);

    // The second read must be identical; no current timestamp or result ordering leaks into values.
    assert.deepEqual(afterRevenue, await readRevenue());
    moneyDelta(afterRevenue.receitaMesAtual, beforeRevenue.receitaMesAtual, 0);
    moneyDelta(afterRevenue.receitaMesAnterior, beforeRevenue.receitaMesAnterior, 921);
    moneyDelta(afterRevenue.recebidaHoje, beforeRevenue.recebidaHoje, 20);
    moneyDelta(afterRevenue.recebidaMesAtual, beforeRevenue.recebidaMesAtual, 20);
    assert.equal(afterRevenue.receitaHoje, beforeRevenue.receitaHoje);

    const counter = await readCounter();
    const currentMonth = counter.taxaOcupacaoMes.find((row) => row.mes === MONTH_LABELS[month]);
    const previousMonth = counter.taxaOcupacaoMes.find((row) => row.mes === MONTH_LABELS[month === 1 ? 12 : month - 1]);
    const beforeCurrentMonth = beforeCounter.taxaOcupacaoMes.find((row) => row.mes === MONTH_LABELS[month]);
    const beforePreviousMonth = beforeCounter.taxaOcupacaoMes.find((row) => row.mes === MONTH_LABELS[month === 1 ? 12 : month - 1]);
    assert.ok(currentMonth && previousMonth && beforeCurrentMonth && beforePreviousMonth);
    assert.equal(currentMonth.quartoNoites - beforeCurrentMonth.quartoNoites, 3);
    // Three nights come from the cross-month stay and one from the separate old stay.
    assert.equal(previousMonth.quartoNoites - beforePreviousMonth.quartoNoites, 4);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`DELETE FROM reservation_payments WHERE id = $1`, [paymentId]);
    await pool.query(`DELETE FROM reservation_events WHERE reservation_id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`DELETE FROM reservations WHERE id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`DELETE FROM rooms WHERE id = ANY($1::uuid[])`, [roomIds]);
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await pool.end();
  }
});
