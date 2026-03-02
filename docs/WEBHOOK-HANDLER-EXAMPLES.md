# Webhook Handler — Gateway-Specific Examples

**For:** Developers implementing Hotmart, Kiwify, Stripe, PagSeguro
**Last Updated:** 2026-03-02

---

## Hotmart

### Event ID Formula

```typescript
const eventId = sha256hex(
  `${tenant.id}|${body.transaction_id}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
);
```

### Payload Example

```json
{
  "transaction_id": "TX-1234567890",
  "customer": {
    "email": "buyer@example.com",
    "phone": "+55 11 91234-5678",
    "name": "João Silva",
    "document": "123.456.789-00"
  },
  "amount": 149.90,
  "currency": "BRL",
  "status": "completed",
  "event_time": "2026-03-02T14:30:00Z",
  "product_id": "PROD-001"
}
```

### Signature Header

```
X-Hotmart-Signature: a1b2c3d4e5f6... (SHA256 hex)
```

### Env Var

```
HOTMART_WEBHOOK_SECRET=sk_hotmart_xxxxx
```

### Zod Schema

```typescript
export const hotmartWebhookSchema = z.object({
  transaction_id: z.string().min(1),
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    document: z.string().optional(),
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  event_time: z.string().optional(),
  product_id: z.string().optional(),
});

export type HotmartWebhookBody = z.infer<typeof hotmartWebhookSchema>;
```

### Server Route

```typescript
app.post('/api/v1/webhooks/hotmart/:tenantId', async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const signature = request.headers['x-hotmart-signature'] as string | undefined;
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = hotmartWebhookSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(parsed.error.flatten());
  }

  const result = await handleHotmartWebhook(tenantId, parsed.data, rawBody, signature);

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

## Kiwify

### Event ID Formula

```typescript
const eventId = sha256hex(
  `${tenant.id}|${body.order_id}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
);
```

### Payload Example

```json
{
  "order_id": "ORD-9876543210",
  "customer": {
    "email": "cliente@example.com",
    "phone": "11991234567",
    "first_name": "Maria",
    "last_name": "Santos"
  },
  "amount": 199.00,
  "currency": "BRL",
  "status": "approved",
  "product_id": "PROD-KIW-001",
  "created_at": "2026-03-02T14:30:00Z"
}
```

### Signature Header

```
X-Kiwify-Signature: e5f6g7h8i9j0... (SHA256 hex)
```

### Env Var

```
KIWIFY_WEBHOOK_SECRET=sk_kiwify_xxxxx
```

### Zod Schema

```typescript
export const kiwifyWebhookSchema = z.object({
  order_id: z.string().min(1),
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  product_id: z.string().optional(),
  created_at: z.string().optional(),
});

export type KiwifyWebhookBody = z.infer<typeof kiwifyWebhookSchema>;
```

### Server Route

```typescript
app.post('/api/v1/webhooks/kiwify/:tenantId', async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const signature = request.headers['x-kiwify-signature'] as string | undefined;
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = kiwifyWebhookSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(parsed.error.flatten());
  }

  const result = await handleKiwifyWebhook(tenantId, parsed.data, rawBody, signature);

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

## Stripe

### Event ID Formula

**Note:** Stripe sends events, not payments directly. The `event_id` is globally unique per event (e.g., `evt_123abc`). Charges have their own ID (e.g., `ch_123abc`).

```typescript
// Option 1: Use event ID (recommended — guaranteed unique per event)
const eventId = sha256hex(
  `${tenant.id}|${body.event_id}|charge.succeeded|${body.amount ?? ''}|${body.currency ?? ''}`
);

// Option 2: Use charge ID (if you only care about charges)
const eventId = sha256hex(
  `${tenant.id}|${body.charge_id ?? body.event_id}|charge|${body.amount ?? ''}|${body.currency ?? ''}`
);
```

**Use Option 1** → Stripe guarantees event_id uniqueness; you handle retries correctly.

### Payload Example (charge.succeeded event)

```json
{
  "event_id": "evt_1234567890",
  "event_type": "charge.succeeded",
  "created_at": 1709380200,
  "charge_id": "ch_1234567890",
  "amount": 19900,
  "currency": "usd",
  "receipt_email": "customer@example.com",
  "customer": {
    "id": "cus_1234567890",
    "email": "customer@example.com",
    "phone": "+14155552671",
    "name": "John Doe"
  },
  "metadata": {
    "order_id": "external-order-001"
  }
}
```

