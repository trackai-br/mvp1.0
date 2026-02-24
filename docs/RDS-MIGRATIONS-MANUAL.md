# RDS Migrations — Manual Execution via AWS Console

**Date:** 2026-02-24
**Context:** Go-Live Phase 4 — Smoke Test Setup
**Duration:** ~2 minutes

---

## 🎯 Objetivo

Aplicar 3 migrations ao PostgreSQL RDS para criar schema e analytics views.

---

## 📋 Pré-requisitos

- ✅ AWS Console acesso
- ✅ RDS Query Editor disponível
- ✅ Database: `hub-server-side-tracking-db`

---

## 🔧 Instruções (3 Steps)

### Step 1: Abrir RDS Query Editor

1. Acesse: https://console.aws.amazon.com/rds/home?region=us-east-1
2. Clique em **Query Editor** (esquerda)
3. Selecione Database: `hub-server-side-tracking-db`
4. Database user: `admin`
5. Clique **Connect to database**

---

### Step 2: Executar Migration 1 (Schema Init)

Copie e cole o SQL abaixo, depois clique **Run**:

```sql
-- ============================================
-- MIGRATION 1: Initial Schema
-- ============================================

CREATE TYPE "TenantStatus" AS ENUM ('provisioning', 'active', 'suspended', 'retired');
CREATE TYPE "DispatchStatus" AS ENUM ('pending', 'success', 'failed');
CREATE TYPE "MatchStrategy" AS ENUM ('fbc', 'fbp', 'email', 'unmatched');
CREATE TYPE "GatewayType" AS ENUM ('hotmart', 'kiwify', 'stripe', 'pagseguro', 'perfectpay');

-- CreateTable Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'provisioning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable Funnel
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable Click
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fbclid" TEXT,
    "fbc" TEXT,
    "fbp" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable Identity
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable DedupeRegistry
CREATE TABLE "DedupeRegistry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DedupeRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable DispatchAttempt
CREATE TABLE "DispatchAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "DispatchStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable SetupSession
CREATE TABLE "SetupSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "projectName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issues" JSONB,
    "input" JSONB,
    "checks" JSONB,
    CONSTRAINT "SetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable Pageview
CREATE TABLE "Pageview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "referrer" TEXT,
    "title" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "fbc" TEXT,
    "fbp" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pageview_pkey" PRIMARY KEY ("id")
);

-- CreateTable Checkout
CREATE TABLE "Checkout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartValue" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "cartItems" JSONB,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "fbclid" TEXT,
    "fbc" TEXT,
    "fbp" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Checkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable WebhookRaw
CREATE TABLE "WebhookRaw" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "gateway" "GatewayType" NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "eventType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable Conversion
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "webhookRawId" TEXT NOT NULL,
    "gateway" "GatewayType" NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "fbc" TEXT,
    "fbp" TEXT,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "firstNameHash" TEXT,
    "lastNameHash" TEXT,
    "dateOfBirthHash" TEXT,
    "cityHash" TEXT,
    "stateHash" TEXT,
    "countryCode" TEXT,
    "zipCodeHash" TEXT,
    "externalIdHash" TEXT,
    "facebookLoginId" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "matchedClickId" UUID,
    "matchStrategy" "MatchStrategy",
    "sentToCAPI" BOOLEAN NOT NULL DEFAULT false,
    "capiResponse" JSONB,
    "capiRequestPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable MatchLog
CREATE TABLE "MatchLog" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "fbcAttempted" BOOLEAN NOT NULL DEFAULT false,
    "fbcResult" TEXT,
    "fbcClickId" UUID,
    "fbpAttempted" BOOLEAN NOT NULL DEFAULT false,
    "fbpResult" TEXT,
    "fbpClickId" UUID,
    "emailAttempted" BOOLEAN NOT NULL DEFAULT false,
    "emailResult" TEXT,
    "emailClickId" UUID,
    "finalStrategy" "MatchStrategy",
    "finalClickId" UUID,
    "timeWindowStart" TIMESTAMP(3) NOT NULL,
    "timeWindowEnd" TIMESTAMP(3) NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Funnel_tenantId_idx" ON "Funnel"("tenantId");
CREATE INDEX "Click_tenantId_fbc_idx" ON "Click"("tenantId", "fbc");
CREATE INDEX "Click_tenantId_fbclid_idx" ON "Click"("tenantId", "fbclid");
CREATE INDEX "Identity_tenantId_emailHash_idx" ON "Identity"("tenantId", "emailHash");
CREATE INDEX "Identity_tenantId_phoneHash_idx" ON "Identity"("tenantId", "phoneHash");
CREATE UNIQUE INDEX "DedupeRegistry_tenantId_eventId_key" ON "DedupeRegistry"("tenantId", "eventId");
CREATE INDEX "DispatchAttempt_tenantId_idx" ON "DispatchAttempt"("tenantId");
CREATE INDEX "DispatchAttempt_tenantId_eventId_idx" ON "DispatchAttempt"("tenantId", "eventId");
CREATE INDEX "SetupSession_tenantId_idx" ON "SetupSession"("tenantId");
CREATE INDEX "Pageview_tenantId_idx" ON "Pageview"("tenantId");
CREATE INDEX "Checkout_tenantId_idx" ON "Checkout"("tenantId");
CREATE UNIQUE INDEX "WebhookRaw_tenantId_gateway_gatewayEventId_key" ON "WebhookRaw"("tenantId", "gateway", "gatewayEventId");
CREATE INDEX "WebhookRaw_tenantId_gateway_createdAt_idx" ON "WebhookRaw"("tenantId", "gateway", "createdAt" DESC);
CREATE INDEX "WebhookRaw_tenantId_eventType_idx" ON "WebhookRaw"("tenantId", "eventType");
CREATE UNIQUE INDEX "Conversion_tenantId_gateway_gatewayEventId_key" ON "Conversion"("tenantId", "gateway", "gatewayEventId");
CREATE INDEX "Conversion_tenantId_fbc_createdAt_idx" ON "Conversion"("tenantId", "fbc", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_fbp_createdAt_idx" ON "Conversion"("tenantId", "fbp", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_emailHash_createdAt_idx" ON "Conversion"("tenantId", "emailHash", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_sentToCAPI_createdAt_idx" ON "Conversion"("tenantId", "sentToCAPI", "createdAt");
CREATE INDEX "Conversion_tenantId_matchStrategy_createdAt_idx" ON "Conversion"("tenantId", "matchStrategy", "createdAt");
CREATE INDEX "Conversion_tenantId_gateway_createdAt_idx" ON "Conversion"("tenantId", "gateway", "createdAt" DESC);
CREATE INDEX "MatchLog_conversionId_idx" ON "MatchLog"("conversionId");
CREATE INDEX "MatchLog_createdAt_idx" ON "MatchLog"("createdAt" DESC);
CREATE INDEX "MatchLog_finalStrategy_createdAt_idx" ON "MatchLog"("finalStrategy", "createdAt");

-- Foreign Keys
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Click" ADD CONSTRAINT "Click_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DedupeRegistry" ADD CONSTRAINT "DedupeRegistry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchAttempt" ADD CONSTRAINT "DispatchAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SetupSession" ADD CONSTRAINT "SetupSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pageview" ADD CONSTRAINT "Pageview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookRaw" ADD CONSTRAINT "WebhookRaw_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_webhookRawId_fkey" FOREIGN KEY ("webhookRawId") REFERENCES "WebhookRaw"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_matchedClickId_fkey" FOREIGN KEY ("matchedClickId") REFERENCES "Click"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchLog" ADD CONSTRAINT "MatchLog_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Expected:** ✅ All statements executed successfully

---

### Step 3: Executar Migration 2 (Analytics Views)

```sql
-- ============================================
-- MIGRATION 2: Analytics Views
-- ============================================

