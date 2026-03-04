# 🔧 Technical Reference — Hub Server-Side Tracking MVP

**Para Developers/Claude — Contexto Técnico Completo**

---

## 1️⃣ Estrutura do Monorepo

```
hub-server-side-tracking/
├── apps/
│   ├── api/                          # Backend Fastify (porta 3001)
│   │   ├── src/
│   │   │   ├── server.ts             # Fastify router principal
│   │   │   ├── db.ts                 # Prisma singleton
│   │   │   ├── click-handler.ts      # POST /api/v1/track/click
│   │   │   ├── pageview-handler.ts   # POST /api/v1/track/pageview
│   │   │   ├── checkout-handler.ts   # POST /api/v1/track/initiate_checkout
│   │   │   ├── webhooks/
│   │   │   │   ├── webhook-router.ts            # Roteador genérico
│   │   │   │   ├── perfectpay-adapter.ts        # PerfectPay parser
│   │   │   │   ├── hotmart-adapter.ts           # Hotmart parser
│   │   │   │   ├── kiwify-adapter.ts            # Kiwify parser
│   │   │   │   ├── stripe-adapter.ts            # Stripe parser
│   │   │   │   └── conversion-normalizer.ts     # Normaliza para formato padrão
│   │   │   ├── perfectpay-webhook-handler.ts    # Handler PerfectPay
│   │   │   ├── matching-engine.ts               # FBP/FBC scoring
│   │   │   ├── routes/
│   │   │   │   ├── dispatch.ts                  # Dispatch admin endpoints
│   │   │   │   ├── analytics.ts                 # Analytics v1 (legacy)
│   │   │   │   └── analytics-v2.ts              # Analytics v2 (current)
│   │   │   ├── workers/
│   │   │   │   ├── capi-dispatch-worker.ts      # SQS worker → Meta CAPI
│   │   │   │   └── retry-worker.ts              # Retry engine
│   │   │   ├── lib/
│   │   │   │   └── circuit-breaker.ts           # Resilência
│   │   │   └── validation.ts          # Zod schemas
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Modelo de dados
│   │   │   └── migrations/            # SQL migrations
│   │   └── package.json
│   │
│   └── web/                           # Frontend Next.js (porta 3000)
│       ├── src/app/
│       │   ├── page.tsx               # Dashboard principal
│       │   ├── components/
│       │   │   ├── DashboardLayout.tsx
│       │   │   ├── KPICard.tsx         # Cards de métrica
│       │   │   ├── Chart.tsx           # Gráficos
│       │   │   ├── FailureAnalysisCard.tsx
│       │   │   └── ...outros
│       │   └── api/                    # API routes Next.js
│       └── package.json
│
├── packages/
│   └── shared/                        # Schemas Zod compartilhados
│       ├── src/
│       │   └── index.ts               # clickIngestSchema, webhookBodySchema, etc
│       └── package.json
│
├── docs/
│   ├── stories/                       # Development stories (numeradas)
│   ├── README-architecture.md         # Arquitetura detalhada
│   ├── database-schema.md             # Referência de schema
│   └── learning/
│       └── GUIDE.md                   # Documentação educativa
│
├── infra/
│   └── secrets/
│       └── .env.local                 # Gitignored — variáveis de ambiente
│
└── .env.example                       # Template de variáveis

```

---

## 2️⃣ Schema do Database (Prisma)

