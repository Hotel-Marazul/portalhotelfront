import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool, query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { phoneVariants } from "./phone.js";
import {
  getConversationDetail,
  getConversationMessages,
  getQueue,
  getQueueCount,
  searchConversations
} from "./queue.service.js";
import { OutboundError, retryMessage, sendMessage } from "./outbound.service.js";
import { dismissSuggestion, getOrCreateSuggestion, SuggestionError } from "./suggestions.service.js";
import {
  addPriorityFeedback,
  decideRule,
  learningSummary,
  listCorrections,
  listRules,
  recomputeQueueScores,
  removePriorityFeedback,
  setConversationOutcome
} from "./learning.service.js";
import { runLearningProposals } from "./proposals.job.js";
import {
  whatsappContactIdSchema,
  whatsappContactKindBodySchema,
  whatsappLinkBodySchema,
  whatsappMessagesQuerySchema,
  whatsappOutcomeSchema,
  whatsappPriorityFeedbackSchema,
  whatsappQueueQuerySchema,
  whatsappLearningPageSchema,
  whatsappLearningPeriodSchema,
  whatsappSendMessageSchema,
  whatsappSearchQuerySchema
} from "./whatsapp.schema.js";

export const whatsappRouter = Router();

whatsappRouter.use(requireRole("admin", "receptionist"));

whatsappRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    if (!env.WHATSAPP_ENABLED) {
      res.json({ enabled: false });
      return;
    }

    const instances = await query<{ connection_state: string; state_changed_at: string | null }>(
      `SELECT connection_state, state_changed_at::text
       FROM whatsapp_instances
       WHERE name = $1
       LIMIT 1`,
      [env.EVOLUTION_INSTANCE]
    );
    let ai: { available: boolean; reason: string | null };
    if (!env.WHATSAPP_AI_ENABLED) {
      ai = { available: false, reason: "disabled" };
    } else if (!env.AGENTS_API_URL || !env.AGENTS_API_KEY) {
      ai = { available: false, reason: "not_configured" };
    } else {
      const usage = await query<{ calls: number }>(
        `SELECT calls
         FROM whatsapp_ai_daily_usage
         WHERE usage_date = (NOW() AT TIME ZONE $1)::date
         LIMIT 1`,
        [env.HOTEL_TIMEZONE]
      );
      ai = (usage[0]?.calls ?? 0) >= env.WHATSAPP_AI_DAILY_LIMIT
        ? { available: false, reason: "daily_limit" }
        : { available: true, reason: null };
    }

    res.json({
      enabled: true,
      connectionState: instances[0]?.connection_state ?? "unknown",
      stateChangedAt: instances[0]?.state_changed_at ?? null,
      ai
    });
  })
);

whatsappRouter.use((req, res, next) => {
  if (env.WHATSAPP_ENABLED) {
    next();
    return;
  }

  res.status(404).json({ message: "Módulo WhatsApp desligado." });
});

whatsappRouter.get(
  "/queue",
  validate({ query: whatsappQueueQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await getQueue(req.query.filter as "todas" | "lead" | "reserva" | "outros");
    res.json(result);
  })
);

whatsappRouter.get(
  "/conversations",
  validate({ query: whatsappSearchQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await searchConversations(String(req.query.search)));
  })
);

whatsappRouter.get(
  "/queue/count",
  asyncHandler(async (_req, res) => {
    res.json({ waiting: await getQueueCount() });
  })
);

whatsappRouter.get(
  "/conversations/:id",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const detail = await getConversationDetail(req.params.id, req.user!.id);
    if (!detail) throw new HttpError(404, "Conversa não encontrada.");
    res.json(detail);
  })
);

whatsappRouter.get(
  "/conversations/:id/messages",
  validate({ params: whatsappContactIdSchema, query: whatsappMessagesQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await getConversationMessages(
      req.params.id,
      typeof req.query.before === "string" ? req.query.before : undefined,
      typeof req.query.after === "string" ? req.query.after : undefined,
      Number(req.query.limit)
    );
    if (!result) throw new HttpError(404, "Conversa não encontrada.");
    res.json(result);
  })
);

