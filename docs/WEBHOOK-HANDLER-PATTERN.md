# Webhook Handler Pattern — Template for Multi-Gateway Integration

**Status:** Active pattern from `perfectpay-webhook-handler.ts`
**Used by:** Story 007 (Hotmart, Kiwify, Stripe, PagSeguro handlers)
**Last Updated:** 2026-03-02

---

## Quick Overview

Each gateway webhook handler follows this 6-step flow:

1. **HMAC-SHA256 signature validation** (timing-safe)
2. **Tenant verification** (exists in DB)
3. **Hash PII to SHA-256** (email, phone, normalization rules)
4. **Generate deterministic event_id** (SHA-256 of tenant|identifier|type|amount|currency)
5. **Persist identity record** (emailHash, phoneHash)
6. **Upsert dedupe registry** (track processed eventIds to prevent duplicates)

Returns: `{ ok: true; eventId: string; isDuplicate: boolean }` or error.

---

## 1. Dependency Injection Pattern (DI)

All dependencies must be injectable for testability.

```typescript
export type {GatewayName}HandlerDeps = {
  getSecret?: () => string | undefined;
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createIdentity?: (data: IdentityCreateInput) => Promise<void>;
  insertDedupe?: (data: DedupeInsertInput) => Promise<boolean>;
};
```

**In production:** Omit deps parameter → defaults use `process.env` + `prisma`
**In tests:** Inject `vi.fn()` mocks for each dependency

**Example:**
```typescript
await handleHotmartWebhook(tenantId, body, rawBody, signature, {
  getSecret: () => 'test-secret',
  findTenant: async (id) => fakeTenant,
  createIdentity: vi.fn(async () => {}),
  insertDedupe: vi.fn(async () => true),
});
```

---

## 2. HMAC-SHA256 Validation

**Signature header name:** `X-{GATEWAY}-Signature` (case-insensitive on Fastify)

**Validation checklist:**
- Secret missing → return `{ error: 'invalid_signature' }`
- Signature header missing → return `{ error: 'invalid_signature' }`
- Computed HMAC ≠ provided signature → return `{ error: 'invalid_signature' }`
- **Use timing-safe comparison** → prevents timing attacks

**Implementation:**
```typescript
import crypto from 'node:crypto';

function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function timingSafeCompare(computed: string, signature: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false; // Invalid hex format → fail securely
  }
}

// In handler:
const secret = (deps.getSecret ?? (() => process.env.{GATEWAY}_WEBHOOK_SECRET))();
if (!secret || !signature || !timingSafeCompare(computeHmac(secret, rawBody), signature)) {
  return { error: 'invalid_signature' };
}
```

**Key:** Compute HMAC on **raw request body** (before JSON parsing). Fastify's `fastify-raw-body` plugin preserves original formatting.

---

## 3. Tenant Verification

Always verify tenant exists before processing.

```typescript
const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
const tenant = await findTenant(tenantId);
if (!tenant) {
  return { error: 'tenant_not_found' };
}
```

---

## 4. PII Hashing Rules

**CRITICAL:** Never persist plain-text email/phone. LGPD compliance.

### Email Hashing
```typescript
const emailHash = body.customer?.email
  ? sha256hex(body.customer.email.toLowerCase().trim())
  : undefined;
```
- Normalize: **lowercase** + **trim**
- Hash: **SHA-256** → **hex string** (64 chars)
- Result: `a1b2c3d4...` (hex digest, NOT base64)

### Phone Hashing
```typescript
const phoneHash = body.customer?.phone
  ? sha256hex(body.customer.phone.replace(/\D/g, ''))
  : undefined;
```
- Normalize: **remove all non-digits** (`/\D/g` regex)
- Hash: **SHA-256** → **hex string**
- Result: `e5f6g7h8...`

### Other PII Fields (Optional — Story 008+)
If gateway provides additional fields, add to Identity:
- first_name, last_name, date_of_birth
- address_city, address_state, address_country, address_zipcode
- external_id, facebook_login_id

Same rule: **normalize → hash → persist hex only**.

**Hash helper function:**
```typescript
function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
```

---

## 5. Event ID Generation (Deterministic)

Event ID must be **identical for duplicate payloads** from the same gateway event.

Formula:
```
eventId = SHA256(tenantId | orderIdentifier | eventType | amount | currency)
```

