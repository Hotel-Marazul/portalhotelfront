import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";

// Banco vazio exclusivo: não entra na suíte que compartilha fixtures de integração.
test("inicialização e seed preservam dados operacionais sem criar exemplos comerciais", async () => {
  assert.match(env.DB_NAME, /^portal_hotel_test_no_demo_/, "Use banco descartável exclusivo deste teste.");
  try {
    await initializeDatabase();
    for (const table of ["categories", "rooms", "clients", "pricing_rules", "reservations"]) {
      const result = await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
      assert.equal(result.rows[0].total, 0, `Inicialização não deve criar exemplos em ${table}`);
    }
    const categoryId = randomUUID(), roomId = randomUUID(), clientId = randomUUID();
    const ruleId = randomUUID(), reservationId = randomUUID();
    await pool.query(`INSERT INTO categories (id,name,price,couple_price) VALUES ($1,'Categoria operacional',123,123)`, [categoryId]);
    await pool.query(`INSERT INTO rooms (id,number,type,capacity,daily_price,status,category_id)
      VALUES ($1,128,'Categoria operacional',4,123,'Disponível',$2)`, [roomId, categoryId]);
    await pool.query(`INSERT INTO clients (id,full_name,email,fone) VALUES ($1,'Hóspede operacional','','48999998888')`, [clientId]);
    await pool.query(`INSERT INTO pricing_rules (id,name,description,min_age,max_age,price,billing_basis)
      VALUES ($1,'Faixa operacional','Taxa única',3,5,100,'per_stay')`, [ruleId]);
    await pool.query(`INSERT INTO reservations (id,room_id,client_id,check_in_date,check_out_date,status,total_price)
      VALUES ($1,$2,$3,'2039-01-02T17:00:00Z','2039-01-03T15:00:00Z','Pendente',123)`, [reservationId, roomId, clientId]);
    const snapshot = async () => {
      const tables = ["categories", "rooms", "clients", "pricing_rules", "reservations", "reservation_guests", "reservation_payments", "users"];
      const rows = [];
      for (const table of tables) rows.push((await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
      return rows;
    };
    const before = await snapshot();
    await initializeDatabase();
    execFileSync(process.execPath, ["--import", "tsx", "src/db/seed.ts"], { env: process.env, timeout: 30_000, stdio: "pipe" });
    assert.deepEqual(await snapshot(), before, "Inicializar ou executar seed não pode alterar cadastros, preços, reservas ou acessos existentes.");
  } finally {
    await pool.end();
  }
});
