# Webhook Handler — Quick Reference Card

**For:** Hotmart, Kiwify, Stripe, PagSeguro handlers (Story 007)
**Duration:** 5 min read | 3 min reference

---

## The 6-Step Flow (Diagram)

```
Raw HTTP POST with signature
           ↓
    [1] HMAC-SHA256 ✓
           ↓
    [2] Find Tenant ✓
           ↓
    [3] Hash PII (email, phone) → SHA256 hex
           ↓
    [4] Generate eventId = SHA256(tenant|order|type|amount|currency)
           ↓
    [5] Save Identity (emailHash, phoneHash)
           ↓
    [6] Insert Dedupe (prevent duplicate CAPI sends)
           ↓
    { ok: true, eventId, isDuplicate }
```

---

## Code Template (Bare Minimum)

```typescript
// {gateway}-webhook-handler.ts

import crypto from 'node:crypto';
import type { {Gateway}WebhookBody } from '@hub/shared';
import { prisma } from './db.js';

export type {Gateway}HandlerDeps = {
  getSecret?: () => string | undefined;
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createIdentity?: (data: any) => Promise<void>;
  insertDedupe?: (data: any) => Promise<boolean>;
};

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function timingSafeCompare(computed: string, signature: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export async function handle{Gateway}Webhook(
  tenantId: string,
  body: {Gateway}WebhookBody,
  rawBody: string,
  signature: string | undefined,
  deps: {Gateway}HandlerDeps = {}
): Promise<
  | { ok: true; eventId: string; isDuplicate: boolean }
  | { error: 'invalid_signature' | 'tenant_not_found' }
> {
  // 1. Validate HMAC
  const secret = (deps.getSecret ?? (() => process.env.{GATEWAY}_WEBHOOK_SECRET))();
  if (!secret || !signature || !timingSafeCompare(computeHmac(secret, rawBody), signature)) {
    return { error: 'invalid_signature' };
  }

  // 2. Find tenant
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 3. Hash PII
  const emailHash = body.customer?.email
    ? sha256hex(body.customer.email.toLowerCase().trim())
    : undefined;
  const phoneHash = body.customer?.phone
    ? sha256hex(body.customer.phone.replace(/\D/g, ''))
    : undefined;

  // 4. Deterministic event ID
  const eventId = sha256hex(
    `${tenant.id}|{IDENTIFIER_FIELD}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
  );

  // 5. Create identity
  if (emailHash || phoneHash) {
    const createIdentity = deps.createIdentity ?? (async (data) => {
      await prisma.identity.create({ data });
    });
    await createIdentity({ tenantId: tenant.id, emailHash, phoneHash });
  }

  // 6. Dedupe
  const insertDedupe = deps.insertDedupe ?? (async (data) => {
    try {
      await prisma.dedupeRegistry.create({ data });
      return true;
    } catch {
      return false;
    }
  });

  const isNew = await insertDedupe({ tenantId: tenant.id, eventId });
  return { ok: true, eventId, isDuplicate: !isNew };
}
```

**Replace `{...}` with gateway-specific values** ↓

---

## Gateway-Specific Values

| Gateway | Webhook ID Field | Secret Env Var | Signature Header |
|---------|------------------|----------------|------------------|
| Hotmart | `transaction_id` | `HOTMART_WEBHOOK_SECRET` | `X-Hotmart-Signature` |
| Kiwify | `order_id` | `KIWIFY_WEBHOOK_SECRET` | `X-Kiwify-Signature` |
| Stripe | `event_id` (from event) | `STRIPE_WEBHOOK_SECRET` | `Stripe-Signature` |
| PagSeguro | `reference` | `PAGSEGURO_WEBHOOK_SECRET` | `X-PagSeguro-Signature` |

---

## PII Hashing Quick Rules

### Email
```
input:  "Lead@Example.COM  "
norm:   "lead@example.com"   (lowercase + trim)
hash:   "a1b2c3d4..." (SHA256 hex, 64 chars)
store:  "a1b2c3d4..." (NEVER plain text)
```

### Phone
```
input:  "+55 (11) 91234-5678"
norm:   "5511912345678"   (remove all non-digits)
hash:   "e5f6g7h8..." (SHA256 hex, 64 chars)
store:  "e5f6g7h8..." (NEVER plain text)
```

---

## Event ID Formula (Deterministic)

```
eventId = SHA256(
  tenantId           +
  "|" +
  {order_id field}   +
  "|purchase" +
  "|" +
  (amount or "") +
  "|" +
  (currency or "")
)
```

**Result:** Same webhook twice = same eventId = detected as duplicate ✓

---

## Unit Test Checklist

```typescript
✓ Invalid signature (missing, wrong, no secret) → error
✓ Tenant not found → error
✓ PII hashed as hex (not plain-text)
✓ Event ID is deterministic (same input = same ID)
✓ Duplicate detection (isDuplicate: true)
✓ No identity created when email/phone absent
✓ All types match (no `any` types)
```

---

## Fastify Route (server.ts)

```typescript
import { rawBody } from 'fastify-raw-body';
import { {gateway}WebhookSchema } from '@hub/shared';
import { handle{Gateway}Webhook } from './{gateway}-webhook-handler.js';

