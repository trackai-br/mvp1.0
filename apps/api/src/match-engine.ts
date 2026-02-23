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
 * Match window: 72 hours in milliseconds
 * Clicks older than this window will not be matched to conversions.
 */
const MATCH_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Execute matching logic on an existing Conversion.
 * Assumes Conversion already exists (created by webhook-router).
 * This function:
 * 1. Finds the Conversion by webhookRawId
 * 2. Attempts to match it with Clicks (FBC → FBP → Unmatched)
 * 3. Updates Conversion with match results
 * 4. Creates MatchLog for audit trail
 * 5. Returns ConversionOutput for SQS dispatch (Story 009)
 */
export async function matchConversion(input: ConversionInput): Promise<ConversionOutput> {
  const { tenantId, gateway, webhookRawId, event } = input;
  const startTime = performance.now(); // Measure processing time

  if (!event.eventId) {
    throw new Error('ConversionEvent eventId is required');
  }

  // STEP 1: Fetch existing Conversion (created by webhook-router)
  const conversion = await prisma.conversion.findFirst({
    where: {
      tenantId,
      webhookRawId,
      gateway: gateway as GatewayType,
    },
  });

  if (!conversion) {
    throw new Error(`Conversion not found for webhookRawId: ${webhookRawId}`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - MATCH_WINDOW_MS);

  let matchedClickId: string | undefined;
  let matchStrategy: MatchStrategy = 'unmatched';
  let fbcAttempted = false;
  let fbcResult: string | undefined;
  let fbcClickId: string | null = null;
  let fbpAttempted = false;
  let fbpResult: string | undefined;
  let fbpClickId: string | null = null;

  // STEP 2: Try FBC matching (primary strategy)
  if (conversion.fbc) {
    fbcAttempted = true;
    const fbcMatch = await prisma.click.findFirst({
      where: {
        tenantId,
        fbc: conversion.fbc,
        createdAt: {
          gte: windowStart,
          lte: now,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' }, // Most recent click
    });

    if (fbcMatch) {
      fbcResult = 'found';
      fbcClickId = fbcMatch.id;
      matchedClickId = fbcMatch.id;
      matchStrategy = 'fbc';
    } else {
      fbcResult = 'not_found';
    }
  }

  // STEP 3: Try FBP matching (fallback if no FBC match)
  if (!matchedClickId && conversion.fbp) {
    fbpAttempted = true;
    const fbpMatch = await prisma.click.findFirst({
      where: {
        tenantId,
        fbp: conversion.fbp,
        createdAt: {
          gte: windowStart,
          lte: now,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' }, // Most recent click
    });

    if (fbpMatch) {
      fbpResult = 'found';
      fbpClickId = fbpMatch.id;
      matchedClickId = fbpMatch.id;
      matchStrategy = 'fbp';
    } else {
      fbpResult = 'not_found';
    }
  }

  // STEP 4: Update Conversion with match results
  await prisma.conversion.update({
    where: { id: conversion.id },
    data: {
      matchedClickId,
      matchStrategy: matchStrategy !== 'unmatched' ? matchStrategy : undefined,
    },
  });

  // STEP 5: Create MatchLog audit record with detailed strategy tracking
  const processingTimeMs = Math.round(performance.now() - startTime);

  const matchLog = await prisma.matchLog.create({
    data: {
      conversionId: conversion.id,
      // FBC strategy tracking
      fbcAttempted,
      fbcResult,
      fbcClickId,
      // FBP strategy tracking
      fbpAttempted,
      fbpResult,
      fbpClickId,
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

  // STEP 6: Log match result
  if (matchedClickId) {
    console.log(`✓ Match successful: conversion_id=${conversion.id} strategy=${matchStrategy} matched_click_id=${matchedClickId}`);
  } else {
    console.log(`⚠ No match found: conversion_id=${conversion.id}`);
  }

  // STEP 7: Ready for SQS dispatch (Story 009)
  // TODO: Integrate with SQS in Story 009
  const capiPayloadEnqueued = false;

  return {
    conversionId: conversion.id,
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