### Signature Header

**Stripe uses a different format:** `t=timestamp,v1=hash[,v0=...]`

You must:
1. Extract timestamp `t`
2. Verify timestamp not too old (< 5 min)
3. Compute HMAC: `timestamp.payload`
4. Compare against `v1` value (timing-safe)

```typescript
// Stripe signature validation
function validateStripeSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const expectedHash = parts.find(p => p.startsWith('v1='))?.slice(3);

  if (!timestamp || !expectedHash) return false;

  // Check timestamp freshness (< 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false; // Replay attack prevention
  }

  // Compute HMAC
  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  return timingSafeCompare(computed, expectedHash);
}
```

### Env Var

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxx (from Stripe dashboard)
```

### Zod Schema

```typescript
export const stripeWebhookSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  created_at: z.number().optional(),
  charge_id: z.string().optional(),
  amount: z.number().optional(),  // In cents (e.g., 19900 = $199.00)
  currency: z.string().optional(),
  receipt_email: z.string().optional(),
  customer: z.object({
    id: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  metadata: z.object({
    order_id: z.string().optional(),
  }).optional(),
});

export type StripeWebhookBody = z.infer<typeof stripeWebhookSchema>;
```

### Server Route

```typescript
app.post('/api/v1/webhooks/stripe/:tenantId', async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const signature = request.headers['stripe-signature'] as string | undefined;
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = stripeWebhookSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(parsed.error.flatten());
  }

  const result = await handleStripeWebhook(tenantId, parsed.data, rawBody, signature);

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

## PagSeguro

### Event ID Formula

```typescript
const eventId = sha256hex(
  `${tenant.id}|${body.reference}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
);
```

### Payload Example

```json
{
  "reference": "REF-PG-0001234567",
  "buyer": {
    "email": "comprador@example.com",
    "phone": "11912345678",
    "name": "Carlos Oliveira",
    "document": "12345678901"
  },
  "amount": 279.90,
  "currency": "BRL",
  "status": "paid",
  "transaction_id": "TXN-PG-1234567890",
  "created_at": "2026-03-02T14:30:00Z"
}
```

### Signature Header

```
X-PagSeguro-Signature: i9j0k1l2m3n4... (SHA256 hex)
```

### Env Var

```
PAGSEGURO_WEBHOOK_SECRET=sk_pagseguro_xxxxx
```

### Zod Schema

```typescript
export const pagseguroWebhookSchema = z.object({
  reference: z.string().min(1),
  buyer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    document: z.string().optional(),
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  transaction_id: z.string().optional(),
  created_at: z.string().optional(),
});

export type PagSeguroWebhookBody = z.infer<typeof pagseguroWebhookSchema>;
```

### Server Route

```typescript
app.post('/api/v1/webhooks/pagseguro/:tenantId', async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  const signature = request.headers['x-pagseguro-signature'] as string | undefined;
  const rawBody = (request as { rawBody: string }).rawBody;

  const parsed = pagseguroWebhookSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(parsed.error.flatten());
  }

  const result = await handlePagSeguroWebhook(tenantId, parsed.data, rawBody, signature);

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

## Comparison Table

| Aspect | Hotmart | Kiwify | Stripe | PagSeguro |
|--------|---------|--------|--------|-----------|
| **Order ID Field** | `transaction_id` | `order_id` | `event_id` | `reference` |
| **Signature Header** | `X-Hotmart-Signature` | `X-Kiwify-Signature` | `Stripe-Signature` | `X-PagSeguro-Signature` |
| **Signature Format** | SHA256 hex | SHA256 hex | `t=...,v1=...` (special) | SHA256 hex |
| **Email Field Path** | `customer.email` | `customer.email` | `customer.email` | `buyer.email` |
| **Phone Field Path** | `customer.phone` | `customer.phone` | `customer.phone` | `buyer.phone` |
| **Amount Field** | decimal (BRL) | decimal (BRL) | integer (cents) | decimal (BRL) |
| **Timestamp Field** | `event_time` (ISO) | `created_at` (ISO) | `created_at` (Unix) | `created_at` (ISO) |

---

## Testing Against Real Webhooks (Local)

### 1. Use Webhook.cool or similar

```bash
# Get unique webhook URL
https://webhook.cool/UNIQUE-ID

# Set in gateway admin dashboard
# Use: https://YOUR-TUNNEL-URL/api/v1/webhooks/{gateway}/TENANT_ID
```

