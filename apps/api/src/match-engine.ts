import crypto from 'node:crypto';
import { prisma } from './db.js';
import type { NormalizedWebhookEvent } from './webhooks/webhook-router.js';
import type { $Enums } from '.prisma/client';

/**
 * Match Engine for Story 008
 *
 * Core matching logic:
 * 1. Receive normalized ConversionEvent from webhook
 * 2. Hash all PII (SHA-256) for LGPD compliance
 * 3. Match Click by: FBC (72h) → FBP (72h) → Unmatched
 * 4. Persist Conversion + MatchLog
 * 5. Enqueue to SQS capi-dispatch (Story 009)
 *
 * Timezone: All timestamps in UTC
 * Time window: 72 hours for click-to-conversion matching
 */

export interface ConversionInput {
  tenantId: string;
  gateway: string;
  webhookRawId: string; // FK to WebhookRaw
  event: NormalizedWebhookEvent;
}

export interface ConversionOutput {
  conversionId: string;
  webhookRawId: string;
  matchedClickId?: string;
  matchStrategy: 'fbc' | 'fbp' | 'unmatched';
  matchLogId: string;
  capiPayloadEnqueued: boolean;
}

// Type aliases for Prisma enums
type MatchStrategy = $Enums.MatchStrategy;
type GatewayType = $Enums.GatewayType;

/**
 * Hash PII field with SHA-256
 */
