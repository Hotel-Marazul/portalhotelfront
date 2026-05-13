# Phase 3: Data Quality & Agent Safety — Research

**Researched:** 2026-05-13
**Domain:** Zod validation (TypeScript/Express) + FastAPI conversational flow (Python) + git artifact hygiene
**Confidence:** HIGH

---

## Summary

Phase 3 has three independent requirements: CPF check-digit validation in the Express backend (QUA-01), a booking-confirmation step in the FastAPI agent before any DB write (QUA-02), and removing committed build artifacts from git (QUA-03).

QUA-01 is the most surprising finding: the work is **already done**. `clients.schema.ts` contains a fully correct `isValidCpf` function wired into the Zod schema via `.refine()`, and the `validate` middleware applies it on `POST /client/create` and `PUT /client/:id`. The only gap is that the middleware currently returns HTTP 400, not 422, for Zod validation failures. The success criterion specifies 422, so the middleware status code must be changed from 400 to 422.

QUA-02 requires inserting a confirmation gate in `agents/orchestration/flows.py` inside `run_booking()`. The current flow goes: classify intent → validate fields → check availability → call `self.booking_agent.create(extracted)` immediately. The gate must be added between availability confirmation and the `booking_agent.create()` call. The `ConversationStore` already provides per-conversation state keyed by `conversation_id`, so the pending-booking payload can be stashed there while the agent replies "Confirmar reserva?" and waits for the next user message to be `sim`/`confirmar`.

QUA-03 is fully resolved at the `.gitignore` level: `backend/dist/` is already on line 48 of the root `.gitignore`, AND `git ls-files backend/dist/` returns zero results — the directory is not tracked. The `backend/dist/` directory exists on disk (it is present locally) but is not in the git index. The success criteria are already satisfied; no code change is needed. The plan should verify and document this rather than making any change.

**Primary recommendation:** Fix the 422 status code in `validate.ts` (QUA-01, one-line change), add a confirmation-pending state to `ConversationStore` and a branch in `run_booking()` (QUA-02, surgical Python changes), and verify+document QUA-03 without touching any file.

---

## Project Constraints (from CLAUDE.md)

- Backend uses ESM — local imports MUST have `.js` extension
- Zod schema for CPF validation (already exists)
- `BACKEND_BEARER_TOKEN` required in agents service (Phase 2 concern, not Phase 3)
- Testes: zero automated tests exist — add Vitest test for `isValidCpf` if adding logic (Phase 5 is the test phase; Phase 3 may create the validator utility that Phase 5 tests)
- Never commit credentials in `.env.example` or `docker-compose.yaml`
- Conventional transaction pattern: `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` for multi-table mutations

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CPF check-digit validation | API / Backend (Express) | — | Data integrity enforced server-side; client-side is UX-only |
| Booking confirmation gate | API / Backend (agents FastAPI) | — | Agent owns the conversational state; confirmation must happen before any DB write |
| Build artifact hygiene | Build / git | — | `.gitignore` + git rm --cached; no runtime tier involved |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUA-01 | CPF validado com dígito verificador no backend (Zod schema) | `isValidCpf` already implemented in `clients.schema.ts`; middleware must return 422 not 400 |
| QUA-02 | Usuário confirma detalhes antes do agente IA criar reserva no banco | `run_booking()` in `flows.py` calls `booking_agent.create()` directly; confirmation state must be added to `ConversationStore` |
| QUA-03 | `backend/dist/` removido do git e adicionado ao `.gitignore` | Already satisfied: 0 tracked files, `.gitignore` line 48 present; plan must verify and document |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | Already in backend `package.json` | Runtime schema validation + type inference | Project standard; `validate` middleware uses it |
| express | 4.x (already installed) | HTTP routing, middleware | Project standard |
| fastapi | Already in `requirements.txt` | Python async HTTP framework | Project standard for agents |
| pydantic | Already in `requirements.txt` | Python data models, request/response schemas | Used throughout agents service |

No new dependencies are needed for Phase 3.

**Version verification:** All libraries are already installed; no npm/pip install required.

---

## Architecture Patterns

### System Architecture Diagram

