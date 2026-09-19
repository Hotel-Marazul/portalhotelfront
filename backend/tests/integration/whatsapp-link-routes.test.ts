import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("vínculo manual, candidatos, tipo e bloqueio do auto-link", async () => {
  await initializeDatabase();
  const contactId = randomUUID();
  const firstClientId = randomUUID();
  const secondClientId = randomUUID();
  const phone = "+5548999998888";
  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);

  await pool.query(
    `INSERT INTO clients (id, full_name, cpf, email, fone, fone_e164, automovel, placa)
     VALUES
       ($1, 'Cliente Duplicado A', '52998224725', $3, $4, $5, '', ''),
       ($2, 'Cliente Duplicado B', '24681357928', $6, $4, $5, '', '')`,
    [
      firstClientId,
      secondClientId,
      `link-a-${firstClientId}@example.com`,
      phone,
      phone,
      `link-b-${secondClientId}@example.com`
    ]
  );
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Cliente Duplicado')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );

  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const authorization = `Bearer ${signAccessToken(admin.rows[0])}`;
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers: { Authorization: authorization, "Content-Type": "application/json", ...init.headers }
    });

  try {
    const candidates = await request(`/api/whatsapp/contacts/${contactId}/link-candidates`);
    assert.equal(candidates.status, 200);
    const candidateBody = (await candidates.json()) as { candidates: Array<{ id: string; match: string }> };
    assert.deepEqual(candidateBody.candidates.map((item) => item.id).sort(), [firstClientId, secondClientId].sort());
    assert.ok(candidateBody.candidates.every((item) => item.match === "phone"));

    const link = await request(`/api/whatsapp/contacts/${contactId}/link`, {
      method: "PUT",
      body: JSON.stringify({ clientId: firstClientId })
    });
    assert.equal(link.status, 200);
    const linked = await pool.query<{ client_id: string | null; linked_by_user_id: string | null }>(
      "SELECT client_id, linked_by_user_id FROM whatsapp_contacts WHERE id = $1",
      [contactId]
    );
    assert.equal(linked.rows[0]?.client_id, firstClientId);
    assert.equal(linked.rows[0]?.linked_by_user_id, admin.rows[0].id);

    const kind = await request(`/api/whatsapp/contacts/${contactId}/kind`, {
      method: "PUT",
      body: JSON.stringify({ kind: "supplier" })
    });
    assert.equal(kind.status, 200);

    const unlink = await request(`/api/whatsapp/contacts/${contactId}/link`, { method: "DELETE" });
    assert.equal(unlink.status, 204);
    const unlinked = await pool.query<{ client_id: string | null; auto_link_blocked: boolean }>(
      "SELECT client_id, auto_link_blocked FROM whatsapp_contacts WHERE id = $1",
      [contactId]
    );
    assert.equal(unlinked.rows[0]?.client_id, null);
    assert.equal(unlinked.rows[0]?.auto_link_blocked, true);

    const update = await request(`/api/client/${firstClientId}`, {
      method: "PUT",
      body: JSON.stringify({
        fullName: "Cliente Duplicado A Atualizado",
        cpf: "52998224725",
        email: `link-a-updated-${firstClientId}@example.com`,
        fone: phone
      })
    });
    assert.equal(update.status, 200);
    const afterUpdate = await pool.query<{ client_id: string | null }>(
      "SELECT client_id FROM whatsapp_contacts WHERE id = $1",
      [contactId]
    );
    assert.equal(afterUpdate.rows[0]?.client_id, null);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    await pool.query("DELETE FROM clients WHERE id = ANY($1::uuid[])", [[firstClientId, secondClientId]]);
    await pool.end();
  }
});