**Example (PerfectPay):**
```typescript
const eventId = sha256hex(
  `${tenant.id}|${body.order_id}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
);
```

**Why this works:**
- Same input → same hash (deterministic)
- Different tenant → different hash (tenant-scoped)
- Missing fields (amount/currency) → use empty string (consistent)

**For other gateways:**
- **Hotmart:** `tenantId|transaction_id|purchase|amount|currency`
- **Kiwify:** `tenantId|order_id|purchase|amount|currency`
- **Stripe:** `tenantId|event_id|charge.succeeded|amount|currency` (event_id is unique per charge)
- **PagSeguro:** `tenantId|reference|purchase|amount|currency`

---

## 6. Identity Persistence

Create an Identity record (only if email or phone present).

```typescript
if (emailHash || phoneHash) {
  const createIdentity =
    deps.createIdentity ??
    (async (data) => {
      await prisma.identity.create({ data });
    });

  await createIdentity({
    tenantId: tenant.id,
    emailHash,
    phoneHash,
    // Optional fields (Story 008+):
    // firstNameHash, lastNameHash, dobHash, etc.
  });
}
```

**Note:** Do NOT deduplicate identities here. Multiple webhook events can create multiple Identity records for the same tenant/email pair. The match engine (Story 008) handles collision resolution.

---

## 7. Dedupe Logic

Insert into `dedupe_registry` to prevent duplicate CAPI sends.

```typescript
const insertDedupe =
  deps.insertDedupe ??
  (async (data) => {
    try {
      await prisma.dedupeRegistry.create({ data });
      return true; // First time seeing this eventId
    } catch {
      return false; // Unique constraint violated = duplicate
    }
  });

const isNew = await insertDedupe({ tenantId: tenant.id, eventId });

return { ok: true, eventId, isDuplicate: !isNew };
```

**Constraints:**
- `dedupeRegistry` has unique constraint on `(tenantId, eventId)`
- INSERT fails if `(tenantId, eventId)` already exists → catch, return false
- Caller receives `isDuplicate: true` → can log/skip dispatch

---

## 8. Fastify Route Integration

In `server.ts`:

```typescript
import { rawBody } from 'fastify-raw-body';

// Register raw body plugin FIRST (global: true)
await app.register(rawBody, { global: true, runFirst: true });

// Route handler
app.post('/api/v1/webhooks/{gateway}/:tenantId', async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const signature = request.headers['x-{gateway}-signature'] as string | undefined;
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = {gateway}WebhookSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(parsed.error.flatten());
  }

  const result = await handle{Gateway}Webhook(tenantId, parsed.data, rawBody, signature);

  if ('error' in result) {
    if (result.error === 'invalid_signature') {
      return reply.code(401).send({ message: 'Invalid signature.' });
    }
    if (result.error === 'tenant_not_found') {
      return reply.code(404).send({ message: 'Tenant not found.' });
    }
  }

  return reply.code(202).send({ ok: true, eventId: result.eventId });
});
```

---

## 9. Zod Schema (packages/shared/src/index.ts)

Define each gateway's webhook body schema once, reuse everywhere.

```typescript
export const hotmartWebhookSchema = z.object({
  transaction_id: z.string().min(1),
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    // ... other fields
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  // ... provider-specific fields
});

export type HotmartWebhookBody = z.infer<typeof hotmartWebhookSchema>;
```

**Pattern:**
1. Define schema in `packages/shared`
2. Export type for handler usage
3. Validate in route handler before calling handler function
4. Handler receives already-validated parsed.data

---

## 10. Test Template

```typescript
import crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));
import { handle{Gateway}Webhook } from './{gateway}-webhook-handler.js';

const SECRET = 'test-secret-key';
const TENANT_ID = 'tenant-abc';

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

const validBody = {
  // ... gateway-specific required fields
  customer: { email: 'test@example.com', phone: '+55 11 91234-5678' },
  amount: 197,
  currency: 'BRL',
};
const rawBody = JSON.stringify(validBody);
const validSig = sign(rawBody);

