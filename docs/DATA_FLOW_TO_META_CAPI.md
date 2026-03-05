# 📊 Fluxo de Dados: Webhook → Meta CAPI

**Última atualização:** 2026-03-05 22:30 UTC
**Status:** Documentação PRE-IMPLEMENTATION para Stories 007-011

---

## 🎯 Visão Geral

```
Gateway Webhook (PerfectPay, Hotmart, etc)
         ↓
    [Story 007] Generic Webhook Receiver
         ↓
    WebhookRaw (armazena payload original)
         ↓
    [Story 008] Match Engine (Click ↔ Conversion)
         ↓
    Conversion (com 15 parâmetros Meta CAPI)
         ↓
    [Story 009] SQS/BullMQ Dispatch Worker
         ↓
    Meta Conversions API (CAPI)
```

---

## 📋 Tabelas Supabase Envolvidas

### 1. **WebhookRaw** — Armazena Evento Original

| Campo | Tipo | Propósito |
|-------|------|----------|
| `id` | STRING | PK |
| `tenantId` | UUID | FK → Tenant |
| `gateway` | ENUM | Qual gateway (perfectpay, hotmart, kiwify, stripe, pagseguro) |
| `gatewayEventId` | STRING | ID único do evento no gateway |
| `rawPayload` | JSON | Webhook payload original (completo) |
| `eventType` | STRING | Tipo do evento (purchase_approved, charge.succeeded, etc) |
| `createdAt` | DATETIME | Timestamp |

**Índices:**
- `UNIQUE(tenantId, gateway, gatewayEventId)` — deduplicação
- `INDEX(tenantId, gateway, createdAt DESC)` — queries rápidas

---

### 2. **Conversion** — Dados Prontos para Meta CAPI

| Campo | Tipo | Para Meta CAPI? | Observação |
|-------|------|-----------------|-----------|
| `id` | STRING | ❌ | PK interno |
| `tenantId` | UUID | ❌ | FK |
| `webhookRawId` | STRING | ❌ | FK → WebhookRaw |
| `gateway` | ENUM | ❌ | Qual gateway originou |
| `gatewayEventId` | STRING | ❌ | ID dedup |
| | | | |
| **`amount`** | FLOAT | ✅ | Valor da compra (CAPI: `value`) |
| **`currency`** | STRING | ✅ | Moeda (CAPI: `currency`) |
| | | | |
| **`fbc`** | STRING | ✅ | Facebook Container ID |
| **`fbp`** | STRING | ✅ | Facebook Pixel ID |
| **`emailHash`** | STRING | ✅ | SHA-256(email lowercase) |
| **`phoneHash`** | STRING | ✅ | SHA-256(phone digits only) |
| **`firstNameHash`** | STRING | ✅ | SHA-256(first name) |
| **`lastNameHash`** | STRING | ✅ | SHA-256(last name) |
| **`dateOfBirthHash`** | STRING | ✅ | SHA-256(YYYYMMDD) |
| **`cityHash`** | STRING | ✅ | SHA-256(city) |
| **`stateHash`** | STRING | ✅ | SHA-256(state) |
| **`countryCode`** | STRING | ✅ | ISO 2-letter code (não hashed) |
| **`zipCodeHash`** | STRING | ✅ | SHA-256(postal code) |
| **`externalIdHash`** | STRING | ✅ | SHA-256(customer ID do gateway) |
| **`facebookLoginId`** | STRING | ✅ | Facebook login ID (hashed) |
| **`clientIp`** | STRING | ✅ | IP do cliente (from Click) |
| **`userAgent`** | STRING | ✅ | Browser user agent (from Click) |
| | | | |
| `matchedClickId` | UUID | ❌ | FK → Click (matching result) |
| `matchStrategy` | ENUM | ❌ | Como foi matched (fbc, fbp, email, unmatched) |
| `sentToCAPI` | BOOLEAN | ❌ | Flag se já foi enviado |
| `capiResponse` | JSON | ❌ | Resposta de Meta CAPI |
| `capiRequestPayload` | JSON | ❌ | Payload enviado para Meta CAPI |
| `createdAt`, `updatedAt` | DATETIME | ❌ | Timestamps |

---

### 3. **Click** — Dados de Clique em Anúncios

| Campo | Relevância para Meta CAPI |
|-------|---------------------------|
| `fbclid` | ✅ Usado para matching (Story 008) |
| `fbc` | ✅ Copiado para Conversion |
| `fbp` | ✅ Copiado para Conversion |
| `ip` | ✅ Copiado para Conversion (clientIp) |
| `userAgent` | ✅ Copiado para Conversion |
| `utmSource`, `utmMedium`, `utmCampaign` | ℹ️ Para analytics (não enviado a CAPI) |

---

### 4. **MatchLog** — Debug do Matching

| Campo | Propósito |
|-------|----------|
| `conversionId` | Qual conversão foi matched |
| `fbcAttempted`, `fbcResult` | Facebook Container ID matching |
| `fbpAttempted`, `fbpResult` | Facebook Pixel ID matching |
| `emailAttempted`, `emailResult` | Email hash matching |
| `finalStrategy` | Qual estratégia venceu (fbc > fbp > email > unmatched) |
| `finalClickId` | ID do click que matchou |
| `processingTimeMs` | Latência da query (importante para otimização) |

---

## 🔄 Fluxo em Detalhes

### **STEP 1: Webhook Recebido (Story 007)**