```prisma
// Tenant — Multi-tenant
model Tenant {
  id        String     @id @default(cuid())
  slug      String     @unique
  status    String     // "active", "suspended", "provisioning"
  clicks    Click[]
  conversions Conversion[]
  // ... relações
}

// Click — Clique em anúncio
model Click {
  id          String    @id @default(cuid())
  tenantId    String
  fbclid      String?
  fbc         String?   // Facebook Container ID
  fbp         String?   // Facebook Pixel ID
  ip          String?
  userAgent   String?
  createdAt   DateTime  @default(now())

  // Índices para performance
  @@index([tenantId, fbc])
  @@index([tenantId, fbclid])
}

// Conversion — Compra (webhook de gateway)
model Conversion {
  id          String    @id @default(cuid())
  tenantId    String
  gateway     String    // "perfectpay", "hotmart", "kiwify", "stripe"
  eventId     String    // Determinístico para deduplicação
  eventType   String    // "approved", "confirmed", "succeeded"
  amount      Float?
  currency    String?
  customerEmail String?
  customerPhone String?
  createdAt   DateTime  @default(now())

  @@unique([tenantId, eventId])  // Idempotência
  @@index([tenantId])
}

// Identity — PII hasheado (LGPD)
model Identity {
  id          String    @id @default(cuid())
  tenantId    String
  emailHash   String?   // SHA-256(email.toLowerCase().trim())
  phoneHash   String?   // SHA-256(phone.replace(/\D/g, ''))
  createdAt   DateTime  @default(now())

  @@index([tenantId])
}

// MatchLog — Correlação click ↔ conversion
model MatchLog {
  id          String    @id @default(cuid())
  tenantId    String
  clickId     String
  conversionId String
  scoreSource String    // "fbp", "fbc", "email_hash", "phone_hash"
  scoreValue  Int       // 0-100
  totalScore  Int       // Soma de todos os scores
  matchedAt   DateTime  @default(now())

  @@index([tenantId, conversionId])
}

// DispatchAttempt — Envio para Meta CAPI
model DispatchAttempt {
  id          String    @id @default(cuid())
  tenantId    String
  conversionId String
  status      String    // "pending", "success", "failed", "retrying"
  httpStatus  Int?
  errorType   String?   // "http_5xx", "http_4xx", "timeout", "unknown"
  errorMessage String?
  retryCount  Int       @default(0)
  nextRetryAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId, status])
  @@index([nextRetryAt])  // Para worker de retry
}

// DedupeRegistry — Rastreamento de deduplicação
model DedupeRegistry {
  id        String    @id @default(cuid())
  tenantId  String
  eventId   String
  createdAt DateTime  @default(now())

  @@unique([tenantId, eventId])
}

// SetupSession — Onboarding wizard state
model SetupSession {
  id        String    @id @default(cuid())
  tenantId  String?
  state     String    // "step1", "step2", "step3", "completed"
  data      Json      // Dados do wizard em JSON
  token     String    @unique  // Para webhook validation
  createdAt DateTime  @default(now())
}
```

---

## 3️⃣ Endpoints (API v1)

### **Tracking Endpoints**

#### `POST /api/v1/track/click`
Captura clique em anúncio.

**Headers:**
```
x-tenant-id: tenant-demo-001
Content-Type: application/json
```

**Body (Zod Schema):**
```typescript
{
  fbclid?: string,          // Facebook Click ID
  fbc?: string,             // Facebook Container ID
  fbp?: string,             // Facebook Pixel ID
  ip?: string,              // IP do lead
  userAgent?: string,       // User agent
  utm_source?: string,      // (opcional)
  utm_medium?: string,      // (opcional)
  utm_campaign?: string     // (opcional)
}
```

**Response:**
```json
{
  "id": "cmmc1234567890abcdefgh"
}
```

**Status:**
- `202` — Click registrado
- `400` — Validação falhou
- `404` — Tenant não encontrado

---

#### `POST /api/v1/track/pageview`
Captura pageview (quando lead entra em página).

**Body:**
```json
{
  "pageUrl": "https://example.com/thank-you",
  "pageTitle": "Obrigado!",
  "fbp": "fb.1.1234567890.1234567890"
}
```

**Response:** `{ "id": "..." }`

---

#### `POST /api/v1/track/initiate_checkout`
Captura quando lead inicia checkout.

**Body:**
```json
{
  "cartValue": 199.90,
  "currency": "BRL",
  "itemCount": 1,
  "fbp": "fb.1.1234567890.1234567890"
}
```

**Response:** `{ "id": "..." }`

---

### **Webhook Endpoints**

#### `POST /api/v1/webhooks/perfectpay/:tenantId`
Recebe webhook do PerfectPay.

**Headers:**
```
x-signature: <HMAC-SHA256>
Content-Type: application/json
```

**Body (PerfectPay format):**
```json
{
  "order_id": "ORD-12345",
  "status": "approved",
  "amount": 199.90,
  "currency": "BRL",
  "customer": {
    "email": "lead@example.com",
    "phone": "+55 11 91234-5678",
    "first_name": "João",
    "last_name": "Silva",
    "document": "12345678900"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "eventId": "sha256hash...",
  "isDuplicate": false,
  "conversionId": "cmmc...",
  "matchScore": 120
}
```

---

#### `POST /api/v1/webhooks/hotmart/:tenantId`
Idem para Hotmart.

**HMAC Validation:**
- Header: `x-signature`
- Algorithm: `HMAC-SHA256`
- Secret: `HOTMART_WEBHOOK_SECRET`

---

#### `POST /api/v1/webhooks/kiwify/:tenantId`
Idem para Kiwify.

---