whatsappRouter.post(
  "/conversations/:id/read",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string }>(
      `UPDATE whatsapp_conversations
       SET unread_count = 0
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Conversa não encontrada.");
    res.status(204).send();
  })
);

whatsappRouter.post(
  "/conversations/:id/dismiss",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string }>(
      `UPDATE whatsapp_conversations
       SET awaiting_since = NULL, unread_count = 0,
           triage_status = 'idle', triage_requested_at = NULL
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Conversa não encontrada.");
    res.status(204).send();
  })
);

whatsappRouter.post(
  "/conversations/:id/messages",
  validate({ params: whatsappContactIdSchema, body: whatsappSendMessageSchema }),
  asyncHandler(async (req, res, next) => {
    try {
      const result = await sendMessage({
        conversationId: req.params.id,
        userId: req.user!.id,
        text: req.body.text,
        clientRequestId: req.body.clientRequestId,
        suggestionId: req.body.suggestionId ?? null,
        lastSeenMessageId: req.body.lastSeenMessageId ?? null,
        force: req.body.force
      });
      res.status(result.statusCode).json(result.message);
    } catch (error) {
      if (error instanceof OutboundError) {
        res.status(error.statusCode).json({ code: error.code, message: error.message, ...error.details });
        return;
      }
      next(error);
    }
  })
);

whatsappRouter.post(
  "/messages/:id/retry",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res, next) => {
    try {
      const result = await retryMessage(req.params.id, req.user!.id);
      res.status(result.statusCode).json(result.message);
    } catch (error) {
      if (error instanceof OutboundError) {
        res.status(error.statusCode).json({ code: error.code, message: error.message, ...error.details });
        return;
      }
      next(error);
    }
  })
);

whatsappRouter.post(
  "/conversations/:id/suggestion",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res, next) => {
    try {
      const suggestion = await getOrCreateSuggestion(req.params.id);
      if (!suggestion) {
        res.status(204).send();
        return;
      }
      res.json(suggestion);
    } catch (error) {
      if (error instanceof SuggestionError) {
        res.status(204).send();
        return;
      }
      next(error);
    }
  })
);

whatsappRouter.post(
  "/suggestions/:id/dismiss",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    await dismissSuggestion(req.params.id, req.user!.id);
    res.status(204).send();
  })
);

whatsappRouter.put(
  "/conversations/:id/outcome",
  validate({ params: whatsappContactIdSchema, body: whatsappOutcomeSchema }),
  asyncHandler(async (req, res) => {
    res.json(await setConversationOutcome(req.params.id, req.user!.id, req.body.outcome));
  })
);

whatsappRouter.post(
  "/conversations/:id/priority-feedback",
  validate({ params: whatsappContactIdSchema, body: whatsappPriorityFeedbackSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await addPriorityFeedback(req.params.id, req.user!.id, req.body.verdict));
  })
);

whatsappRouter.delete(
  "/conversations/:id/priority-feedback",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    await removePriorityFeedback(req.params.id, req.user!.id);
    res.status(204).send();
  })
);

whatsappRouter.get(
  "/learning/summary",
  validate({ query: whatsappLearningPeriodSchema }),
  asyncHandler(async (req, res) => {
    res.json(await learningSummary(req.query.period as "7d" | "30d" | "all"));
  })
);

whatsappRouter.get(
  "/learning/rules",
  asyncHandler(async (_req, res) => {
    res.json(await listRules());
  })
);

whatsappRouter.get(
  "/learning/corrections",
  validate({ query: whatsappLearningPageSchema }),
  asyncHandler(async (req, res) => {
    res.json(await listCorrections(Number(req.query.page)));
  })
);

whatsappRouter.post(
  "/learning/recompute",
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const previous = await query<{ last_started_at: string | null }>(
      "SELECT last_started_at::text FROM whatsapp_job_runs WHERE job_name = 'whatsapp_proposals'"
    );
    const lastStarted = previous[0]?.last_started_at ? Date.parse(previous[0].last_started_at) : 0;
    if (lastStarted && Date.now() - lastStarted < 10 * 60 * 1000) {
      throw new HttpError(409, "O recálculo já foi executado recentemente.", {
        nextAvailableAt: new Date(lastStarted + 10 * 60 * 1000).toISOString()
      });
    }
    await query(
      `INSERT INTO whatsapp_job_runs (job_name, last_started_at)
       VALUES ('whatsapp_proposals', NOW())
       ON CONFLICT (job_name) DO UPDATE SET last_started_at = NOW(), last_error = NULL`,
      []
    );
    await runLearningProposals();
    await recomputeQueueScores();
    res.status(202).json({ accepted: true });
  })
);

