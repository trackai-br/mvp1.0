# Webhook Handler Implementation — Parallel Development Checklist

**For:** 3 developers (Dev A: Hotmart, Dev B: Kiwify, Dev C: Stripe/PagSeguro)
**Duration:** ~2 hours per gateway (including tests)
**Story:** 007

---

## Pre-Implementation (All Devs) — 15 min

- [ ] Read `docs/WEBHOOK-HANDLER-PATTERN.md` (full understanding)
- [ ] Read `docs/WEBHOOK-HANDLER-QUICK-REF.md` (reference card)
- [ ] Read `docs/WEBHOOK-HANDLER-EXAMPLES.md` (your specific gateway)
- [ ] Confirm `fastify-raw-body` is registered in `server.ts` (already done)
- [ ] Confirm Prisma schema has `Identity` and `DedupeRegistry` models
- [ ] Confirm shared package exports your gateway's schema

---

## Dev A — Hotmart Implementation

### Phase 1: Setup (10 min)

- [ ] Create file: `apps/api/src/webhooks/hotmart-webhook-handler.ts`
- [ ] Create file: `apps/api/src/webhooks/hotmart-webhook-handler.test.ts`
- [ ] Create file: `apps/api/src/webhooks/hotmart-adapter.ts` (route handler)

### Phase 2: Add Zod Schema (10 min)

**File:** `packages/shared/src/index.ts`

- [ ] Add `export const hotmartWebhookSchema = z.object({ ... })`
- [ ] Add `export type HotmartWebhookBody = z.infer<typeof hotmartWebhookSchema>`
- [ ] Export both from index.ts
- [ ] Run `npm run typecheck` (must pass)

### Phase 3: Implement Handler (30 min)

**File:** `apps/api/src/webhooks/hotmart-webhook-handler.ts`

**Checklist:**
- [ ] Export type `HotmartHandlerDeps` with 4 optional dependencies
- [ ] Implement `sha256hex()` helper
- [ ] Implement `computeHmac()` helper
- [ ] Implement `timingSafeCompare()` helper
- [ ] Implement main function: `handleHotmartWebhook()`
  - [ ] Step 1: HMAC validation (return `invalid_signature`)
  - [ ] Step 2: Find tenant (return `tenant_not_found`)
  - [ ] Step 3: Hash email (lowercase + trim) and phone (digits only)
  - [ ] Step 4: Generate deterministic eventId using formula: `tenantId|transaction_id|purchase|amount|currency`
  - [ ] Step 5: Create identity if email or phone present
  - [ ] Step 6: Insert dedupe (handle constraint violation → isDuplicate)
  - [ ] Return: `{ ok: true, eventId, isDuplicate }` or error

### Phase 4: Write Unit Tests (30 min)

**File:** `apps/api/src/webhooks/hotmart-webhook-handler.test.ts`

**Checklist:**
- [ ] Mock `./db`
- [ ] Define `SECRET`, `TENANT_ID`, `sign()` helper
- [ ] Define valid test body with customer email/phone
- [ ] Define `baseDeps` with all 4 mocked dependencies
- [ ] Test: invalid_signature (missing, wrong, no secret) → 3 tests
- [ ] Test: tenant_not_found
- [ ] Test: identity created with correct hashing (hex format, no plain-text)
- [ ] Test: isDuplicate detection (insertDedupe returns false)
- [ ] Test: eventId is deterministic (same input → same output)
- [ ] Test: skip identity creation when no email/phone
- [ ] All tests pass: `npm test`

### Phase 5: Integrate into Server (15 min)

**File:** `apps/api/src/server.ts`

- [ ] Import: `{ hotmartWebhookSchema } from '@hub/shared'`
- [ ] Import: `{ handleHotmartWebhook } from './webhooks/hotmart-webhook-handler.js'`
- [ ] Add route: `app.post('/api/v1/webhooks/hotmart/:tenantId', async (request, reply) => { ... })`
- [ ] Route must:
  - [ ] Extract `tenantId` from params
  - [ ] Extract `X-Hotmart-Signature` header
  - [ ] Get `rawBody` from request
  - [ ] Validate with schema
  - [ ] Call handler
  - [ ] Return 401 if `invalid_signature`
  - [ ] Return 404 if `tenant_not_found`
  - [ ] Return 202 with `{ ok: true, eventId }` on success

