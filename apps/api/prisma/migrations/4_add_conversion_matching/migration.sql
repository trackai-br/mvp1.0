-- CreateEnum GatewayType
CREATE TYPE "GatewayType" AS ENUM ('perfectpay', 'hotmart', 'kiwify', 'stripe', 'pageseguro');

-- CreateEnum MatchStrategy
CREATE TYPE "MatchStrategy" AS ENUM ('fbc', 'fbp', 'email_hash', 'phone_hash', 'none');

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
    "emailHashAttempted" BOOLEAN NOT NULL DEFAULT false,
    "emailHashResult" TEXT,
    "emailHashClickId" UUID,
    "phoneHashAttempted" BOOLEAN NOT NULL DEFAULT false,
    "phoneHashResult" TEXT,
    "phoneHashClickId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Conversion_tenantId_gateway_gatewayEventId_key
CREATE UNIQUE INDEX "Conversion_tenantId_gateway_gatewayEventId_key" ON "Conversion"("tenantId", "gateway", "gatewayEventId");

-- CreateIndex Conversion_tenantId_fbc_createdAt_idx
CREATE INDEX "Conversion_tenantId_fbc_createdAt_idx" ON "Conversion"("tenantId", "fbc", "createdAt" DESC);

-- CreateIndex Conversion_tenantId_fbp_createdAt_idx
CREATE INDEX "Conversion_tenantId_fbp_createdAt_idx" ON "Conversion"("tenantId", "fbp", "createdAt" DESC);

-- CreateIndex Conversion_tenantId_emailHash_createdAt_idx
CREATE INDEX "Conversion_tenantId_emailHash_createdAt_idx" ON "Conversion"("tenantId", "emailHash", "createdAt" DESC);

-- CreateIndex Conversion_tenantId_sentToCAPI_createdAt_idx
CREATE INDEX "Conversion_tenantId_sentToCAPI_createdAt_idx" ON "Conversion"("tenantId", "sentToCAPI", "createdAt");

-- CreateIndex Conversion_tenantId_matchStrategy_createdAt_idx
CREATE INDEX "Conversion_tenantId_matchStrategy_createdAt_idx" ON "Conversion"("tenantId", "matchStrategy", "createdAt");

-- CreateIndex Conversion_tenantId_gateway_createdAt_idx
CREATE INDEX "Conversion_tenantId_gateway_createdAt_idx" ON "Conversion"("tenantId", "gateway", "createdAt" DESC);

-- AddForeignKey Conversion
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Conversion webhookRaw
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_webhookRawId_fkey" FOREIGN KEY ("webhookRawId") REFERENCES "WebhookRaw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Conversion matchedClick
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_matchedClickId_fkey" FOREIGN KEY ("matchedClickId") REFERENCES "Click"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey MatchLog
ALTER TABLE "MatchLog" ADD CONSTRAINT "MatchLog_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