#### `POST /api/v1/webhooks/stripe/:tenantId`
Idem para Stripe.

---

### **Admin/Analytics Endpoints**

#### `GET /api/v1/dispatch/stats`
Retorna estatísticas de dispatch.

**Response:**
```json
{
  "totalDispatches": 1024,
  "successCount": 1000,
  "failureCount": 24,
  "retryingCount": 5,
  "lastDispatchAt": "2026-03-03T23:15:00Z"
}
```

---

#### `POST /api/v1/dispatch/retry/:dispatchId`
Força retry manualmente.

**Response:**
```json
{
  "status": "retrying",
  "nextRetryAt": "2026-03-03T23:16:00Z"
}
```

---

## 4️⃣ Fluxo de Processamento (Detalhado)

### **Click Ingestion (Story 004)**

```
POST /api/v1/track/click
    │
    ├─ Validate (Zod schema)
    ├─ Prisma: INSERT Click
    ├─ Return: { id: "..." }
    └─ HTTP 202

⏱️ Latência: < 10ms
```

---

### **Webhook Processing (Story 007-009)**

```
POST /api/v1/webhooks/{gateway}/:tenantId
    │
    ├─ 1. Get rawBody (fastify-raw-body plugin)
    ├─ 2. Get signature from header (x-signature ou gateway-specific)
    ├─ 3. Validate HMAC-SHA256 (timing-safe comparison)
    │   └─ FAIL? → HTTP 401 "Invalid signature"
    │
    ├─ 4. Parse payload (adapter.parseEvent)
    ├─ 5. Prisma: INSERT Conversion
    ├─ 6. Prisma: INSERT Identity (email/phone hash)
    ├─ 7. Prisma: INSERT DedupeRegistry (idempotência)
    │
    ├─ 8. Trigger: Match Engine
    │   └─ calculateMatchScore()
    │   └─ If score > 50: CREATE MatchLog
    │
    ├─ 9. Queue to SQS: capi-dispatch
    │   └─ DispatchAttempt status: "pending"
    │
    └─ HTTP 202 (Accepted)

⏱️ Latência sync: < 50ms
⏱️ Dispatch (async): 1-5s (SQS worker)
```

---

### **Matching Engine (Story 008)**

```
calculateMatchScore(conversion):
    │
    ├─ Get FBP from conversion (parsed from webhook)
    ├─ Get FBC from conversion (parsed from webhook)
    │
    ├─ Search Clicks: WHERE tenantId=X AND fbp=Y
    │   └─ If found: score += 70 (high confidence)
    │
    ├─ Search Clicks: WHERE tenantId=X AND fbc=Z
    │   └─ If found: score += 50 (medium confidence)
    │
    ├─ Time Decay: -1 point per day since click
    │   └─ Formula: score -= (now - clickTime) / 86400000
    │
    ├─ Total Score = sum of all
    │
    └─ If totalScore > THRESHOLD (50):
        ├─ CREATE MatchLog
        ├─ Mark as MATCHED
        └─ Proceed to dispatch

Threshold: 50 points
Timeout: 90 days (after 90d, click expires)
```

---

### **Meta CAPI Dispatch (Story 009)**

```
SQS Worker: capi-dispatch-worker.ts
    │
    ├─ Poll SQS queue: capi-dispatch
    ├─ Get DispatchAttempt record
    ├─ Get Conversion + MatchLog
    │
    ├─ Build Meta CAPI Payload (15 parameters)
    │   ├─ event_name: "Purchase"
    │   ├─ event_time: timestamp
    │   ├─ user_data: {
    │   │   em: SHA256(email),
    │   │   ph: SHA256(phone),
    │   │   fn: SHA256(first_name),
    │   │   ln: SHA256(last_name),
    │   │   ct: SHA256(city),
    │   │   st: SHA256(state),
    │   │   zp: SHA256(zip),
    │   │   db: SHA256(date_of_birth),
    │   │   fbc: conversion.fbc,
    │   │   fbp: conversion.fbp
    │   └─ }
    │   ├─ custom_data: {
    │   │   value: conversion.amount,
    │   │   currency: conversion.currency
    │   └─ }
    │   └─ ...more params
    │
    ├─ Call: POST meta.facebook.com/v21.0/{pixelId}/events
    │
    ├─ If 200-299:
    │   ├─ UPDATE DispatchAttempt status='success'
    │   └─ DELETE from SQS
    │
    ├─ If 4xx (non-retry):
    │   ├─ UPDATE status='failed', errorType='http_4xx'
    │   └─ Move to DLQ
    │
    ├─ If 5xx or timeout:
    │   ├─ UPDATE status='retrying'
    │   ├─ Exponential backoff (500ms, 1s, 2s, 4s, 8s max)
    │   ├─ Retry max 5x
    │   └─ If exhausted: status='failed'
    │
    └─ Sleep 500ms, poll next message

Throughput: 5+ events/sec
P95 Latency: < 2s
```