### Phase 6: Verify (10 min)

- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — no ESLint errors
- [ ] `npm run typecheck` — no TypeScript errors
- [ ] Git status: `git status` (should show new files)

### Phase 7: Submit (5 min)

- [ ] `git add apps/api/src/webhooks/hotmart-* packages/shared/src/index.ts`
- [ ] `git commit -m "feat: implement Hotmart webhook handler [story-track-ai-007]"`
- [ ] Notify: "Hotmart complete, ready for QA"

---

## Dev B — Kiwify Implementation

### Phase 1: Setup (10 min)

- [ ] Create file: `apps/api/src/webhooks/kiwify-webhook-handler.ts`
- [ ] Create file: `apps/api/src/webhooks/kiwify-webhook-handler.test.ts`
- [ ] Create file: `apps/api/src/webhooks/kiwify-adapter.ts` (route handler)

### Phase 2: Add Zod Schema (10 min)

**File:** `packages/shared/src/index.ts`

- [ ] Add `export const kiwifyWebhookSchema = z.object({ ... })`
- [ ] Add `export type KiwifyWebhookBody = z.infer<typeof kiwifyWebhookSchema>`
- [ ] Export both from index.ts
- [ ] Run `npm run typecheck` (must pass)

### Phase 3: Implement Handler (30 min)

**File:** `apps/api/src/webhooks/kiwify-webhook-handler.ts`

**Checklist:**
- [ ] Export type `KiwifyHandlerDeps` with 4 optional dependencies
- [ ] Implement `sha256hex()` helper
- [ ] Implement `computeHmac()` helper
- [ ] Implement `timingSafeCompare()` helper
- [ ] Implement main function: `handleKiwifyWebhook()`
  - [ ] Step 1: HMAC validation (return `invalid_signature`)
  - [ ] Step 2: Find tenant (return `tenant_not_found`)
  - [ ] Step 3: Hash email (lowercase + trim) and phone (digits only)
  - [ ] Step 4: Generate deterministic eventId using formula: `tenantId|order_id|purchase|amount|currency`
  - [ ] Step 5: Create identity if email or phone present
  - [ ] Step 6: Insert dedupe (handle constraint violation → isDuplicate)
  - [ ] Return: `{ ok: true, eventId, isDuplicate }` or error

### Phase 4: Write Unit Tests (30 min)

**File:** `apps/api/src/webhooks/kiwify-webhook-handler.test.ts`

**Checklist:**
- [ ] Mock `./db`
- [ ] Define `SECRET`, `TENANT_ID`, `sign()` helper
- [ ] Define valid test body with customer email/phone
- [ ] Define `baseDeps` with all 4 mocked dependencies
- [ ] Test: invalid_signature (missing, wrong, no secret) → 3 tests
- [ ] Test: tenant_not_found
- [ ] Test: identity created with correct hashing (hex format, no plain-text)
- [ ] Test: isDuplicate detection (insertDedupe returns false)
- [ ] Test: eventId is deterministic (same input → same output)
- [ ] Test: skip identity creation when no email/phone
- [ ] All tests pass: `npm test`

### Phase 5: Integrate into Server (15 min)

**File:** `apps/api/src/server.ts`

- [ ] Import: `{ kiwifyWebhookSchema } from '@hub/shared'`
- [ ] Import: `{ handleKiwifyWebhook } from './webhooks/kiwify-webhook-handler.js'`
- [ ] Add route: `app.post('/api/v1/webhooks/kiwify/:tenantId', async (request, reply) => { ... })`
- [ ] Route must:
  - [ ] Extract `tenantId` from params
  - [ ] Extract `X-Kiwify-Signature` header
  - [ ] Get `rawBody` from request
  - [ ] Validate with schema
  - [ ] Call handler
  - [ ] Return 401 if `invalid_signature`
  - [ ] Return 404 if `tenant_not_found`
  - [ ] Return 202 with `{ ok: true, eventId }` on success