CREATE OR REPLACE VIEW v_dispatch_summary AS
SELECT
  t.id as tenant_id,
  DATE(da.created_at) as date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN da.status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN da.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN da.status = 'pending' THEN 1 ELSE 0 END) as dlq_count,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY 0)::int as latency_p95
FROM "Tenant" t
LEFT JOIN "DispatchAttempt" da ON t.id = da."tenantId"
WHERE da.created_at IS NULL OR da.created_at >= NOW() - INTERVAL '90 days'
GROUP BY t.id, DATE(da.created_at);

CREATE OR REPLACE VIEW v_match_rate_by_tenant AS
SELECT
  c.tenant_id,
  DATE(c.created_at) as date,
  c.gateway,
  COUNT(*) as total_conversions,
  SUM(CASE WHEN ml.final_click_id IS NOT NULL THEN 1 ELSE 0 END) as matched_conversions,
  ROUND(
    100.0 * SUM(CASE WHEN ml.final_click_id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) as match_rate_pct
FROM "Conversion" c
LEFT JOIN "MatchLog" ml ON c.id = ml.conversion_id
WHERE c.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.tenant_id, DATE(c.created_at), c.gateway;

CREATE OR REPLACE VIEW v_match_rate_by_tenant_aggregated AS
SELECT
  tenant_id,
  date,
  'all' as gateway,
  SUM(total_conversions) as total_conversions,
  SUM(matched_conversions) as matched_conversions,
  ROUND(
    100.0 * SUM(matched_conversions) / NULLIF(SUM(total_conversions), 0),
    2
  ) as match_rate_pct
FROM v_match_rate_by_tenant
GROUP BY tenant_id, date;
```

**Expected:** ✅ 3 views created

---

### Step 4: Executar Migration 3 (Materialized Views + Indexes)

```sql
-- ============================================
-- MIGRATION 3: Materialized Views & Optimization
-- ============================================

CREATE MATERIALIZED VIEW v_dispatch_summary AS
SELECT
  d.tenant_id,
  d.status,
  w.gateway,
  COUNT(*) as event_count,
  AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))) as avg_latency_seconds,
  MIN(d.created_at) as earliest_event,
  MAX(d.created_at) as latest_event
