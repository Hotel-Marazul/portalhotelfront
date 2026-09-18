import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

// env.ts valida o ambiente ao ser importado; o teste não precisa de banco.
process.env.JWT_SECRET ??= "jwt-test-secret-0123456789";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";

const { signAccessToken, verifyAccessToken } = await import("./jwt.js");

const user = { id: "0b7c7c1e-4a51-4c1e-9d1b-6f0f2d1a9e11", email: "recepcao@example.test" };

test("aceita token da recepção", () => {
  const token = signAccessToken({ ...user, role: "receptionist" });
  assert.deepEqual(verifyAccessToken(token), { ...user, role: "receptionist" });
});

test("aceita token do gerente", () => {
  const token = signAccessToken({ ...user, role: "admin" });
  assert.equal(verifyAccessToken(token).role, "admin");
});

test("recusa token antigo com o papel manager", () => {
  const token = jwt.sign({ sub: user.id, email: user.email, role: "manager" }, process.env.JWT_SECRET!);
  assert.throws(() => verifyAccessToken(token), /Invalid token payload/);
});