### Phase 6: Verify (10 min)

- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — no ESLint errors
- [ ] `npm run typecheck` — no TypeScript errors
- [ ] Git status: `git status` (should show new files)

### Phase 7: Submit (5 min)

- [ ] `git add apps/api/src/webhooks/kiwify-* packages/shared/src/index.ts`
- [ ] `git commit -m "feat: implement Kiwify webhook handler [story-track-ai-007]"`
- [ ] Notify: "Kiwify complete, ready for QA"

---

## Dev C — Stripe + PagSeguro Implementation

**Note:** Stripe is slightly different (timestamp validation). Do Stripe first, then PagSeguro.

### Part 1: Stripe Implementation

#### Phase 1: Setup (10 min)

- [ ] Create file: `apps/api/src/webhooks/stripe-webhook-handler.ts`
- [ ] Create file: `apps/api/src/webhooks/stripe-webhook-handler.test.ts`
- [ ] Create file: `apps/api/src/webhooks/stripe-adapter.ts` (route handler)

#### Phase 2: Add Zod Schema (10 min)

**File:** `packages/shared/src/index.ts`

- [ ] Add `export const stripeWebhookSchema = z.object({ ... })`
- [ ] Add `export type StripeWebhookBody = z.infer<typeof stripeWebhookSchema>`
- [ ] Export both from index.ts
- [ ] Run `npm run typecheck` (must pass)

#### Phase 3: Implement Handler (40 min — more complex)

**File:** `apps/api/src/webhooks/stripe-webhook-handler.ts`

**Checklist:**
- [ ] Export type `StripeHandlerDeps` with 4 optional dependencies
- [ ] Implement `sha256hex()` helper
- [ ] Implement `validateStripeSignature()` helper (special format + timestamp)
  - [ ] Parse signature: `t=timestamp,v1=hash`
  - [ ] Validate timestamp < 5 min old
  - [ ] Compute HMAC on `timestamp.rawBody`
  - [ ] Use timing-safe compare on `v1` value
- [ ] Implement main function: `handleStripeWebhook()`
  - [ ] Step 1: Validate Stripe signature (return `invalid_signature`)
  - [ ] Step 2: Find tenant (return `tenant_not_found`)
  - [ ] Step 3: Hash email (lowercase + trim) and phone (digits only)
  - [ ] Step 4: Generate deterministic eventId using formula: `tenantId|event_id|charge.succeeded|amount|currency`
  - [ ] Step 5: Create identity if email or phone present
  - [ ] Step 6: Insert dedupe (handle constraint violation → isDuplicate)
  - [ ] Return: `{ ok: true, eventId, isDuplicate }` or error

#### Phase 4: Write Unit Tests (40 min)

**File:** `apps/api/src/webhooks/stripe-webhook-handler.test.ts`

**Checklist:**
- [ ] Mock `./db`
- [ ] Define `SECRET`, `TENANT_ID`, helper to create Stripe-format signature
- [ ] Define valid test body with customer email/phone
- [ ] Define `baseDeps` with all 4 mocked dependencies
- [ ] Test: invalid_signature (missing, wrong format, invalid hex)
- [ ] Test: invalid_signature when timestamp too old (> 5 min)
- [ ] Test: tenant_not_found
- [ ] Test: identity created with correct hashing (hex format, no plain-text)
- [ ] Test: isDuplicate detection (insertDedupe returns false)
- [ ] Test: eventId is deterministic (same input → same output)
- [ ] Test: skip identity creation when no email/phone
- [ ] All tests pass: `npm test`

#### Phase 5: Integrate into Server (15 min)

**File:** `apps/api/src/server.ts`

- [ ] Import: `{ stripeWebhookSchema } from '@hub/shared'`
- [ ] Import: `{ handleStripeWebhook } from './webhooks/stripe-webhook-handler.js'`
- [ ] Add route: `app.post('/api/v1/webhooks/stripe/:tenantId', async (request, reply) => { ... })`
- [ ] Route must:
  - [ ] Extract `tenantId` from params
  - [ ] Extract `Stripe-Signature` header (note: no X- prefix)
  - [ ] Get `rawBody` from request
  - [ ] Validate with schema
  - [ ] Call handler
  - [ ] Return 401 if `invalid_signature`
  - [ ] Return 404 if `tenant_not_found`
  - [ ] Return 202 with `{ ok: true, eventId }` on success

