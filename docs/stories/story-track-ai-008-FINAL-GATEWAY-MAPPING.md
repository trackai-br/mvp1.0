# Story 008 — FINAL Gateway Data Mapping (All 15 Meta CAPI Parameters)

**Agent:** Dara (@data-engineer)
**Status:** ✅ COMPLETE — Ready for Implementation
**Date:** 2026-02-21

---

## 📊 Complete Gateway Mapping (15 Meta CAPI Parameters)

### Master Table

| Meta CAPI Parameter | Hotmart | Kiwify | Stripe | PagSeguro | PerfectPay | Hash? |
|---|---|---|---|---|---|---|
| **FBC** | ⚠️ Custom | ✅ | ✅ | ❌ | ❌ | NO |
| **FBP** | ⚠️ Custom | ✅ | ✅ | ❌ | ❌ | NO |
| **Email** | ✅ Optional | ✅ Conditional | ✅ Via customer_id | ✅ | ✅ | YES |
| **Phone** | ✅ Optional | ✅ Conditional | ❌ | ✅ | ✅ | YES |
| **First Name** | ✅ Optional | ✅ Conditional | ❌ | ✅ | ✅ | YES |
| **Last Name** | ✅ Optional | ✅ Conditional | ❌ | ✅ | ✅ | YES |
| **Date of Birth** | ❌ | ❌ | ❌ | ❌ | ✅ | YES |
| **City** | ✅ Optional | ❌ | ❌ | ✅ | ❌ | YES |
| **State** | ✅ Optional | ❌ | ❌ | ✅ | ❌ | YES |
| **Country** | ✅ Optional | ❌ | ❌ | ✅ | ❌ | NO |
| **ZIP Code** | ✅ Optional | ❌ | ❌ | ✅ | ❌ | YES |
| **External ID** | ✅ (purchase_id) | ✅ (order_id) | ✅ (charge_id) | ✅ (reference) | ✅ (transaction_id) | YES |
| **Facebook Login ID** | ❌ | ❌ | ❌ | ❌ | ❌ | YES |
| **IP Address** | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | NO |
| **User-Agent** | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | ❌ (from Click) | NO |

---

## 🔧 Detailed Payload Examples

### HOTMART Webhook → Conversion Fields

**Webhook Source:**
```json
{
  "event": "purchase_approved",
  "data": {
    "purchase": {
      "id": "12345",
      "status": "approved",
      "price": "99.99",
      "currency_code": "BRL"
    },
    "buyer": {
      "name": "João Silva",
      "email": "joao@example.com",
      "phone": "+5511987654321",
      "city": "São Paulo",
      "state": "SP",
      "country": "BR",
      "zipcode": "01310100"
    },
    "custom_fields": {
      "fbc": "fb.1.123456.abc123",
      "fbp": "fb.1.987654.def456"
    }
  }
}
```

**→ Conversion (extracted + hashed):**
```typescript
{
  gateway: 'hotmart',
  gatewayEventId: '12345',
  amount: 99.99,
  currency: 'BRL',
  fbc: 'fb.1.123456.abc123',
  fbp: 'fb.1.987654.def456',
  firstNameHash: hash('João'),
  lastNameHash: hash('Silva'),
  emailHash: hash('joao@example.com'),
  phoneHash: hash('+5511987654321'),
  cityHash: hash('São Paulo'),
  stateHash: hash('SP'),
  countryCode: 'BR',
  zipCodeHash: hash('01310100'),
  externalIdHash: hash('12345'),  // purchase_id
}
```

**Data Availability:** 80-90% (optional fields may be empty)

---

### KIWIFY Webhook → Conversion Fields

**Webhook Source:**
```json
{
  "event": "compra_aprovada",
  "data": {
    "id": "order_54321",
    "status": "confirmed",
    "total": "199.99",
    "currency": "BRL",
    "customer": {
      "name": "Maria Santos",
      "email": "maria@example.com",
      "phone": "+5521999887766"
    },
    "custom_fields": {
      "fbc": "fb.1.567890.xyz789",
      "fbp": "fb.1.456789.uvw567"
    }
  }
}
```

