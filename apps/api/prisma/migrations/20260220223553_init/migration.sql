/*
  Warnings:

  - You are about to drop the `clicks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dedupe_registry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dispatch_attempts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `funnels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `identities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `setup_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenants` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('provisioning', 'active', 'suspended', 'retired');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('pending', 'success', 'failed');

-- DropForeignKey
ALTER TABLE "clicks" DROP CONSTRAINT "clicks_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "dedupe_registry" DROP CONSTRAINT "dedupe_registry_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "dispatch_attempts" DROP CONSTRAINT "dispatch_attempts_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "funnels" DROP CONSTRAINT "funnels_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "identities" DROP CONSTRAINT "identities_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "setup_sessions" DROP CONSTRAINT "setup_sessions_tenant_id_fkey";

-- DropTable
DROP TABLE "clicks";

-- DropTable
DROP TABLE "dedupe_registry";

-- DropTable
DROP TABLE "dispatch_attempts";

-- DropTable
DROP TABLE "funnels";

-- DropTable
DROP TABLE "identities";

-- DropTable
DROP TABLE "setup_sessions";

-- DropTable
DROP TABLE "tenants";

-- DropEnum
DROP TYPE "dispatch_status";

-- DropEnum
DROP TYPE "tenant_status";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'provisioning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupeRegistry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DedupeRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

    CONSTRAINT "SetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

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
ALTER TABLE "SetupSession" ADD CONSTRAINT "SetupSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
