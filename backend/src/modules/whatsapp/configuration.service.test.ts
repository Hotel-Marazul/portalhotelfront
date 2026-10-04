import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsappConfiguration } from "./configuration.service.js";

test("monta configuração agregada sem aceitar campos sensíveis", () => {
  const result = buildWhatsappConfiguration({
    enabled: true,
    instance: "marazul",
    state: "open",
    stateChangedAt: "2026-09-27T12:00:00.000Z",
    apiConfigured: true,
    webhookConfigured: true,
    aiEnabled: true,
    aiAvailable: true,
    aiReason: null,
    dailyCalls: 27,
    dailyLimit: 400,
    retentionMonths: 12,
    conversations: 84,
    waiting: 3,
    inboundToday: 41,
    outboundToday: 38,
    failedToday: 1
  });

  assert.deepEqual(result, {
    connection: {
      enabled: true,
      instance: "marazul",
      state: "open",
      stateChangedAt: "2026-09-27T12:00:00.000Z",
      apiConfigured: true,
      webhookConfigured: true
    },
    agent: {
      enabled: true,
      available: true,
      reason: null,
      dailyCalls: 27,
      dailyLimit: 400,
      mode: "assistido"
    },
    data: { retentionMonths: 12 },
    metrics: {
      conversations: 84,
      waiting: 3,
      inboundToday: 41,
      outboundToday: 38,
      failedToday: 1
    }
  });
  assert.equal(/key|secret|token|url/i.test(JSON.stringify(result)), false);
});

test("normaliza contagens ausentes para zero", () => {
  const result = buildWhatsappConfiguration({
    enabled: false,
    instance: "marazul",
    state: "unknown",
    stateChangedAt: null,
    apiConfigured: false,
    webhookConfigured: false,
    aiEnabled: false,
    aiAvailable: false,
    aiReason: "disabled",
    dailyCalls: null,
    dailyLimit: 400,
    retentionMonths: 12,
    conversations: null,
    waiting: null,
    inboundToday: null,
    outboundToday: null,
    failedToday: null
  });

  assert.equal(result.agent.dailyCalls, 0);
  assert.deepEqual(result.metrics, {
    conversations: 0,
    waiting: 0,
    inboundToday: 0,
    outboundToday: 0,
    failedToday: 0
  });
});