**→ Conversion (extracted + hashed):**
```typescript
{
  gateway: 'kiwify',
  gatewayEventId: 'order_54321',
  amount: 199.99,
  currency: 'BRL',
  fbc: 'fb.1.567890.xyz789',
  fbp: 'fb.1.456789.uvw567',
  firstNameHash: hash('Maria'),
  lastNameHash: hash('Santos'),
  emailHash: hash('maria@example.com'),
  phoneHash: hash('+5521999887766'),
  externalIdHash: hash('order_54321'),
  // Address fields NOT available
}
```

**Data Availability:** 50-70% (conditional on customer sharing settings)
**Note:** Kiwify allows product owner to hide buyer data — fallback graceful

---

### STRIPE charge.succeeded → Conversion Fields

**Webhook Source:**
```json
{
  "type": "charge.succeeded",
  "data": {
    "object": {
      "id": "ch_123abc456def",
      "amount": 19999,
      "currency": "brl",
      "customer": "cus_xyz789",
      "metadata": {
        "fbc": "fb.1.999111.abc999",
        "fbp": "fb.1.888222.def888"
      }
    }
  }
}
```

**→ Conversion (extracted + hashed):**
```typescript
{
  gateway: 'stripe',
  gatewayEventId: 'ch_123abc456def',
  amount: 199.99,  // stripe sends in cents (divide by 100)
  currency: 'BRL',
  fbc: 'fb.1.999111.abc999',
  fbp: 'fb.1.888222.def888',
  externalIdHash: hash('cus_xyz789'),  // customer_id
  // Contact/address data NOT available from Stripe
  // Must be in Click or other source
}
```

**Data Availability:** 30-40% (Meta IDs + external ID only)
**Note:** Stripe doesn't send PII in webhook (privacy) — must correlate with Click table

---

### PAGSEGURO transação → Conversion Fields

**Webhook Source:**
```json
{
  "reference": "tx_98765",
  "status": "3",
  "grossAmount": "299.99",
  "sender": {
    "name": "Roberto Costa",
    "email": "roberto@example.com",
    "phone": {
      "areaCode": "11",
      "number": "98765432"
    }
  },
  "shipping": {
    "address": {
      "city": "Rio de Janeiro",
      "state": "RJ",
      "country": "BR",
      "postalCode": "20040020"
    }
  }
}
```

**→ Conversion (extracted + hashed):**
```typescript
{
  gateway: 'pagseguro',
  gatewayEventId: 'tx_98765',
  amount: 299.99,
  currency: 'BRL',  // PagSeguro default
  firstNameHash: hash('Roberto'),
  lastNameHash: hash('Costa'),
  emailHash: hash('roberto@example.com'),
  phoneHash: hash('+5511987654320'),  // area_code + number
  cityHash: hash('Rio de Janeiro'),
  stateHash: hash('RJ'),
  countryCode: 'BR',
  zipCodeHash: hash('20040020'),
  externalIdHash: hash('tx_98765'),  // reference
  // FBC, FBP NOT available from PagSeguro
}
```

**Data Availability:** 90%+ (full address + contact)
**Note:** PagSeguro is most complete for address data

---

### PERFECTPAY transação → Conversion Fields

**Webhook Source:**
```json
{
  "event": "purchase_approved",
  "data": {
    "transaction": {
      "id": "perf_123456",
      "status": "approved",
      "amount": "149.99",
      "currency": "BRL"
    },
    "customer": {
      "full_name": "Ana Paula Oliveira",
      "email": "ana@example.com",
      "phone_area_code": "21",
      "phone_number": "987654321",
      "identification_type": "CPF",
      "identification_number": "12345678901",
      "birthday": "1992-05-15",
      "customer_type_enum": "individual"
    }
  }
}
```