// Register plugin (FIRST)
await app.register(rawBody, { global: true, runFirst: true });

// Route
app.post('/api/v1/webhooks/{gateway}/:tenantId', async (request, reply) => {
  const { tenantId } = request.params;
  const signature = request.headers['x-{gateway}-signature'];
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = {gateway}WebhookSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

  const result = await handle{Gateway}Webhook(tenantId, parsed.data, rawBody, signature);

  if ('error' in result) {
    if (result.error === 'invalid_signature') return reply.code(401).send({ message: 'Invalid signature.' });
    if (result.error === 'tenant_not_found') return reply.code(404).send({ message: 'Tenant not found.' });
  }

  return reply.code(202).send({ ok: true, eventId: result.eventId });
});
```

---

## DI Pattern (Tests)

```typescript
import { vi } from 'vitest';

const deps = {
  getSecret: () => 'test-secret',
  findTenant: async (id) => ({ id }),
  createIdentity: vi.fn(async () => {}),
  insertDedupe: vi.fn(async () => true),
};

await handle{Gateway}Webhook(tenantId, body, rawBody, signature, deps);
```

**In production:** Omit deps → uses env vars + prisma

---

## Zod Schema (packages/shared/src/index.ts)

```typescript
export const {gateway}WebhookSchema = z.object({
  {IDENTIFIER_FIELD}: z.string().min(1),  // order_id, transaction_id, etc.
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  // ... gateway-specific fields
});

export type {Gateway}WebhookBody = z.infer<typeof {gateway}WebhookSchema>;
```

---

## Common Mistakes → Fixes

| Mistake | Fix |
|---------|-----|
| Computing HMAC on JSON-stringified body | Use `rawBody` (fastify-raw-body plugin) |
| Storing plain-text email | Hash to SHA256 hex before persist |
| Using different normalization each time | Uppercase vs lowercase email = different hash |
| Event ID varies for same webhook | Ensure consistent field extraction + normalization |
| All signatures invalid | Check env var name, rawBody usage, hex format |
| DI mocks not working | Ensure deps are optional (use `?? default`) |

---

## Story Reference

- **Story 007:** Generic webhook receiver (this template)
- **Story 008:** Match engine (uses eventId + identities)
- **Story 009:** SQS dispatch to Meta CAPI (uses dedupe_registry)

---

## Files to Modify

1. **Handler logic:** `apps/api/src/webhooks/{gateway}-webhook-handler.ts`
2. **Handler tests:** `apps/api/src/webhooks/{gateway}-webhook-handler.test.ts`
3. **Shared schema:** `packages/shared/src/index.ts` (add schema + type)
4. **Server routes:** `apps/api/src/server.ts` (add route + import)

---

## Commands to Run Before Commit

```bash
npm test                    # All tests pass
npm run lint               # ESLint clean
npm run typecheck          # TypeScript clean
```

---

**Print this card.** Reference while coding.

For full details: `docs/WEBHOOK-HANDLER-PATTERN.md`
