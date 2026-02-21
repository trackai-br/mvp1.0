-- Create MatchStrategy enum type
CREATE TYPE "MatchStrategy" AS ENUM ('fbc', 'fbp', 'email', 'unmatched');

-- Create GatewayType enum type
CREATE TYPE "GatewayType" AS ENUM ('hotmart', 'kiwify', 'stripe', 'pagseguro', 'perfectpay');

-- Create WebhookRaw table (Option 3: store original payload for audit)
CREATE TABLE "WebhookRaw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" UUID NOT NULL,
    "gateway" "GatewayType" NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "eventType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookRaw_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebhookRaw_tenantId_gateway_gatewayEventId_key"
  ON "WebhookRaw"("tenantId", "gateway", "gatewayEventId");
CREATE INDEX "WebhookRaw_tenantId_gateway_createdAt_idx"
  ON "WebhookRaw"("tenantId", "gateway", "createdAt" DESC);
CREATE INDEX "WebhookRaw_tenantId_eventType_idx"
  ON "WebhookRaw"("tenantId", "eventType");

-- Create Conversion table (15 Meta CAPI parameters + hashed PII)
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "matchedClickId" TEXT,
    "matchStrategy" "MatchStrategy",
    "sentToCAPI" BOOLEAN NOT NULL DEFAULT false,
    "capiResponse" JSONB,
    "capiRequestPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversion_webhookRawId_fkey" FOREIGN KEY ("webhookRawId") REFERENCES "WebhookRaw" ("id") ON DELETE CASCADE,
    CONSTRAINT "Conversion_matchedClickId_fkey" FOREIGN KEY ("matchedClickId") REFERENCES "Click" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Conversion_tenantId_gateway_gatewayEventId_key"
  ON "Conversion"("tenantId", "gateway", "gatewayEventId");
CREATE INDEX "Conversion_tenantId_fbc_createdAt_idx"
  ON "Conversion"("tenantId", "fbc", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_fbp_createdAt_idx"
  ON "Conversion"("tenantId", "fbp", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_emailHash_createdAt_idx"
  ON "Conversion"("tenantId", "emailHash", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_sentToCAPI_createdAt_idx"
  ON "Conversion"("tenantId", "sentToCAPI", "createdAt");
CREATE INDEX "Conversion_tenantId_matchStrategy_createdAt_idx"
  ON "Conversion"("tenantId", "matchStrategy", "createdAt");
CREATE INDEX "Conversion_tenantId_gateway_createdAt_idx"
  ON "Conversion"("tenantId", "gateway", "createdAt" DESC);

-- Create MatchLog table (audit trail)
CREATE TABLE "MatchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversionId" TEXT NOT NULL,
    "fbcAttempted" BOOLEAN NOT NULL DEFAULT false,
    "fbcResult" TEXT,
    "fbcClickId" TEXT,
    "fbpAttempted" BOOLEAN NOT NULL DEFAULT false,
    "fbpResult" TEXT,
    "fbpClickId" TEXT,
    "emailAttempted" BOOLEAN NOT NULL DEFAULT false,
    "emailResult" TEXT,
    "emailClickId" TEXT,
    "finalStrategy" "MatchStrategy",
    "finalClickId" TEXT,
    "timeWindowStart" TIMESTAMP(3) NOT NULL,
    "timeWindowEnd" TIMESTAMP(3) NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MatchLog_conversionId_idx" ON "MatchLog"("conversionId");
CREATE INDEX "MatchLog_createdAt_idx" ON "MatchLog"("createdAt" DESC);
CREATE INDEX "MatchLog_finalStrategy_createdAt_idx" ON "MatchLog"("finalStrategy", "createdAt");