```
POST /api/v1/webhooks/[gateway]/:tenantId
  ↓
Validação HMAC/Signature
  ↓
INSERT WebhookRaw {
  tenantId: "...",
  gateway: "perfectpay",
  gatewayEventId: "txn_abc123",
  rawPayload: { order_id, customer, amount, ... },
  eventType: "purchase_approved"
}
```

**Tabelas Afetadas:**
- ✅ `WebhookRaw` (INSERT)
- ✅ `DedupeRegistry` (INSERT para idempotência)

---

### **STEP 2: Matching (Story 008 — Match Engine)**

```
FOR EACH Conversion (do webhook):
  1. Extrair email/phone do webhookRaw.rawPayload
  2. Hash SHA-256(email), SHA-256(phone)
  3. INSERT Identity { emailHash, phoneHash }
  4. Query Click table:
     - TRY: fbc matching (Conversion.fbc = Click.fbc) — 72h window
     - ELSE: fbp matching (Conversion.fbp = Click.fbp) — 72h window
     - ELSE: email matching (Identity.emailHash = Click.email... wait, Click não tem email)
     - ELSE: unmatched
  5. UPDATE Conversion { matchedClickId, matchStrategy }
  6. INSERT MatchLog { ... }
```

**Tabelas Afetadas:**
- ✅ `Conversion` (INSERT + UPDATE)
- ✅ `Identity` (INSERT)
- ✅ `MatchLog` (INSERT)

---

### **STEP 3: Preparar Payload Meta CAPI (Story 009)**

```
FOR EACH Conversion where sentToCAPI = false:
  CAPI_PAYLOAD = {
    event_name: "Purchase",
    event_time: unix_timestamp(createdAt),

    user_data: {
      em: [emailHash],  // SHA-256(email)
      ph: [phoneHash],  // SHA-256(phone)
      fn: [firstNameHash],
      ln: [lastNameHash],
      dob: [dateOfBirthHash],
      ct: [cityHash],
      st: [stateHash],
      zp: [zipCodeHash],
      country: countryCode,
      external_id: [externalIdHash],
      fbc: fbc,
      fbp: fbp,
      client_ip_address: clientIp,
      client_user_agent: userAgent
    },

    custom_data: {
      value: amount,
      currency: currency
    },

    content_name: "Purchase",
    content_category: "product"
  }

  → Enqueue na fila (SQS ou BullMQ)
```

**Tabelas Afetadas:**
- ✅ `Conversion` (INSERT `capiRequestPayload`)

---

### **STEP 4: Enviar a Meta CAPI (Story 009 — Dispatch Worker)**

```
WORKER:
  1. Dequeue mensagem
  2. POST https://graph.facebook.com/v18.0/{pixelId}/events
     + headers: Authorization: Bearer {ACCESS_TOKEN}
     + body: CAPI_PAYLOAD
  3. Receber response: { events_received, fbia_status, ... }
  4. UPDATE Conversion {
       sentToCAPI = true,
       capiResponse = { ... }
     }
  5. INSERT DispatchAttempt {
       tenantId, eventId, attempt, status, error
     }
```

**Tabelas Afetadas:**
- ✅ `Conversion` (UPDATE)
- ✅ `DispatchAttempt` (INSERT)

---

## 📌 Resumo: Dados que VÃO para Meta CAPI

```json
{
  "event_data": {
    "value": "amount (float)",
    "currency": "BRL",
    "client_ip_address": "clientIp",
    "client_user_agent": "userAgent"
  },
  "user_data": {
    "em": ["emailHash"],
    "ph": ["phoneHash"],
    "fn": ["firstNameHash"],
    "ln": ["lastNameHash"],
    "dob": ["dateOfBirthHash"],
    "ct": ["cityHash"],
    "st": ["stateHash"],
    "zp": ["zipCodeHash"],
    "country": "countryCode",
    "external_id": ["externalIdHash"],
    "fbc": "fbc",
    "fbp": "fbp"
  }
}
```

**Total: 15 parâmetros + IPs + User Agent**

---

## 🔐 Segurança & Conformidade

| Aspecto | Implementação |
|--------|--------------|
| **PII Hashing** | SHA-256 (email, phone, name, DOB, address, external_id) |
| **Never Plain Text** | PII nunca persistido em texto plano |
| **LGPD Compliance** | Hashing antes de persistência |
| **HMAC Validation** | Webhooks validados por assinatura criptográfica |
| **Idempotência** | Unique constraint em (tenantId, gateway, gatewayEventId) |

---

## ✅ Pre-Implementation Checklist

Antes de começar Stories 007-011:

- [ ] Confirmar que schema.prisma está correto (validado em E2E test)
- [ ] Verificar que todos os 15 campos Meta CAPI estão no Conversion model
- [ ] Confirmar credenciais Meta CAPI (pixelId, accessToken)
- [ ] Definir retry strategy para DispatchAttempt
- [ ] Testar hashing PII (SHA-256 normalization)
- [ ] Documentar rate limits Meta CAPI (Story 009)
- [ ] Preparar error handling para erros HTTP 4xx vs 5xx (Story 011)

---

**Próximos Passos:**
1. Story 007: Generic Webhook Receiver (Hotmart, Kiwify, Stripe, PagSeguro)
2. Story 008: Match Engine (Click ↔ Conversion)
3. Story 009: SQS/BullMQ Dispatch to Meta CAPI
4. Story 010: Analytics Dashboard
5. Story 011: Replay Engine (retry failed conversions)
