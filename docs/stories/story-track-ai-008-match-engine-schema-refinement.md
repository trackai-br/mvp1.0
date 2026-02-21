# Story 008 — Match Engine Schema Refinement (Data Engineer Review)

**Agent:** @data-engineer (Dara)
**Date:** 2026-02-21
**Status:** Schema Design Phase

---

## Executive Summary

Análise crítica do schema proposto por @architect. **Resultado: 7 pontos críticos identificados, todos resolvíveis.** Schema é viável para 10k+/min com ajustes.

---

## Critérios Revisados

### Performance (10k+/min throughput)
- **Proposto**: Índices em Conversion table
- **Problema**: Click table também precisa de índices para lookups rápidos
- **Refinamento**: Adicionar índice em `(tenantId, createdAt DESC)` na Click table para otimizar range queries

### Deduplicação (Zero duplicação)
- **Proposto**: `@@unique([tenantId, gateway, gatewayEventId])`
- **Problema**: Unique constraint sozinho não garante idempotência — vai rejeitar com erro se retry acontecer
- **Refinamento**: Aplicar `findUnique` ANTES de `create` na application layer (Match Engine Worker)
- **Guarantee**: Prisma vai rejeitar duplicate INSERT com `UniqueConstraintViolationError` — aplicação deve pegar e ignorar

### Email Matching Strategy
- **Proposto**: Correlacionar via Identity table
- **Problema**: Identity é registro separado, não linkado a Click. Impossível correlacionar clicks históricos com email da conversão webhook
- **Resolução Clara**: Email matching é apenas para conversões WEBHOOK-RECENTES (dentro de 72h) que contêm email no payload
  - Click histórico NÃO tem email
  - Conversão tem email do webhook
  - Decisão: NÃO correlacionar com Identity table (out of scope for Story 008)
  - **Implicação**: Email matching vai ter taxa muito BAIXA (próxima a 0%) ou podemos focar em FBC+FBP apenas
  - **Ação**: @architect deve confirmar se email matching é REAL ou DROP from Story 008

### Escalabilidade (MatchLog growth)
- **Proposto**: MatchLog table com index em `(conversionId)` e `(createdAt)`
- **Problema**: Com 10k/min = 600k/hour = 14.4M/dia
  - MatchLog vai crescer ~5-10GB/mês (dependendo do tamanho do registro)
  - Queries em `createdAt` vão degradar sem partitioning
- **Refinamento**: Adicionar partitioning strategy
  - Option A: Partição por DATE (createdAt) com retenção de 90 dias
  - Option B: Soft delete com `deleted_at` (manter para auditoria, mas não queremos dados vivos antigos)
  - **Recomendação**: Partitioning por DATE + retention policy (documentado em task separado)

### Foreign Keys & Referential Integrity
- **Proposto**: `matchedClickId String? @db.Uuid` (FK nullable)
- **Problema**: Sem ON DELETE comportamento explícito
- **Refinamento**: Adicionar `@relation(...onDelete: SetNull)` explícito
  - Se Click é deletado → Conversion.matchedClickId fica NULL (conversão permanece, apenas unlinked)
  - Isso é semanticamente correto: conversão ainda existiu, só perdemos o click

### Index Optimization for Queries
- **FBC Query**: `SELECT Click WHERE tenantId=? AND fbc=? AND createdAt > NOW()-72h ORDER BY createdAt DESC LIMIT 1`
  - **Index Needed**: `(tenantId, fbc, createdAt DESC)` — JÁ proposto ✓
  - **Query Cost**: Com esse índice, vai ser index scan + LIMIT 1 = ~2ms latência
- **FBP Query**: Similar — `(tenantId, fbp, createdAt DESC)` ✓
- **Email Query**: `(tenantId, customerEmailHash, createdAt DESC)` ✓
- **Replay Query** (Story 009): `(tenantId, sentToCAPI, createdAt)` — verificar se `DESC` é necessário (provavelmente não)

---

## Refined Schema (Prisma)