function hashPII(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Calculate 72-hour window (in milliseconds)
 */
const MATCH_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Execute matching logic
 */
export async function matchConversion(input: ConversionInput): Promise<ConversionOutput> {
  const { tenantId, gateway, webhookRawId, event } = input;
  const startTime = performance.now(); // Measure processing time

  if (!event.eventId) {
    throw new Error('ConversionEvent eventId is required');
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - MATCH_WINDOW_MS);

  let matchedClickId: string | undefined;
  let matchStrategy: MatchStrategy = 'unmatched';

  // STEP 1: Try FBC matching (primary strategy)
  if (event.fbc) {
    const fbcMatch = await prisma.click.findFirst({
      where: {
        tenantId,
        fbc: event.fbc,
        createdAt: {
          gte: windowStart,
          lte: now,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' }, // Most recent click
    });

    if (fbcMatch) {
      matchedClickId = fbcMatch.id;
      matchStrategy = 'fbc';
    }
  }

  // STEP 2: Try FBP matching (fallback if no FBC match)
  if (!matchedClickId && event.fbp) {
    const fbpMatch = await prisma.click.findFirst({
      where: {
        tenantId,
        fbp: event.fbp,
        createdAt: {
          gte: windowStart,
          lte: now,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' }, // Most recent click
    });

    if (fbpMatch) {
      matchedClickId = fbpMatch.id;
      matchStrategy = 'fbp';
    }
  }

  // STEP 3: Hash PII fields (always hash, regardless of match)
  const conversion = {
    tenantId,
    webhookRawId,
    matchedClickId: matchedClickId || null,
    matchStrategy: matchStrategy as MatchStrategy,
    // --- Meta CAPI Parameters (15 fields) ---
    // NOT hashed: FBC, FBP, country, currency, gateway
    fbc: event.fbc,
    fbp: event.fbp,
    currency: event.currency,
    // Hashed: email, phone, firstName, lastName, dateOfBirth, city, state, zip, externalId, facebookLoginId
    emailHash: event.customerEmail ? hashPII(event.customerEmail) : null,
    phoneHash: event.customerPhone ? hashPII(event.customerPhone.replace(/\D/g, '')) : null,
    firstNameHash: event.customerFirstName ? hashPII(event.customerFirstName) : null,
    lastNameHash: event.customerLastName ? hashPII(event.customerLastName) : null,
    dateOfBirthHash: event.customerDateOfBirth ? hashPII(event.customerDateOfBirth) : null,
    cityHash: event.customerCity ? hashPII(event.customerCity) : null,
    stateHash: event.customerState ? hashPII(event.customerState) : null,
    countryCode: event.customerCountry, // NOT hashed (ISO code)
    zipCodeHash: event.customerZipCode ? hashPII(event.customerZipCode) : null,
    externalIdHash: event.customerExternalId ? hashPII(event.customerExternalId) : null,
    facebookLoginId: event.customerFacebookLoginId
      ? hashPII(event.customerFacebookLoginId)
      : null,
    // Required schema fields
    amount: event.amount,
    gateway: gateway as GatewayType,
    gatewayEventId: event.eventId, // Used for unique constraint dedup
  };

  // STEP 4: Persist Conversion (idempotent via unique constraint)
  const createdConversion = await prisma.conversion.create({
    data: conversion,
  });

  // STEP 5: Create MatchLog audit record with detailed strategy tracking
  const processingTimeMs = Math.round(performance.now() - startTime);

  const matchLog = await prisma.matchLog.create({
    data: {
      conversionId: createdConversion.id,
      // FBC strategy tracking
      fbcAttempted: !!event.fbc,
      fbcResult: !event.fbc ? undefined : matchedClickId && matchStrategy === 'fbc' ? 'found' : 'not_found',
      fbcClickId: matchedClickId && matchStrategy === 'fbc' ? matchedClickId : null,
      // FBP strategy tracking
      fbpAttempted: !matchedClickId && !!event.fbp,
      fbpResult:
        !event.fbp || matchedClickId
          ? undefined
          : matchStrategy === 'fbp'
            ? 'found'
            : 'not_found',
      fbpClickId: matchedClickId && matchStrategy === 'fbp' ? matchedClickId : null,
      // Email strategy tracking (for future use in Story 008b)
      emailAttempted: false, // TODO: Story 008b
      emailResult: undefined,
      emailClickId: null,
      // Final result
      finalStrategy: matchStrategy as MatchStrategy,
      finalClickId: matchedClickId || null,
      // Time window for this conversion
      timeWindowStart: windowStart,
      timeWindowEnd: now,
      processingTimeMs,
    },
  });

  // STEP 6: Enqueue to SQS capi-dispatch (Story 009)
  // For now, just log that it would be enqueued
  // TODO: Integrate with SQS in Story 009
  const capiPayloadEnqueued = false;
  console.log(`[MatchEngine] Conversion ${createdConversion.id} ready for CAPI dispatch via SQS`);

  return {
    conversionId: createdConversion.id,
    webhookRawId,
    matchedClickId,
    matchStrategy: matchStrategy as 'fbc' | 'fbp' | 'unmatched',
    matchLogId: matchLog.id,
    capiPayloadEnqueued,
  };
}

/**
 * Process batch of conversions (for parallel processing)
 */
export async function matchConversionsBatch(inputs: ConversionInput[]): Promise<ConversionOutput[]> {
  return Promise.all(inputs.map((input) => matchConversion(input)));
}

/**
 * Get match statistics for monitoring/debugging
 */
export async function getMatchStats(
  tenantId: string,
  since?: Date
): Promise<{
  total: number;
  matched: number;
  matchRate: number;
  byStrategy: Array<{ strategy: MatchStrategy | null; count: number; percentage: number }>;
}> {
  const startDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h default

  // Get conversions for this tenant first
  const conversions = await prisma.conversion.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
      },
    },
    select: { id: true },
  });

  const conversionIds = conversions.map((c: typeof conversions[0]) => c.id);

  const stats = await prisma.matchLog.groupBy({
    by: ['finalStrategy'],
    where: {
      conversionId: {
        in: conversionIds,
      },
    },
    _count: true,
  });

  const total = stats.reduce((sum: number, s) => sum + (s._count || 0), 0);
  const matched = stats
    .filter((s) => s.finalStrategy && s.finalStrategy !== 'unmatched')
    .reduce((sum: number, s) => sum + (s._count || 0), 0);

  return {
    total,
    matched,
    matchRate: total > 0 ? (matched / total) * 100 : 0,
    byStrategy: stats.map((s: typeof stats[0]) => ({
      strategy: s.finalStrategy,
      count: s._count || 0,
      percentage: total > 0 ? ((s._count || 0) / total) * 100 : 0,
    })),
  };
}
