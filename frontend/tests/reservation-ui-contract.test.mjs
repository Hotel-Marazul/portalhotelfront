import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, classifyApiError } from "../src/utils/api-error.ts";
import { getIdempotencyAttempt, requestFingerprint } from "../src/utils/idempotency.ts";

const axiosError = (status, message = "erro") => ({
  isAxiosError: true,
  response: { status, data: { message } },
  message,
});

test("classifica falhas de rede, autenticação, permissão e conflito", () => {
  assert.equal(classifyApiError(axiosError(400)), "validation");
  assert.equal(classifyApiError(axiosError(401)), "authentication");
  assert.equal(classifyApiError(axiosError(403)), "permission");
  assert.equal(classifyApiError(axiosError(409)), "conflict");
  assert.equal(classifyApiError({ isAxiosError: true, request: {} }), "network");
  assert.equal(apiErrorMessage(axiosError(401, "Token não informado."), "fallback"), "Sua sessão expirou. Faça login novamente.");
  assert.equal(apiErrorMessage(axiosError(403), "fallback"), "Você não tem permissão para esta operação.");
  assert.equal(apiErrorMessage(axiosError(409, "Quarto tomado"), "fallback"), "Quarto tomado");
});

test("a mesma intenção reutiliza a chave e uma alteração gera outra", () => {
  const payload = { roomId: "room-1", amount: 25 };
  const first = getIdempotencyAttempt(null, payload);
  const retry = getIdempotencyAttempt(first, { roomId: "room-1", amount: 25 });
  const changed = getIdempotencyAttempt(retry, { roomId: "room-1", amount: 30 });
  assert.equal(retry.key, first.key);
  assert.equal(retry.fingerprint, requestFingerprint(payload));
  assert.notEqual(changed.key, first.key);
  assert.notEqual(changed.fingerprint, first.fingerprint);
});

test("fontes da UI preservam fail-closed, estados e chaves de retentativa", async () => {
  const fs = await import("node:fs/promises");
  const modal = await fs.readFile(new URL("../src/components/clientes/ModalNovaReserva.tsx", import.meta.url), "utf8");
  const drawer = await fs.readFile(new URL("../src/components/reservations/ReservationDrawer.tsx", import.meta.url), "utf8");
  const clients = await fs.readFile(new URL("../src/components/clientes/createUserTable.tsx", import.meta.url), "utf8");
  assert.match(modal, /guestCount: String\(totalGuestCount\)/);
  assert.match(modal, /revalidateAvailability/);
  assert.match(modal, /Escolha outro quarto/);
  assert.match(modal, /createIdempotencyKey/);
  assert.match(drawer, /paymentsLoading/);
  assert.match(drawer, /paymentError/);
  assert.match(drawer, /paymentSubmittingRef/);
  assert.match(drawer, /totalPaid/);
  assert.match(drawer, /balanceDue/);
  assert.match(clients, /apiErrorMessage\(error, "Não foi possível carregar hóspedes\."\)/);
  assert.match(clients, /setHospedes\(\[\]\)/);
});