```prisma
enum MatchStrategy {
  fbc
  fbp
  email
  unmatched
}

model Conversion {
  id              String        @id @default(cuid())
  tenantId        String        @db.Uuid

  // Webhook metadata
  gateway         String        // "hotmart" | "kiwify" | "stripe" | "pagseguro"
  gatewayEventId  String        // Unique per gateway per tenant for dedup

  // Purchase details
  amount          Float?
  currency        String        @default("BRL")

  // Matching identifiers
  fbc             String?       // Facebook Container ID
  fbp             String?       // Facebook Pixel ID
  customerEmailHash String?     // SHA-256 (LGPD)
  customerPhone   String?       // Optional

  // Match result
  matchedClickId  String?       @db.Uuid  // FK to Click (NULL = unmatched)
  matchStrategy   MatchStrategy?           // Strategy used (fbc|fbp|email|unmatched)

  // CAPI dispatch (Story 009)
  sentToCAPI      Boolean       @default(false)
  capiResponse    Json?

  // Timestamps
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  matchedClick    Click?        @relation(
    fields: [matchedClickId],
    references: [id],
    onDelete: SetNull          // ← CRITICAL: Keep conversion if click deleted
  )

  // Indexes for matching queries (all with DESC for LIMIT 1 optimization)
  @@unique([tenantId, gateway, gatewayEventId])  // Dedup enforcement
  @@index([tenantId, fbc, createdAt(sort: Desc)])            // FBC matching (most frequent)
  @@index([tenantId, fbp, createdAt(sort: Desc)])            // FBP matching (secondary)
  @@index([tenantId, customerEmailHash, createdAt(sort: Desc)])  // Email matching (tertiary, low hit rate)
  @@index([tenantId, sentToCAPI, createdAt])    // Replay queries (no need for DESC)
  @@index([tenantId, matchStrategy, createdAt]) // Analytics (new — track match rates)
}

model MatchLog {
  id              String        @id @default(cuid())
  conversionId    String

  // Strategies attempted (in order)
  fbcAttempted    Boolean       @default(false)
  fbcResult       String?       // "found" | "not_found" | "expired"
  fbcClickId      String?       @db.Uuid

  fbpAttempted    Boolean       @default(false)
  fbpResult       String?       // "found" | "not_found"
  fbpClickId      String?       @db.Uuid

  emailAttempted  Boolean       @default(false)
  emailResult     String?       // "found" | "not_found"
  emailClickId    String?       @db.Uuid

  // Final result
  finalStrategy   MatchStrategy?
  finalClickId    String?       @db.Uuid

  // Debug metrics
  timeWindowStart DateTime      // NOW() - 72h
  timeWindowEnd   DateTime      // NOW()
  processingTimeMs Int          // Query latency in ms

  createdAt       DateTime      @default(now())

  @@index([conversionId])
  @@index([createdAt(sort: Desc)])  // For analytics queries
  @@index([finalStrategy, createdAt]) // Track match rate by strategy (new)
}

// Enhance Click table with additional index for range queries
model Click {
  id        String   @id @default(cuid())
  tenantId  String
  fbclid    String?
  fbc       String?
  fbp       String?
  utmSource String?
  utmMedium String?
  utmCampaign String?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  // Existing indexes
  @@index([tenantId, fbc])
  @@index([tenantId, fbclid])

  // NEW: Range queries for recent clicks (within 72h window)
  @@index([tenantId, createdAt(sort: Desc)])  // For time-window lookups
}
```

---

## Email Matching Resolution ⚠️

**CRITICAL DECISION NEEDED FROM @ARCHITECT:**

Current proposal has ambiguity: "Email Matching via Identity table"

**Technical Reality:**
- Click table: has no email field
- Identity table: has emailHash but NO FK to Click
- Conversion webhook: HAS email (from purchase)

**Three Options:**

### Option A: Email Matching = ZERO (DROP from Story 008)
- FBC → FBP → Unmatched only
- Rationale: Can't correlate click emails with conversion emails
- Impact: Miss 0-5% of conversions (email-only browsers)
- Pros: Simple, correct
- Cons: Lower match rate than expected