```
QUA-01 flow:
  POST /client/create
       |
  validate middleware (zod clientBodySchema)
       |
  [isValidCpf refine] ──fail──> HTTP 422 + { message, issues }  ← STATUS MUST CHANGE (currently 400)
       |
  [pass] ──> clientsRouter handler ──> INSERT INTO clients
```

```
QUA-02 flow (current, broken):
  /chat POST ──> Supervisor.handle_chat()
       |
  receptionist.classify() → intent="booking"
       |
  flows.run_booking()
       |
  validate fields → check availability → booking_agent.create() ← DB WRITE (no gate)
       |
  ChatResponse (action_status="completed")

QUA-02 flow (target, with confirmation gate):
  /chat POST ──> Supervisor.handle_chat()
       |
  receptionist.classify() → intent="booking"
       |
  flows.run_booking()
       |
  [state.pending_booking is set? AND user_message == confirm?]
       ├─ YES ──> booking_agent.create() ──> completed response
       └─ NO
           |
       validate fields → check availability
           |
       store pending_booking payload in ConversationState.context
           |
       return "Confirmar reserva?" summary reply (action_status="pending", no DB write)

  Next /chat turn with same conversation_id:
       |
  receptionist.classify() → intent="booking" (or user says "sim")
       |
  flows.run_booking() sees pending_booking in state.context + confirmation signal
       |
  booking_agent.create() ──> DB write ──> completed response
```

### Recommended Project Structure

No structural changes needed. All changes are surgical edits to existing files:

```
backend/src/middlewares/validate.ts      # change 400 → 422
agents/orchestration/state.py           # add pending_booking field to ConversationState
agents/orchestration/flows.py           # add confirmation gate in run_booking()
```

### Pattern 1: Zod `.refine()` for custom validation

**What:** Attach a predicate function to a Zod field; on failure, return a custom message. The `validate` middleware calls `.parse()` which throws `ZodError` on failure.

**When to use:** Any business-rule validation that goes beyond type/format checks.

**Example (already implemented in `clients.schema.ts`):**
```typescript
// Source: backend/src/modules/clients/clients.schema.ts (verified in codebase)
cpf: z.string().min(11).max(14).refine(isValidCpf, { message: "CPF inválido." }),
```

### Pattern 2: Middleware status code for validation errors

**What:** The `validate` middleware currently returns HTTP 400 for `ZodError`. The success criterion for QUA-01 requires HTTP 422. HTTP 422 Unprocessable Entity is the REST-standard status for syntactically valid but semantically invalid data — appropriate for a CPF that is well-formed but fails the check-digit algorithm.

**Change required (single line):**
```typescript
// Source: backend/src/middlewares/validate.ts (verified in codebase)
// BEFORE:
res.status(400).json({ message: "Dados inválidos.", issues: error.flatten() });
// AFTER:
res.status(422).json({ message: "Dados inválidos.", issues: error.flatten() });
```

**Impact:** This change affects ALL routes using `validate()`. Any frontend code that catches 400 from validation errors must be verified to also handle 422.

### Pattern 3: Conversation-state pending gate (QUA-02)

**What:** Store a pending booking payload in `ConversationState.context` with a well-known key (e.g., `"pending_booking"`). On the next turn, detect the key and the user's confirmation signal before writing to the DB.

**Confirmation signal detection:** The simplest reliable approach is to check whether the user message contains a case-insensitive Portuguese confirmation word: `sim`, `confirmar`, `ok`, `confirmo`. A regex or a simple `lower().strip() in CONFIRM_WORDS` suffices. No NLP library needed.

**State location:** `ConversationState.context` is a `dict[str, Any]` already used to accumulate extracted fields across turns (e.g., `check_in`, `check_out`, `room_id`). Adding `pending_booking` to this dict is idiomatic.

**Example pattern:**
```python
# In ConversationState (state.py) — add type annotation only; no structural change needed
# context["pending_booking"] = {
#     "payload": extracted,          # everything needed for booking_agent.create()
#     "summary": human_readable_str  # shown in the confirmation reply
# }
```

**Confirmation detection:**
```python
# In flows.py run_booking()
CONFIRM_WORDS = {"sim", "confirmar", "ok", "confirmo", "yes", "s"}

def _is_confirmation(user_message: str) -> bool:
    return user_message.strip().lower() in CONFIRM_WORDS
```