**→ Conversion (extracted + hashed):**
```typescript
{
  gateway: 'perfectpay',
  gatewayEventId: 'perf_123456',
  amount: 149.99,
  currency: 'BRL',
  firstNameHash: hash('Ana'),
  lastNameHash: hash('Paula Oliveira'),
  emailHash: hash('ana@example.com'),
  phoneHash: hash('+5521987654321'),  // area_code + number
  dateOfBirthHash: hash('19920515'),  // YYYYMMDD format
  externalIdHash: hash('perf_123456'),  // transaction_id
  // Address fields NOT available (only CPF sent)
}
```

**Data Availability:** 70-80% (contact + birthdate, no address)
**Note:** Unique — includes date of birth! Only PerfectPay has this

---

## 🎯 Data Completeness by Gateway

### Match Rate Prediction

| Gateway | FBC/FBP | Contact | Address | Overall Coverage |
|---------|---------|---------|---------|-------------------|
| **Hotmart** | 20-30% | 60-70% | 30-40% | **70-80%** |
| **Kiwify** | 40-50% | 40-50% | 0% | **50-70%** |
| **Stripe** | 60-70% | 5-10% | 0% | **30-40%** |
| **PagSeguro** | 0% | 95%+ | 95%+ | **90%+** |
| **PerfectPay** | 0% | 95%+ | 0% | **70-80%** |

**Conclusion:**
- PagSeguro = Richest dataset (full address)
- PerfectPay = Only source of birthdate
- Stripe = Best for FBC/FBP (Meta IDs)
- Hotmart/Kiwify = Balanced but optional

---

## 📝 Implementation Strategy

### Story 007 (Adapters) Updates

Each adapter must:

1. **Parse gateway webhook**
2. **Extract 15 fields** (or NULL if not available)
3. **Store WebhookRaw** (original JSON)
4. **Normalize to Conversion structure**
5. **Enqueue to SQS ingest-conversions**

**Example: PerfectPay adapter (NEW)**

```typescript
// Already exists in apps/api/src/perfectpay-webhook-handler.ts
// REFACTOR to extract 15 fields:

class PerfectPayAdapter implements WebhookAdapter {
  validateSignature(rawBody, signature, secret) {
    // ✅ Already implemented (HMAC-SHA256)
  }

  parseEvent(body): NormalizedWebhookEvent {
    const customer = body.data.customer;
    const transaction = body.data.transaction;

    return {
      gateway: 'perfectpay',
      eventId: transaction.id,
      eventType: body.event,
      amount: transaction.amount,
      currency: transaction.currency || 'BRL',
      // 15 fields
      fbc: body.data.custom_fields?.fbc || null,
      fbp: body.data.custom_fields?.fbp || null,
      customerEmail: customer.email,
      customerPhone: `${customer.phone_area_code}${customer.phone_number}`,
      customerFirstName: customer.full_name?.split(' ')[0],
      customerLastName: customer.full_name?.split(' ').slice(1).join(' '),
      customerDateOfBirth: customer.birthday,  // YYYY-MM-DD
      customerCity: null,  // Not available
      customerState: null,  // Not available
      customerCountry: null,  // Not available (assume BR)
      customerZipCode: null,  // Not available
      externalId: transaction.id,
      facebookLoginId: null,  // Not available
      rawPayload: body,
    };
  }
}
```

---

### Story 008 (Match Engine)

1. **Receive** normalized event from SQS
2. **Hash all PII** (email, phone, name, etc) with SHA-256
3. **Match FBC → FBP** against Click table (72h window)
4. **Create Conversion** record with hashes + matched Click link
5. **Create MatchLog** audit record
6. **Enqueue to SQS capi-dispatch** (Story 009)

---

### Story 009 (Dispatch to Meta)