whatsappRouter.post(
  "/learning/rules/:id/:action",
  requireRole("admin"),
  validate({
    params: whatsappContactIdSchema.extend({ action: z.enum(["accept", "ignore", "revert"]) })
  }),
  asyncHandler(async (req, res) => {
    res.json(await decideRule(req.params.id, req.params.action as "accept" | "ignore" | "revert", req.user!.id));
  })
);

whatsappRouter.get(
  "/contacts/:id/link-candidates",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const contacts = await query<{ id: string; phone_e164: string; push_name: string }>(
      "SELECT id, phone_e164, push_name FROM whatsapp_contacts WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    const contact = contacts[0];
    if (!contact) throw new HttpError(404, "Contato WhatsApp não encontrado.");

    const variants = phoneVariants(contact.phone_e164);
    const pushName = contact.push_name.trim().slice(0, 100);
    const candidates = await query<{
      id: string;
      full_name: string;
      fone: string;
      fone_e164: string | null;
      match_kind: "phone" | "name";
    }>(
      `
        SELECT c.id, c.full_name, c.fone, c.fone_e164,
               CASE WHEN c.fone_e164 = ANY($1::text[]) THEN 'phone' ELSE 'name' END AS match_kind
        FROM clients c
        WHERE c.fone_e164 = ANY($1::text[])
           OR ($2 <> '' AND (
                c.full_name ILIKE '%' || $2 || '%'
                OR $2 ILIKE '%' || c.full_name || '%'
              ))
        ORDER BY
          CASE WHEN c.fone_e164 = ANY($1::text[]) THEN 0 ELSE 1 END,
          CASE
            WHEN LOWER(c.full_name) = LOWER($2) THEN 0
            WHEN $2 <> '' AND (c.full_name ILIKE '%' || $2 || '%' OR $2 ILIKE '%' || c.full_name || '%') THEN 1
            ELSE 2
          END,
          c.full_name ASC
        LIMIT 10
      `,
      [variants, pushName]
    );

    res.json({
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        fullName: candidate.full_name,
        fone: candidate.fone,
        foneE164: candidate.fone_e164,
        match: candidate.match_kind
      }))
    });
  })
);

whatsappRouter.put(
  "/contacts/:id/link",
  validate({ params: whatsappContactIdSchema, body: whatsappLinkBodySchema }),
  asyncHandler(async (req, res) => {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const contact = await db.query<{ id: string }>(
        "SELECT id FROM whatsapp_contacts WHERE id = $1 LIMIT 1",
        [req.params.id]
      );
      if (contact.rows.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");

      const client = await db.query<{ id: string }>("SELECT id FROM clients WHERE id = $1 LIMIT 1", [
        req.body.clientId
      ]);
      if (client.rows.length === 0) throw new HttpError(404, "Cliente não encontrado.");

      await db.query(
        `UPDATE whatsapp_contacts
         SET client_id = $1, linked_by_user_id = $2, linked_at = NOW(), auto_link_blocked = FALSE, updated_at = NOW()
         WHERE id = $3`,
        [req.body.clientId, req.user!.id, req.params.id]
      );
      await db.query("COMMIT");
      res.json({ contactId: req.params.id, clientId: req.body.clientId });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  })
);

whatsappRouter.delete(
  "/contacts/:id/link",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE whatsapp_contacts
       SET client_id = NULL, linked_by_user_id = $1, linked_at = NOW(), auto_link_blocked = TRUE, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [req.user!.id, req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");
    res.status(204).send();
  })
);

whatsappRouter.put(
  "/contacts/:id/kind",
  validate({ params: whatsappContactIdSchema, body: whatsappContactKindBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string; kind: "guest" | "supplier" }>(
      `UPDATE whatsapp_contacts
       SET kind = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, kind`,
      [req.body.kind, req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");
    res.json({ contactId: result[0].id, kind: result[0].kind });
  })
);