**State cleanup:** After the booking is created (or rejected), remove `pending_booking` from `context` to prevent stale state affecting future turns.

### Anti-Patterns to Avoid

- **Duplicating `isValidCpf` in a new file:** The function already exists in `clients.schema.ts`. Any new utility (e.g., for Phase 5 tests) should import from there or extract to a shared util — never copy-paste.
- **Using the `receptionist.classify()` intent to detect confirmation:** The receptionist classifies intent from content; a bare "sim" may classify as "unknown" or "general". The confirmation gate must be a pre-check on `state.context["pending_booking"]`, not an intent branch.
- **Stashing pending_booking in a module-level variable:** The `ConversationStore` is in-memory per-process; storing in `state.context` is correct. A global variable would not be conversation-scoped.
- **Running `git rm -r --cached backend/dist/` unnecessarily:** `git ls-files backend/dist/` returns zero — the directory is not tracked. Running `git rm --cached` on an untracked path fails. The plan must verify first, not blindly execute.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPF check-digit algorithm | A new validator | The existing `isValidCpf` in `clients.schema.ts` | Already implemented, tested by the algorithm description, used in production |
| Conversation state persistence | A database-backed session store | `ConversationStore` in-memory (already exists) | Phase 3 scope is one-process dev; persistence is a v2 concern |
| NLP confirmation detection | An LLM call to parse "sim" | Simple `CONFIRM_WORDS` set lookup | Over-engineering; "sim"/"ok"/"confirmar" are unambiguous |

---

## Common Pitfalls

### Pitfall 1: 400 vs 422 — breaking existing frontend error handling

**What goes wrong:** Changing the `validate` middleware from 400 to 422 is correct for semantics, but any frontend code that catches `status === 400` from a form submission will silently stop showing validation errors.

**Why it happens:** The middleware is shared across all routes. Frontend components that check `if (error.status === 400)` to display field errors will now miss 422.

**How to avoid:** Search the frontend for `400` status checks or error-boundary conditions tied to form submissions. Update them to handle both or use `>= 400`.

**Warning signs:** After the change, form submission errors stop appearing in the UI even though the backend correctly rejects the request.

### Pitfall 2: `pending_booking` stale state on abandon

**What goes wrong:** User initiates a booking flow, agent replies with "Confirmar reserva?", user then asks about availability instead. The `pending_booking` key remains in context, and a future accidental "sim" message triggers a DB write.

**Why it happens:** The state is accumulated and merged — nothing clears it automatically.

**How to avoid:** Clear `pending_booking` from context whenever a non-confirmation intent is handled, or when the booking is completed or rejected. Also set a reasonable expiry strategy if this becomes a concern at v2.

**Warning signs:** A second booking is created unexpectedly in a long conversation.

### Pitfall 3: Confirmation intent not reaching `run_booking()`

**What goes wrong:** The user says "sim" as their next message. `receptionist.classify()` sees "sim" with no booking context and returns `intent="general"` or `intent="unknown"`. The flow routes to `run_general()` and the pending booking is never executed.

**Why it happens:** The receptionist classifies the current message in isolation (or with limited context). A single-word "sim" carries no semantic booking content.

**How to avoid:** In `Supervisor.handle_chat()`, before routing to `flows.run_X()`, check if `state.context.get("pending_booking")` exists. If it does, force intent to "booking" regardless of the receptionist's classification, and pass the user message for confirmation detection in `run_booking()`. Pass the raw `user_message` down to `run_booking()` so it can call `_is_confirmation()`.

**Warning signs:** "sim" replies are handled as general chit-chat instead of booking confirmations.

### Pitfall 4: `run_booking()` signature change breaks `FlowCoordinator` call site

**What goes wrong:** `run_booking()` currently takes `(conversation_id, extracted, missing_fields)`. Adding `user_message` as a parameter requires updating the call site in `Supervisor.handle_chat()`.

**How to avoid:** Add `user_message: str = ""` as a keyword-only parameter with a default. The existing call site in `supervisor.py` will continue to work; the new code path (confirmation detection) uses it when set.

---

## QUA-01 Detailed Findings (CPF Validation)

**Current state (verified by reading `clients.schema.ts`):**