FROM "DispatchAttempt" d
JOIN "WebhookRaw" w ON d."tenantId" = w."tenantId"
GROUP BY d."tenantId", d.status, w.gateway;

CREATE UNIQUE INDEX idx_v_dispatch_summary ON v_dispatch_summary (tenant_id, status, gateway);

CREATE MATERIALIZED VIEW v_match_rate_by_tenant AS
SELECT
  c.tenant_id,
  DATE(c.created_at) as match_date,
  w.gateway,
  COUNT(*) as total_conversions,
  COUNT(m.id) as matched_conversions,
  ROUND(100.0 * COUNT(m.id) / COUNT(*), 2) as match_rate_percent
FROM "Conversion" c
LEFT JOIN "WebhookRaw" w ON c."webhookRawId" = w.id
LEFT JOIN "MatchLog" m ON c.id = m."conversionId"
GROUP BY c."tenantId", DATE(c.created_at), w.gateway;

CREATE UNIQUE INDEX idx_v_match_rate_by_tenant ON v_match_rate_by_tenant (tenant_id, match_date, gateway);

CREATE INDEX idx_dispatch_attempts_tenant_status_created
ON "DispatchAttempt" ("tenantId", status, "createdAt" DESC)
WHERE status IN ('success', 'failed', 'pending');

CREATE INDEX idx_matches_tenant_created
ON "MatchLog" ("conversionId" DESC)
WHERE "conversionId" IS NOT NULL;

CREATE INDEX idx_conversion_tenant_gateway_created
ON "Conversion" ("tenantId", gateway, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS materialized_view_refresh (
  view_name VARCHAR(100) PRIMARY KEY,
  last_refreshed_at TIMESTAMP DEFAULT NOW(),
  refresh_interval_minutes INT DEFAULT 5
);

INSERT INTO materialized_view_refresh (view_name, last_refreshed_at, refresh_interval_minutes)
VALUES
  ('v_dispatch_summary', NOW(), 5),
  ('v_match_rate_by_tenant', NOW(), 5)
ON CONFLICT (view_name) DO UPDATE SET last_refreshed_at = NOW();
```

**Expected:** ✅ 2 materialized views + indexes created

---

## ✅ Verificação

Após completar, rode este query para confirmar:

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'public'
ORDER BY TABLE_NAME;
```

**Expected:** 12 tables criadas (Tenant, Click, Conversion, etc.)

---

## 🎯 Próximo Passo

Após migrations aplicadas, volte aqui e avise `migrações completadas` para executar o smoke test! 🚀
