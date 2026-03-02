-- CreateEnum for ErrorType
CREATE TYPE "ErrorType" AS ENUM ('http_5xx', 'http_4xx', 'timeout', 'unknown');

-- AlterTable DispatchAttempt
ALTER TABLE "DispatchAttempt" ADD COLUMN "httpStatusCode" INTEGER,
ADD COLUMN "errorType" "ErrorType",
ADD COLUMN "isRetryable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "maxRetriesExceeded" BOOLEAN NOT NULL DEFAULT false;

-- Add index for retry polling
CREATE INDEX "DispatchAttempt_tenantId_isRetryable_nextRetryAt_idx" ON "DispatchAttempt"("tenantId", "isRetryable", "nextRetryAt");