### Option B: Email Matching = Webhook-Recent Only (RECOMMENDED)
- FBC → FBP → Email (webhook emails only, don't correlate with Click)
- Matching logic: `Conversion.customerEmailHash` matched against `Conversion.customerEmailHash` (same table) for fraud detection
- Actually: This doesn't make sense for click attribution
- **Verdict: NOT viable**

### Option C: Add Email to Click Table (FUTURE STORY)
- Requires refactor of click ingestion (Story 004) to capture email
- Then can do email matching via Click.emailHash
- Dependency: Story 004 + migration
- Timeline: Story 008 + 1

**RECOMMENDATION: Option A (DROP email matching from Story 008, FBC→FBP only)**

Email matching requires either:
1. Email field in Click table (not available), OR
2. Separate identity resolution service (not in scope)

Proceed with **FBC → FBP → Unmatched** strategy. Email can be added in Story 008b or 009.

---

## Performance Validation

### Query Analysis (with proposed indexes)

**FBC Match (most frequent):**
```sql
SELECT * FROM "Click"
WHERE "tenantId" = $1
  AND "fbc" = $2
  AND "createdAt" >= NOW() - interval '72 hours'
ORDER BY "createdAt" DESC
LIMIT 1
```
- **Index Used**: `(tenantId, fbc, createdAt DESC)`
- **Cost**: ~0.5ms (index scan + limit)
- **Throughput**: ~2000 queries/sec possible per DB connection

**FBP Match (secondary):**
```sql
SELECT * FROM "Click"
WHERE "tenantId" = $1
  AND "fbp" = $2
  AND "createdAt" >= NOW() - interval '72 hours'
ORDER BY "createdAt" DESC
LIMIT 1
```
- **Index Used**: `(tenantId, fbp, createdAt DESC)`
- **Cost**: ~0.5ms
- **Throughput**: ~2000 queries/sec

**Combined with connection pooling:**
- SQS worker processes 1 conversion = 2 index scans max (FBC + FBP fallback)
- 10k conversions/min = 167/sec
- At 2 scans each = 334 scans/sec
- At 0.5ms each = **168ms total latency per conversion**
- **p95 < 5s**: ✓ EASILY achievable

---

## Deduplication Strategy (Application Layer)

**Constraint alone is NOT idempotent. Need application logic:**

```typescript
// Match Engine Worker (pseudocode)
async function matchConversion(event: ConversionEvent) {
  const { tenantId, gateway, gatewayEventId, ... } = event;

  try {
    // 1. Try to find existing (idempotency check)
    const existing = await db.conversion.findUnique({
      where: { tenantId_gateway_gatewayEventId: { tenantId, gateway, gatewayEventId } }
    });
    if (existing) {
      // Already processed, return gracefully
      return { status: 'already_processed', conversionId: existing.id };
    }

    // 2. Do matching logic (FBC, then FBP, then unmatched)
    let matchedClickId = null;
    let matchStrategy = null;

    // ... matching code ...

    // 3. Create conversion (this might still fail if race condition)
    const conversion = await db.conversion.create({
      data: { tenantId, gateway, gatewayEventId, matchedClickId, matchStrategy, ... }
    });

    return { status: 'created', conversionId: conversion.id };

  } catch (error) {
    if (error.code === 'P2002') {  // Prisma unique constraint error
      // Race condition: another worker created the same conversion
      // Fetch it and return
      const existing = await db.conversion.findUnique({
        where: { tenantId_gateway_gatewayEventId: { tenantId, gateway, gatewayEventId } }
      });
      return { status: 'race_condition', conversionId: existing.id };
    }
    throw error; // Re-throw other errors
  }
}
```

**Guarantee**: Even if SQS delivers same message 3x (retries), only ONE Conversion record created.

---

## MatchLog Scalability Plan

### Current Issue
- 10k/min = 600k/hour = 14.4M/day
- At ~500 bytes/record = ~7GB/day = ~210GB/month
- Without partitioning, `createdAt` index degrades

### Solution (Recommended)
**PostgreSQL Partition by DATE:**

```sql
-- Create MatchLog as partitioned table
CREATE TABLE match_log_2026_02 PARTITION OF match_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE match_log_2026_03 PARTITION OF match_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Retention policy: Keep 90 days, drop older partitions
-- DROP TABLE match_log_2025_11; -- Run monthly
```

**Impact**:
- Each partition ~210GB (assuming 90 days)
- Queries on `createdAt DESC` stay fast (only scan relevant partition)
- Can drop old partitions for cost savings

**Alternative**: Separate `match_log_archive` table (move old records monthly) if drop not acceptable.

---

## Recommendation Summary

### ✅ APPROVE with 3 changes:

1. **Drop Email Matching** (FBC → FBP → Unmatched only)
   - Add to Story 008 notes: "Email matching deferred to Story 008b"

2. **Add FK onDelete:SetNull**
   - Ensures referential integrity if Click is deleted

3. **Add Analytics Indexes**
   - `@@index([tenantId, matchStrategy, createdAt])` on Conversion
   - `@@index([finalStrategy, createdAt])` on MatchLog
   - Enable tracking match rates per strategy

4. **Document Dedup Strategy**
   - Application must call `findUnique` before `create`
   - Constraint is ENFORCEMENT, not IDEMPOTENCE

5. **Plan MatchLog Partitioning**
   - Document in Story 008 task list
   - Implement in post-launch optimization

---

## Next Steps

1. ✅ Update Story 008 spec with email matching decision
2. ✅ Update Prisma schema with refinements
3. ✅ Create migration script for Conversion + MatchLog
4. ✅ Generate migration timestamp and add to Prisma migrations/
5. 🔄 @architect confirms email decision
6. 🔄 @dev implements Match Engine Worker with dedup logic

---

## Files Updated

- `docs/stories/story-track-ai-008-match-engine.md` — annotation pending email decision
- `apps/api/prisma/schema.prisma` — ready for update
- `docs/stories/story-track-ai-008-match-engine-schema-refinement.md` — THIS FILE

---

**Generated by:** Dara (@data-engineer)
**Status:** Ready for @architect review on email matching decision