- `isValidCpf(raw: string): boolean` is implemented correctly on lines 3-19.
- Algorithm: strips non-digits, checks length == 11, rejects all-same-digit, computes both check digits using the standard Brazilian CPF weights. [VERIFIED: codebase read]
- Schema: `cpf: z.string().min(11).max(14).refine(isValidCpf, { message: "CPF inválido." })` — the refine is in place. [VERIFIED: codebase read]
- Applied to: `POST /client/create` (line 232) and `PUT /client/:id` (line 264) via `validate({ body: clientBodySchema })`. [VERIFIED: codebase read]
- **Gap:** `validate.ts` line 25 returns `res.status(400)`. Success criterion requires 422. [VERIFIED: codebase read]

**Required change:** One character change in `validate.ts` — `400` to `422`.

**Frontend impact to check:** Any component calling `POST /client/create` or `PUT /client/:id` that checks the response status code for 400.

---

## QUA-02 Detailed Findings (Agent Confirmation Gate)

**Current booking flow (verified by reading `flows.py`, `supervisor.py`, `booking_agent.py`):**

1. `Supervisor.handle_chat()` receives `ChatRequest` with `conversation_id` and `user_message`.
2. `receptionist.classify()` extracts intent + fields.
3. `flows.run_booking(conversation_id, extracted, missing_fields)` is called.
4. If fields present and room available, `booking_agent.create(extracted)` is called immediately — no confirmation step. [VERIFIED: `flows.py` lines 168-190]
5. `booking_agent.create()` calls `backend_api.create_reservation()` which posts to `POST /Reservations`. [VERIFIED: `backend_api.py` lines 62-64]

**State store (verified):**
- `ConversationStore._conversations: dict[str, ConversationState]` — in-memory, per-process. [VERIFIED: `state.py`]
- `ConversationState.context: dict[str, Any]` — mutable, supports arbitrary keys. [VERIFIED: `state.py`]
- `Supervisor.store.merge_context(conversation_id, values)` — used to persist extracted fields across turns. [VERIFIED: `supervisor.py` line 42]

**Implementation strategy:**

The confirmation gate requires changes to three locations:

1. **`state.py`** — No structural change needed. `context` dict already supports storing `pending_booking`.

2. **`flows.py` — `run_booking()` method:**
   - Add `user_message: str = ""` parameter.
   - At entry: check if `state.context["pending_booking"]` exists (need to pass `state` or check via a store method). Actually `run_booking()` does not currently receive `state` — it receives `conversation_id`, `extracted`, `missing_fields`. The `pending_booking` check must be done in `supervisor.py` before calling `run_booking()`, OR `run_booking()` must be given access to the store.
   - **Cleaner approach:** Do the pending-booking check in `Supervisor.handle_chat()` before routing to flows. If `pending_booking` is in context, treat the current message as a confirmation attempt regardless of intent.

3. **`supervisor.py` — `handle_chat()` method:**
   - After `merge_context`, check `state.context.get("pending_booking")`.
   - If present: pass both `extracted` + `user_message` to `flows.run_booking()`, let it determine if the message is a confirmation.
   - If `_is_confirmation(user_message)` → proceed to `booking_agent.create()`.
   - If not → re-ask for confirmation, do not clear pending_booking.

**Confirmation message format (success criterion):** The agent must reply with a summary and ask "Confirmar reserva?" verbatim (or functionally equivalent). The summary should include room_id, check-in/check-out dates, client_id. The exact wording is not tested by integration tests but the success criterion states the agent must ask this question.

**`AgnoResponseAgent.rewrite()`** in `supervisor.py` line 89 post-processes the reply. The confirmation reply should survive rewrite intact, or the rewrite should be bypassed for the confirmation step. Given the rewrite uses OpenAI, it may rephrase the question — this needs care. Safe approach: format the confirmation reply clearly enough that the rewrite preserves the intent.

---

## QUA-03 Detailed Findings (Build Artifacts in Git)

**Current state (verified):**

- `git ls-files backend/dist/` returns 0 files — the directory is **not tracked by git**. [VERIFIED: Bash command]
- `.gitignore` line 48: `backend/dist/` — already present. [VERIFIED: `.gitignore` read]
- `backend/dist/` directory exists on disk (contains `app.js`, `server.js`, compiled modules). [VERIFIED: Bash ls]