#### Phase 6: Verify (10 min)

- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — no ESLint errors
- [ ] `npm run typecheck` — no TypeScript errors

---

### Part 2: PagSeguro Implementation

#### Phase 1: Setup (10 min)

- [ ] Create file: `apps/api/src/webhooks/pagseguro-webhook-handler.ts`
- [ ] Create file: `apps/api/src/webhooks/pagseguro-webhook-handler.test.ts`
- [ ] Create file: `apps/api/src/webhooks/pagseguro-adapter.ts` (route handler)

#### Phase 2: Add Zod Schema (10 min)

**File:** `packages/shared/src/index.ts`

- [ ] Add `export const pagseguroWebhookSchema = z.object({ ... })`
- [ ] Add `export type PagSeguroWebhookBody = z.infer<typeof pagseguroWebhookSchema>`
- [ ] Export both from index.ts
- [ ] Run `npm run typecheck` (must pass)

#### Phase 3: Implement Handler (30 min)

**File:** `apps/api/src/webhooks/pagseguro-webhook-handler.ts`

**Checklist:**
- [ ] Export type `PagSeguroHandlerDeps` with 4 optional dependencies
- [ ] Implement `sha256hex()` helper
- [ ] Implement `computeHmac()` helper
- [ ] Implement `timingSafeCompare()` helper
- [ ] Implement main function: `handlePagSeguroWebhook()`
  - [ ] Step 1: HMAC validation (return `invalid_signature`)
  - [ ] Step 2: Find tenant (return `tenant_not_found`)
  - [ ] Step 3: Hash email (lowercase + trim) and phone (digits only) from `buyer` field
  - [ ] Step 4: Generate deterministic eventId using formula: `tenantId|reference|purchase|amount|currency`
  - [ ] Step 5: Create identity if email or phone present
  - [ ] Step 6: Insert dedupe (handle constraint violation → isDuplicate)
  - [ ] Return: `{ ok: true, eventId, isDuplicate }` or error

#### Phase 4: Write Unit Tests (30 min)

**File:** `apps/api/src/webhooks/pagseguro-webhook-handler.test.ts`

**Checklist:**
- [ ] Mock `./db`
- [ ] Define `SECRET`, `TENANT_ID`, `sign()` helper
- [ ] Define valid test body with buyer email/phone
- [ ] Define `baseDeps` with all 4 mocked dependencies
- [ ] Test: invalid_signature (missing, wrong, no secret) → 3 tests
- [ ] Test: tenant_not_found
- [ ] Test: identity created with correct hashing (hex format, no plain-text)
- [ ] Test: isDuplicate detection (insertDedupe returns false)
- [ ] Test: eventId is deterministic (same input → same output)
- [ ] Test: skip identity creation when no email/phone
- [ ] All tests pass: `npm test`

#### Phase 5: Integrate into Server (15 min)

**File:** `apps/api/src/server.ts`

- [ ] Import: `{ pagseguroWebhookSchema } from '@hub/shared'`
- [ ] Import: `{ handlePagSeguroWebhook } from './webhooks/pagseguro-webhook-handler.js'`
- [ ] Add route: `app.post('/api/v1/webhooks/pagseguro/:tenantId', async (request, reply) => { ... })`
- [ ] Route must:
  - [ ] Extract `tenantId` from params
  - [ ] Extract `X-PagSeguro-Signature` header
  - [ ] Get `rawBody` from request
  - [ ] Validate with schema
  - [ ] Call handler
  - [ ] Return 401 if `invalid_signature`
  - [ ] Return 404 if `tenant_not_found`
  - [ ] Return 202 with `{ ok: true, eventId }` on success

#### Phase 6: Verify (10 min)

- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — no ESLint errors
- [ ] `npm run typecheck` — no TypeScript errors
- [ ] Git status: `git status` (should show new files)

