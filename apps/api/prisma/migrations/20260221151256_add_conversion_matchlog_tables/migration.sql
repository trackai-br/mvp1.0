-- Create MatchStrategy enum type
CREATE TYPE "MatchStrategy" AS ENUM ('fbc', 'fbp', 'email', 'unmatched');

-- Create Conversion table
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" UUID NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "fbc" TEXT,
    "fbp" TEXT,
    "customerEmailHash" TEXT,
    "customerPhone" TEXT,
    "matchedClickId" TEXT,
    "matchStrategy" "MatchStrategy",
    "sentToCAPI" BOOLEAN NOT NULL DEFAULT false,
    "capiResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversion_matchedClickId_fkey" FOREIGN KEY ("matchedClickId") REFERENCES "Click" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create unique index for deduplication (tenantId, gateway, gatewayEventId)
CREATE UNIQUE INDEX "Conversion_tenantId_gateway_gatewayEventId_key" ON "Conversion"("tenantId", "gateway", "gatewayEventId");

-- Create indexes for matching queries
CREATE INDEX "Conversion_tenantId_fbc_createdAt_idx" ON "Conversion"("tenantId", "fbc", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_fbp_createdAt_idx" ON "Conversion"("tenantId", "fbp", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_customerEmailHash_createdAt_idx" ON "Conversion"("tenantId", "customerEmailHash", "createdAt" DESC);
CREATE INDEX "Conversion_tenantId_sentToCAPI_createdAt_idx" ON "Conversion"("tenantId", "sentToCAPI", "createdAt");
CREATE INDEX "Conversion_tenantId_matchStrategy_createdAt_idx" ON "Conversion"("tenantId", "matchStrategy", "createdAt");

-- Create MatchLog table
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

-- Create indexes for MatchLog
CREATE INDEX "MatchLog_conversionId_idx" ON "MatchLog"("conversionId");
CREATE INDEX "MatchLog_createdAt_idx" ON "MatchLog"("createdAt" DESC);
CREATE INDEX "MatchLog_finalStrategy_createdAt_idx" ON "MatchLog"("finalStrategy", "createdAt");

-- Update Tenant model to include conversions relation
-- (This is handled by Prisma, no SQL change needed)

-- Add Conversion relationship to Click table
-- (This is handled by Prisma through the FK, no SQL change needed)