describe('handle{Gateway}Webhook', () => {
  it('validates HMAC signature (missing, wrong, or no secret)', async () => {
    expect(await handle{Gateway}Webhook(TENANT_ID, validBody, rawBody, undefined, {}))
      .toEqual({ error: 'invalid_signature' });
  });

  it('validates tenant exists', async () => {
    expect(await handle{Gateway}Webhook('fake-tenant', validBody, rawBody, validSig, {
      getSecret: () => SECRET,
      findTenant: async () => null,
    })).toEqual({ error: 'tenant_not_found' });
  });

  it('hashes PII as SHA256 hex (64 chars, never plain-text)', async () => {
    const createIdentity = vi.fn(async () => {});
    await handle{Gateway}Webhook(TENANT_ID, validBody, rawBody, validSig, {
      getSecret: () => SECRET,
      findTenant: async () => ({ id: TENANT_ID }),
      createIdentity,
      insertDedupe: async () => true,
    });

    const call = createIdentity.mock.calls[0]?.[0];
    expect(call?.emailHash).toMatch(/^[a-f0-9]{64}$/); // 64-char hex, not plain
    expect(call?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates deterministic eventId for same inputs', async () => {
    const eventIds = [];
    for (let i = 0; i < 2; i++) {
      const r = await handle{Gateway}Webhook(TENANT_ID, validBody, rawBody, validSig, {
        getSecret: () => SECRET,
        findTenant: async () => ({ id: TENANT_ID }),
        createIdentity: vi.fn(),
        insertDedupe: async () => true,
      });
      if ('ok' in r) eventIds.push(r.eventId);
    }
    expect(eventIds[0]).toBe(eventIds[1]); // Must be identical
  });

  it('detects duplicate eventId (isDuplicate: true)', async () => {
    const r = await handle{Gateway}Webhook(TENANT_ID, validBody, rawBody, validSig, {
      getSecret: () => SECRET,
      findTenant: async () => ({ id: TENANT_ID }),
      createIdentity: vi.fn(),
      insertDedupe: async () => false, // Second call to same eventId
    });
    expect(r).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('skips identity creation when no email/phone', async () => {
    const createIdentity = vi.fn();
    await handle{Gateway}Webhook(TENANT_ID, { ...validBody, customer: {} },
      JSON.stringify({ ...validBody, customer: {} }), validSig, {
      getSecret: () => SECRET,
      findTenant: async () => ({ id: TENANT_ID }),
      createIdentity,
      insertDedupe: async () => true,
    });
    expect(createIdentity).not.toHaveBeenCalled();
  });
});
```

---

## 11. File Structure Checklist

For each gateway (Hotmart, Kiwify, Stripe, PagSeguro):

```
apps/api/src/webhooks/
├── {gateway}-webhook-handler.ts       (handler logic)
├── {gateway}-webhook-handler.test.ts  (unit tests)
└── {gateway}-adapter.ts                (Fastify route + schema import)
```

---

## 12. Key Decisions (Why This Pattern?)

| Decision | Reason |
|----------|--------|
| **DI pattern** | Testability + decoupling from Prisma |
| **Timing-safe compare** | Security: prevent timing attacks on signature |
| **SHA256 hashing** | Fast, cryptographically secure, matches Meta CAPI's FA hashing |
| **Hex encoding** | Standard for cryptographic digests; easier to debug than base64 |
| **Deterministic eventId** | Same webhook twice = same eventId = idempotent (no dupe sends) |
| **Hash before persist** | LGPD: never store plain-text PII |
| **Dedupe in handler** | First-line defense; match engine is second defense (Story 008) |
| **rawBody for HMAC** | JSON formatting can vary; must use original bytes |
| **202 Accepted** | Async processing; dedupe + matching happen later (Stories 008+) |

---

## 13. Common Gotchas

### Gotcha #1: Signature Mismatch
**Symptom:** All webhooks return `invalid_signature`
**Check:**
- Is `fastify-raw-body` registered with `global: true`?
- Are you computing HMAC on `rawBody`, not stringified JSON?
- Is the secret from correct environment variable?
- Does gateway sign with plain body or JSON + newline?

### Gotcha #2: PII in Logs
**Symptom:** Plain-text email in logs
**Fix:** Never log `body.customer.email` directly. Log hashes only:
```typescript
app.log.info({ emailHash, eventId }, 'Identity created');
```

### Gotcha #3: Dedupe Constraint Violation
**Symptom:** Error on dedupe insert
**Expected:** Try-catch returns `false` → isDuplicate: true (not an error). If you see stack trace, check unique constraint definition.

### Gotcha #4: Event ID Varies
**Symptom:** Same webhook twice → different eventIds
**Check:** Are you using consistent field normalization? (e.g., always lowercase email, always strip non-digits from phone?)

---

## 14. Implementation Checklist (Per Developer)

- [ ] Implement `{gateway}-webhook-handler.ts`
  - [ ] Export type `{Gateway}HandlerDeps`
  - [ ] Implement HMAC validation
  - [ ] Implement tenant check
  - [ ] Implement PII hashing (email, phone)
  - [ ] Implement deterministic eventId
  - [ ] Implement identity creation
  - [ ] Implement dedupe insert
  - [ ] Return signature: `{ ok: true; eventId; isDuplicate }` or error

- [ ] Write tests in `{gateway}-webhook-handler.test.ts`
  - [ ] Test signature validation (missing, wrong, no secret)
  - [ ] Test tenant not found
  - [ ] Test PII hashing (hex format, no plain-text)
  - [ ] Test eventId determinism
  - [ ] Test duplicate detection
  - [ ] Test skip identity when no email/phone

- [ ] Add Zod schema to `packages/shared/src/index.ts`
  - [ ] Export `{gateway}WebhookSchema`
  - [ ] Export `{Gateway}WebhookBody` type

- [ ] Integrate into `server.ts`
  - [ ] Add route handler `/api/v1/webhooks/{gateway}/:tenantId`
  - [ ] Validate with schema
  - [ ] Call handler function
  - [ ] Return 401/404/202 appropriately

- [ ] Test end-to-end
  - [ ] `npm test` passes (unit tests)
  - [ ] `npm run lint` passes
  - [ ] `npm run typecheck` passes

---

## File References

- **Live example:** `/Users/guilhermesimas/Documents/hub-server-side-tracking/apps/api/src/perfectpay-webhook-handler.ts`
- **Live tests:** `/Users/guilhermesimas/Documents/hub-server-side-tracking/apps/api/src/perfectpay-webhook-handler.test.ts`
- **Schemas:** `/Users/guilhermesimas/Documents/hub-server-side-tracking/packages/shared/src/index.ts`
- **Server integration:** `/Users/guilhermesimas/Documents/hub-server-side-tracking/apps/api/src/server.ts` (lines 180–204)

---

**Last Updated:** 2026-03-02
**Pattern Version:** 1.0 (Active)
**Related Stories:** 007, 008, 009
**Maintainer:** @dev (Dex)