#### Phase 7: Submit (5 min)

- [ ] `git add apps/api/src/webhooks/stripe-* apps/api/src/webhooks/pagseguro-* packages/shared/src/index.ts`
- [ ] `git commit -m "feat: implement Stripe and PagSeguro webhook handlers [story-track-ai-007]"`
- [ ] Notify: "Stripe and PagSeguro complete, ready for QA"

---

## Final Sync (All Devs) — 10 min

After all 3 devs have completed:

- [ ] Dev A: Pull latest from B and C
- [ ] Dev B: Pull latest from A and C
- [ ] Dev C: Pull latest from A and B
- [ ] Run `npm install` (update lock files if needed)
- [ ] Run `npm test` — all tests pass (entire suite)
- [ ] Run `npm run lint` — clean
- [ ] Run `npm run typecheck` — clean
- [ ] No git conflicts

If conflicts exist:
- Resolve in `packages/shared/src/index.ts` (merge schemas carefully)
- Resolve in `server.ts` (merge route handlers in order: Hotmart, Kiwify, Stripe, PagSeguro)
- Re-run tests after merge

---

## QA Gate (After Implementation)

Each implementation will be reviewed against:

- [ ] Code quality (patterns match PerfectPay example)
- [ ] All unit tests pass
- [ ] PII never stored as plain-text
- [ ] HMAC validation is timing-safe
- [ ] Event IDs are deterministic
- [ ] Dedupe logic works correctly
- [ ] No hardcoded secrets
- [ ] TypeScript types are tight (no `any`)

---

## Dependencies Between Devs

**Can work independently:**
- Dev A (Hotmart)
- Dev B (Kiwify)
- Dev C-1 (Stripe)
- Dev C-2 (PagSeguro)

**Merge point:** `packages/shared/src/index.ts`
- Each dev adds their schema + type
- Coordinate: each dev adds their lines without overwriting others
- After merge: `npm run typecheck` must pass

**Merge point:** `apps/api/src/server.ts`
- Each dev adds their route handler
- Add in order: Hotmart (line X), Kiwify (line X+N), Stripe, PagSeguro
- After merge: `npm test` must pass

---

## Troubleshooting

### "Module not found: @hub/shared"
**Fix:** Did you add exports to `packages/shared/src/index.ts`?

### "Tests failing: 'Invalid signature'"
**Fix:** Are you using `rawBody` (not JSON-stringified body)?

### "TypeScript errors on handler type"
**Fix:** Did you export the `{Gateway}HandlerDeps` type?

### "Git conflict in packages/shared/src/index.ts"
**Fix:** Each dev owns their section. Merge schemas side-by-side (no removal).

### "HMAC mismatch in tests"
**Fix:** Is your `sign()` helper in tests using the same `secret` as the handler expects?

---

## Time Budget

| Task | Time | Notes |
|------|------|-------|
| Schema in shared | 10 min | Parallel (3 devs) |
| Handler implementation | 30 min | Parallel (3 devs) |
| Unit tests | 30 min | Parallel (3 devs) |
| Server integration | 15 min | Sequential (resolve conflicts) |
| Verification | 10 min | Parallel (each dev) |
| **Total per dev** | **~2h** | Includes buffer for context switching |

---

## Definition of Done

For each gateway handler:

- [ ] Handler implementation complete (6-step flow)
- [ ] All unit tests pass (`npm test`)
- [ ] ESLint passes (`npm run lint`)
- [ ] TypeScript passes (`npm run typecheck`)
- [ ] No `any` types in handler or tests
- [ ] No hardcoded secrets
- [ ] PII hashed (SHA256 hex, 64 chars)
- [ ] Event IDs deterministic
- [ ] Dedupe working (constraint violation → isDuplicate)
- [ ] Integrated into `server.ts`
- [ ] Story file updated (checklist marked)
- [ ] Ready for QA gate

---

**Print this checklist.** Check off items as you complete.

**Reference docs:** `WEBHOOK-HANDLER-PATTERN.md`, `WEBHOOK-HANDLER-QUICK-REF.md`, `WEBHOOK-HANDLER-EXAMPLES.md`