**Conclusion:** QUA-03 success criteria are already fully satisfied:
1. `git ls-files backend/dist/` returns empty — confirmed.
2. `backend/dist/` is in `.gitignore` — confirmed.

**Required plan action:** Run the verification commands, document findings, and mark QUA-03 as satisfied. No file modifications needed.

**Risk:** If someone ran `git add -f backend/dist/` in the past and the files were committed but are now excluded via a newer `.gitignore` entry, old commits would still contain them. However, the WORKING TREE git index is clean, which is what the success criterion tests. [VERIFIED]

---

## Runtime State Inventory

This phase is not a rename/refactor/migration — it involves code edits and git hygiene. No runtime state inventory is required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Backend TypeScript compile | Assumed available (backend already running) | [ASSUMED] | — |
| Python 3.12 / uvicorn | FastAPI agents | Assumed available (agents already running) | [ASSUMED] | — |
| git | QUA-03 verification | ✓ (repo is active git repo) | Any | — |

Step 2.6: No new external dependencies introduced by Phase 3.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (backend) — not yet installed; Phase 5 adds it |
| Config file | None detected in `backend/` |
| Quick run command | `cd backend && npx vitest run` (after Phase 5 setup) |
| Full suite command | `cd backend && npx vitest run` |

**Note:** Phase 3 changes are amenable to automated testing, but Phase 5 is the designated test-coverage phase. Phase 3 plan should include manual verification steps and optionally create the `validateCPF` export that Phase 5 will test.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUA-01 | POST /client/create with invalid CPF returns 422 | integration (manual for Phase 3) | `curl -X POST .../client/create -d '{"cpf":"000.000.000-00",...}'` | ❌ Wave 0 (Phase 5) |
| QUA-02 | Agent replies "Confirmar reserva?" before DB write | manual/smoke | n/a — no test runner for agents yet | ❌ Wave 0 |
| QUA-03 | `git ls-files backend/dist/` returns empty | shell verification | `git ls-files backend/dist/ \| wc -l` → must be 0 | ✓ (git command) |

### Wave 0 Gaps

- `backend/tests/` directory does not exist — needed by Phase 5 but not Phase 3. Phase 3 plan should document manual curl test for QUA-01.
- Agent integration tests require a running FastAPI process; no automated framework configured.

*(If no gaps for Phase 3 execution: Phase 3 relies on manual verification for QUA-01 and QUA-02. QUA-03 is a git command.)*

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes (QUA-01) | Zod `.refine()` — already in place |
| V2 Authentication | No | Out of scope for Phase 3 |
| V3 Session Management | No | Agent state is in-memory, not session auth |
| V4 Access Control | No | Out of scope for Phase 3 |
| V6 Cryptography | No | No crypto operations in Phase 3 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid CPF stored and used downstream | Tampering | Zod refine on server-side (already implemented — enforce 422 response) |
| Agent creates reservation without user consent | Spoofing / Tampering | Confirmation gate with explicit user acknowledgment before DB write |

---

## Code Examples

### QUA-01: Fix validate middleware to return 422

```typescript
// Source: backend/src/middlewares/validate.ts (verified — line 25)
// Change:
res.status(422).json({
  message: "Dados inválidos.",
  issues: error.flatten()
});
```

### QUA-02: Pending booking stash in context

```python
# In flows.py run_booking() — before calling booking_agent.create()
# Build human-readable summary
summary = (
    f"Quarto: {extracted['room_id']}\n"
    f"Check-in: {extracted['check_in']}\n"
    f"Check-out: {extracted['check_out']}\n"
    f"Cliente: {extracted['client_id']}\n"
    f"Hóspedes: {extracted.get('guests', 1)}\n"
)
# Stash in conversation context (store reference needed)
# store.merge_context(conversation_id, {"pending_booking": {"payload": extracted, "summary": summary}})

reply = f"Resumo da reserva:\n{summary}\nConfirmar reserva?"
return self.decision_agent.compose(
    conversation_id=conversation_id,
    intent="booking",
    reply=reply,
    explanation="Aguardando confirmacao do usuario antes de gravar no banco.",
    action_type="create_booking",
    action_status="pending",
)
```

### QUA-02: Confirmation check in supervisor