### 2. Tunnel to localhost (ngrok)

```bash
ngrok http 3001
# Returns: https://abc123.ngrok.io

# Update gateway webhook URL to:
# https://abc123.ngrok.io/api/v1/webhooks/hotmart/tenant-xyz
```

### 3. Verify signature locally

```typescript
// Add debug logging
console.log('Raw body:', rawBody);
console.log('Signature:', signature);
console.log('Secret:', process.env.HOTMART_WEBHOOK_SECRET);
console.log('Computed:', computeHmac(secret, rawBody));
```

### 4. Check dedupe works

```bash
# Send same webhook twice
# First: isDuplicate: false
# Second: isDuplicate: true
```

---

## Files to Create (Per Gateway)

```
apps/api/src/webhooks/
├── hotmart-webhook-handler.ts
├── hotmart-webhook-handler.test.ts
├── kiwify-webhook-handler.ts
├── kiwify-webhook-handler.test.ts
├── stripe-webhook-handler.ts
├── stripe-webhook-handler.test.ts
├── pagseguro-webhook-handler.ts
└── pagseguro-webhook-handler.test.ts
```

---

## Key Differences from PerfectPay

| Aspect | PerfectPay | Others |
|--------|-----------|--------|
| **Email path** | `customer.email` | Same ✓ |
| **Phone path** | `customer.phone` | Same ✓ |
| **HMAC method** | Standard SHA256 | Hotmart/Kiwify/PagSeguro same; **Stripe different** |
| **Order ID field** | `order_id` | Hotmart: `transaction_id`, Kiwify: `order_id`, Stripe: `event_id`, PagSeguro: `reference` |

---

## Stripe-Specific Gotchas

### Gotcha 1: Amount in Cents
```typescript
// Stripe sends 19900 = $199.00
// Store as-is (don't divide by 100 yet)
const amountInCents = body.amount;  // 19900
const amountInDollars = amountInCents / 100;  // 199.00
```

### Gotcha 2: Signature Format
```
Wrong:  X-Stripe-Signature: a1b2c3d4...  ❌
Right:  Stripe-Signature: t=1234567890,v1=a1b2c3d4...  ✓
```

### Gotcha 3: Timestamp Validation
```typescript
// Stripe replays old events on webhook retries
// Validate timestamp < 5 minutes old
// Prevents using stale events
```

---

## Common Test Cases (All Gateways)

```typescript
describe('Webhook signature', () => {
  it('returns invalid_signature when signature missing', async () => {
    const result = await handle{Gateway}Webhook(tenantId, body, rawBody, undefined);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('returns invalid_signature when signature wrong', async () => {
    const result = await handle{Gateway}Webhook(tenantId, body, rawBody, 'wrong-sig');
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('returns invalid_signature when secret not configured', async () => {
    const result = await handle{Gateway}Webhook(tenantId, body, rawBody, validSig, {
      getSecret: () => undefined,
      findTenant: async () => ({ id: tenantId }),
    });
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('returns tenant_not_found when tenant does not exist', async () => {
    const result = await handle{Gateway}Webhook('fake-tenant', body, rawBody, validSig, {
      getSecret: () => 'secret',
      findTenant: async () => null,
    });
    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('creates identity with hashed PII', async () => {
    const createIdentity = vi.fn();
    await handle{Gateway}Webhook(tenantId, body, rawBody, validSig, {
      getSecret: () => 'secret',
      findTenant: async () => ({ id: tenantId }),
      createIdentity,
      insertDedupe: async () => true,
    });

    expect(createIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        phoneHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
  });

  it('detects duplicate eventId', async () => {
    const result = await handle{Gateway}Webhook(tenantId, body, rawBody, validSig, {
      getSecret: () => 'secret',
      findTenant: async () => ({ id: tenantId }),
      createIdentity: async () => {},
      insertDedupe: async () => false, // Second call
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('generates deterministic eventId', async () => {
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const r = await handle{Gateway}Webhook(tenantId, body, rawBody, validSig, {
        getSecret: () => 'secret',
        findTenant: async () => ({ id: tenantId }),
        createIdentity: async () => {},
        insertDedupe: async () => true,
      });
      if ('ok' in r) ids.push(r.eventId);
    }
    expect(ids[0]).toBe(ids[1]);
  });
});
```

---

**Reference:** `docs/WEBHOOK-HANDLER-PATTERN.md` for full template.