---

### **Retry Engine (Story 011)**

```
retry-worker.ts polls DispatchAttempt:
    │
    ├─ Query: WHERE status='retrying' AND nextRetryAt <= now()
    │
    ├─ For each record:
    │   ├─ Check: errorType classification
    │   │   ├─ "http_5xx" → retry
    │   │   ├─ "timeout" → retry
    │   │   ├─ "http_4xx" → skip (permanent error)
    │   │   └─ "unknown" → retry (be conservative)
    │   │
    │   ├─ Check: retryCount < maxRetries (5)
    │   ├─ Calculate next delay: (2^retryCount) * 500ms, max 8s
    │   │
    │   ├─ Re-queue to SQS
    │   └─ UPDATE nextRetryAt
    │
    └─ Poll interval: 30s

Backoff Schedule:
  Attempt 1: immediate
  Attempt 2: 500ms later
  Attempt 3: 1.5s later
  Attempt 4: 3.5s later
  Attempt 5: 7.5s later
  Attempt 6+: FAILED
```

---

## 5️⃣ Key Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/database?sslmode=require

# Meta CAPI
META_PIXEL_ID=123456789
META_ACCESS_TOKEN=eab123...

# Gateway Webhooks
PERFECTPAY_WEBHOOK_SECRET=abc123...
HOTMART_WEBHOOK_SECRET=def456...
KIWIFY_WEBHOOK_SECRET=ghi789...
STRIPE_WEBHOOK_SECRET=jkl012...

# AWS SQS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# SQS Queue URLs
SQS_INGEST_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
SQS_DISPATCH_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

# System
NODE_ENV=production
LOG_LEVEL=info
```

---

## 6️⃣ Performance Benchmarks

| Métrica | Target | Atual |
|---------|--------|-------|
| Click ingestion | < 10ms | ✅ |
| Webhook processing | < 50ms | ✅ |
| Matching engine | < 100ms | ✅ |
| CAPI dispatch | < 2s (p95) | ✅ |
| Database query | < 50ms | ✅ |
| Dashboard load | < 1s | ✅ |

---

## 7️⃣ Error Handling

### **HMAC Signature Validation Fails**
- Response: `HTTP 401`
- Body: `{ "message": "Assinatura inválida." }`
- Action: Check webhook secret in `.env.local`

### **Tenant Not Found**
- Response: `HTTP 404`
- Body: `{ "message": "Tenant nao encontrado." }`
- Action: Verify `x-tenant-id` header

### **Dispatch to Meta Fails (5xx)**
- Status: `retrying`
- Retry: Exponential backoff (max 5x)
- Max wait: 8 seconds

### **Dispatch to Meta Fails (4xx)**
- Status: `failed`
- Action: Move to DLQ
- Manual investigation needed

---

## 8️⃣ Testing

```bash
# All tests (129 total)
npm run test

# API tests only
npm run test -w apps/api

# Web tests only
npm run test -w apps/web

# Specific test
npm run test -- perfectpay-webhook-handler.test.ts

# With coverage
npm run test:coverage

# Watch mode
npm run test -- --watch
```

---

## 9️⃣ Deployment Checklist

- [ ] `npm run test` → All passing
- [ ] `npm run lint` → 0 errors
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build` → Successful
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] AWS SQS queues created
- [ ] Meta CAPI token valid
- [ ] Webhook secrets configured
- [ ] CloudWatch alarms set
- [ ] Load balancer health check OK

---

## 🔟 Useful Commands

```bash
# Development
npm run dev                    # Start API + Web

# Database
npx prisma migrate dev         # Create migration
npx prisma migrate deploy      # Apply migrations
npx prisma studio             # GUI for database
npx prisma generate           # Regenerate Prisma Client

# Quality
npm run lint                   # ESLint
npm run typecheck              # TypeScript
npm run test                   # All tests
npm run test:coverage          # Coverage report

# Build
npm run build                  # Production build
npm run start                  # Run built version

# Monitoring
tail -f apps/api/src/server.ts # API logs
curl http://localhost:3001/api/v1/health  # Health check
```

---

**Versão:** 1.0
**Atualizado:** 2026-03-03