```python
# In supervisor.py handle_chat() — before intent routing
state = self.store.get_or_create(request.conversation_id)
pending = state.context.get("pending_booking")

CONFIRM_WORDS = {"sim", "confirmar", "ok", "confirmo", "yes", "s"}
if pending and request.user_message.strip().lower() in CONFIRM_WORDS:
    # Force booking intent with pre-validated payload
    response = await self.flows.run_booking(
        request.conversation_id,
        pending["payload"],
        missing_fields=[],
        confirmed=True,
    )
    self.store.merge_context(request.conversation_id, {"pending_booking": None})
else:
    # Normal routing (existing code)
    ...
```

### QUA-03: Verification commands

```bash
# Verify no tracked files in backend/dist/
git ls-files backend/dist/
# Expected: empty output

# Verify .gitignore entry
grep "backend/dist" .gitignore
# Expected: backend/dist/
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trust client CPF formatting | Server-side check-digit validation | Already in codebase | Invalid CPFs rejected before DB write |
| Direct agent-to-DB write | Confirmation-gated write | This phase | User retains control; prevents accidental bookings |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Frontend components use `status === 400` for validation error display | QUA-01, Pitfall 1 | If frontend uses `status >= 400`, no change needed; if uses `=== 400`, UI breaks silently |
| A2 | `AgnoResponseAgent.rewrite()` will preserve the "Confirmar reserva?" phrasing | QUA-02 | If rewrite strips/rephrases it, the confirmation question may be unclear to users |
| A3 | Node.js and Python are available in the dev environment | Environment Availability | Would block building/testing — low risk given active development |

---

## Open Questions

1. **Does the frontend check `status === 400` or `status >= 400` for validation errors?**
   - What we know: The `validate` middleware currently returns 400; changing to 422 is correct by REST semantics.
   - What's unclear: Frontend form components may check exact status codes.
   - Recommendation: Grep frontend for `=== 400` or `status == 400` before merging the `validate.ts` change.

2. **Should `run_update()` also get a confirmation gate?**
   - What we know: QUA-02 success criterion specifies "describing a booking" (create intent). Updates and cancellations are not mentioned.
   - What's unclear: Whether the spirit of the requirement covers updates/cancels.
   - Recommendation: Scope Phase 3 to create only; updates/cancels can be gated in a future phase.

3. **Does `AgnoResponseAgent.rewrite()` call OpenAI on every response?**
   - What we know: `supervisor.py` lines 89-97 call `agno_response_agent.rewrite()`. If OpenAI key is missing, it may raise an error.
   - What's unclear: Whether the agents service is configured with a working OpenAI key in the dev environment.
   - Recommendation: The confirmation reply should work even if rewrite is a no-op (it falls back to the original reply string).

---

## Sources

### Primary (HIGH confidence)
- `backend/src/modules/clients/clients.schema.ts` (verified by codebase read) — isValidCpf algorithm, Zod refine
- `backend/src/middlewares/validate.ts` (verified by codebase read) — HTTP 400 status on ZodError
- `backend/src/modules/clients/clients.routes.ts` (verified by codebase read) — validate middleware applied to POST/PUT
- `agents/orchestration/flows.py` (verified by codebase read) — run_booking() direct DB write without gate
- `agents/orchestration/supervisor.py` (verified by codebase read) — handle_chat() routing
- `agents/orchestration/state.py` (verified by codebase read) — ConversationStore, ConversationState.context
- `agents/tools/backend_api.py` (verified by codebase read) — create_reservation() POST /Reservations
- `agents/agents/booking_agent.py` (verified by codebase read) — BookingAgent.create() call path
- `.gitignore` line 48 (verified by codebase read) — backend/dist/ present
- `git ls-files backend/dist/` (verified by Bash command) — 0 results

### Secondary (MEDIUM confidence)
- HTTP 422 Unprocessable Entity semantics — standard REST convention for validation failures [ASSUMED training knowledge; widely accepted]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- QUA-01 analysis: HIGH — read the actual schema and middleware source
- QUA-02 analysis: HIGH — read all relevant agent files; implementation pattern is clear
- QUA-03 analysis: HIGH — ran `git ls-files` and read `.gitignore` directly
- Frontend 400→422 impact: MEDIUM — depends on frontend code not yet inspected

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack; agents code changes slowly)
