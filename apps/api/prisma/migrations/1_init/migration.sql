-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('provisioning', 'active', 'suspended', 'retired');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "MatchStrategy" AS ENUM ('fbc', 'fbp', 'email', 'unmatched');

-- CreateEnum
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

-- CreateIndex
CREATE INDEX "Funnel_tenantId_idx" ON "Funnel"("tenantId");

-- CreateIndex
CREATE INDEX "Click_tenantId_fbc_idx" ON "Click"("tenantId", "fbc");

-- CreateIndex
CREATE INDEX "Click_tenantId_fbclid_idx" ON "Click"("tenantId", "fbclid");

-- CreateIndex
CREATE INDEX "Identity_tenantId_emailHash_idx" ON "Identity"("tenantId", "emailHash");

-- CreateIndex
CREATE INDEX "Identity_tenantId_phoneHash_idx" ON "Identity"("tenantId", "phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "DedupeRegistry_tenantId_eventId_key" ON "DedupeRegistry"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "DispatchAttempt_tenantId_idx" ON "DispatchAttempt"("tenantId");

-- CreateIndex
CREATE INDEX "DispatchAttempt_tenantId_eventId_idx" ON "DispatchAttempt"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "SetupSession_tenantId_idx" ON "SetupSession"("tenantId");

-- CreateIndex
CREATE INDEX "Pageview_tenantId_idx" ON "Pageview"("tenantId");

-- CreateIndex
CREATE INDEX "Checkout_tenantId_idx" ON "Checkout"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookRaw_tenantId_gateway_gatewayEventId_key" ON "WebhookRaw"("tenantId", "gateway", "gatewayEventId");

-- CreateIndex
CREATE INDEX "WebhookRaw_tenantId_gateway_createdAt_idx" ON "WebhookRaw"("tenantId", "gateway", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WebhookRaw_tenantId_eventType_idx" ON "WebhookRaw"("tenantId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_tenantId_gateway_gatewayEventId_key" ON "Conversion"("tenantId", "gateway", "gatewayEventId");

-- CreateIndex
CREATE INDEX "Conversion_tenantId_fbc_createdAt_idx" ON "Conversion"("tenantId", "fbc", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Conversion_tenantId_fbp_createdAt_idx" ON "Conversion"("tenantId", "fbp", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Conversion_tenantId_emailHash_createdAt_idx" ON "Conversion"("tenantId", "emailHash", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Conversion_tenantId_sentToCAPI_createdAt_idx" ON "Conversion"("tenantId", "sentToCAPI", "createdAt");

-- CreateIndex
CREATE INDEX "Conversion_tenantId_matchStrategy_createdAt_idx" ON "Conversion"("tenantId", "matchStrategy", "createdAt");

-- CreateIndex
CREATE INDEX "Conversion_tenantId_gateway_createdAt_idx" ON "Conversion"("tenantId", "gateway", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MatchLog_conversionId_idx" ON "MatchLog"("conversionId");

-- CreateIndex
CREATE INDEX "MatchLog_createdAt_idx" ON "MatchLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MatchLog_finalStrategy_createdAt_idx" ON "MatchLog"("finalStrategy", "createdAt");

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedupeRegistry" ADD CONSTRAINT "DedupeRegistry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAttempt" ADD CONSTRAINT "DispatchAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupSession" ADD CONSTRAINT "SetupSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pageview" ADD CONSTRAINT "Pageview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRaw" ADD CONSTRAINT "WebhookRaw_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_webhookRawId_fkey" FOREIGN KEY ("webhookRawId") REFERENCES "WebhookRaw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_matchedClickId_fkey" FOREIGN KEY ("matchedClickId") REFERENCES "Click"("id") ON DELETE SET NULL ON UPDATE CASCADE;