1. **Read Conversion** (hashed PII + matched Click data)
2. **Read WebhookRaw** (original payload for context/validation)
3. **Build Meta Conversions API payload:**
   ```json
   {
     "data": [{
       "value": 149.99,
       "currency": "BRL",
       "user_data": {
         "em": "emailHash (SHA-256)",
         "ph": "phoneHash (SHA-256)",
         "fn": "firstNameHash (SHA-256)",
         "ln": "lastNameHash (SHA-256)",
         "db": "dateOfBirthHash (SHA-256)",
         "ct": "cityHash (SHA-256)",
         "st": "stateHash (SHA-256)",
         "zp": "zipCodeHash (SHA-256)",
         "country": "BR (NO hash)",
         "external_id": "externalIdHash (SHA-256)",
         "client_ip_address": "192.168.1.1 (from Click)",
         "client_user_agent": "Mozilla/5.0... (from Click)",
         "fbc": "fb.1.123.abc (NO hash)",
         "fbp": "fb.1.987.def (NO hash)"
       },
       "content_name": "Product name",
       "content_type": "product",
       "action_source": "website"
     }],
     "test_event_code": "TEST_EVENT_CODE"  // for validation
   }
   ```
4. **Send to Meta** (`POST https://graph.facebook.com/v19.0/{pixel_id}/events`)
5. **Log response** in Conversion.capiResponse

---

## 🔐 PII Hashing Implementation

**All personal data MUST be hashed BEFORE storage:**

```typescript
import crypto from 'crypto';

function hashPII(value: string | null | undefined): string | null {
  if (!value) return null;

  return crypto
    .createHash('sha256')
    .update(value.toLowerCase().trim())
    .digest('hex');
}

// During Match Engine:
const conversion = {
  emailHash: hashPII('customer@example.com'),
  phoneHash: hashPII('+5511987654321'),
  firstNameHash: hashPII('João'),
  lastNameHash: hashPII('Silva'),
  dateOfBirthHash: hashPII('19900101'),  // YYYYMMDD
  cityHash: hashPII('São Paulo'),
  stateHash: hashPII('SP'),
  zipCodeHash: hashPII('01310100'),
  countryCode: 'BR',  // NO hash
  externalIdHash: hashPII('purchase_id_123'),
  fbc: 'fb.1.123.abc',  // NO hash (Meta ID)
  fbp: 'fb.1.987.def',  // NO hash (Meta ID)
  clientIp: '192.168.1.1',  // NO hash
  userAgent: 'Mozilla/5.0...',  // NO hash
};
```

---

## ✅ Checklist Before Implementation

- [ ] @architect approves 15-parameter approach + PII hashing
- [ ] Story 007 adapters refactored to extract all 15 fields
- [ ] Story 008 Match Engine implemented with SHA-256 hashing
- [ ] Story 009 Dispatch builds valid Meta CAPI payload
- [ ] Deployment: PerfectPay (Story 005), Webhook Adapters (Story 007), Match Engine (Story 008), Dispatch (Story 009)
- [ ] Testing: All 5 gateways tested with sample payloads
- [ ] Production: Monitor Meta CAPI response rates, hash accuracy

---

## 📚 Sources

- [Hotmart Webhook Documentation](https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook/)
- [Kiwify Webhooks](https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/)
- [Stripe Events API](https://docs.stripe.com/api/events)
- [PagSeguro Webhooks](https://developer.pagbank.com.br/reference/webhooks)
- [PerfectPay Webhook Integration](https://help.perfectpay.com.br/article/597-integracao-via-webhook-com-a-perfect-pay)
- [Meta Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/)

---

**Status: ✅ READY FOR ARCHITECTURE APPROVAL + DEV IMPLEMENTATION**

All 5 gateways mapped, all 15 Meta CAPI parameters documented, PII hashing strategy clear.

---

**Generated by:** Dara (@data-engineer)
**Date:** 2026-02-21
