import crypto from 'node:crypto';
import { prisma } from './db.js';

/**
 * Matching Engine (Story 007)
 * Correlate webhook conversions with previously captured clicks
 *
 * Current matching strategy: FBP (Facebook Pixel ID) primary
 * Future: Support email/phone via session context
 */

export interface MatchingResult {
  success: boolean;
  conversionId?: string;
  matchedClickId?: string;
  matchScore?: number;
  matchStrategy?: 'fbp' | 'fbc' | 'none';
  reason?: string;
}

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Match a conversion webhook to a previously captured click
 *
 * Scoring algorithm:
 * - FBP match (Pixel ID): 70 points (best signal of same user)
 * - FBC match (Container ID): 50 points
 * - Time decay: -1 point per day (older clicks score lower)
 * - Minimum threshold: 50 points
 */
export async function matchConversionToClick(
  tenantId: string,
  conversion: {
    fbp?: string;
    fbc?: string;
  }
): Promise<MatchingResult> {
  try {
    // 1. Validate we have matching data
    if (!conversion.fbp && !conversion.fbc) {
      return {
        success: false,
        reason: 'no_matching_data',
      };
    }

    // 2. Find potential click matches (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const potentialClicks = await prisma.click.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          // FBP match (best signal)
          conversion.fbp ? { fbp: conversion.fbp } : undefined,
          // FBC match (fallback)
          conversion.fbc ? { fbc: conversion.fbc } : undefined,
        ].filter(Boolean) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (potentialClicks.length === 0) {
      return {
        success: false,
        reason: 'no_matching_clicks_found',
      };
    }

    // 3. Score each candidate
    interface MatchCandidate {
      clickId: string;
      score: number;
      strategy: 'fbp' | 'fbc';
    }

    let bestMatch: MatchCandidate | null = null;

    for (const click of potentialClicks) {
      let score = 0;
      let strategy: 'fbp' | 'fbc' | null = null;

      // FBP match: 70 points (most reliable)
      if (conversion.fbp && click.fbp === conversion.fbp) {
        score = 70;
        strategy = 'fbp';
      }
      // FBC match: 50 points (less reliable but valid)
      else if (conversion.fbc && click.fbc === conversion.fbc) {
        score = 50;
        strategy = 'fbc';
      }

      if (!strategy) continue;

      // Time decay: -1 point per day
      const daysSinceClick = (Date.now() - click.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      score -= daysSinceClick;

      // Keep best match above threshold (50 points)
      if (score >= 50 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { clickId: click.id, score, strategy };
      }
    }

    if (bestMatch) {
      return {
        success: true,
        matchedClickId: bestMatch.clickId,
        matchScore: Math.round(bestMatch.score),
        matchStrategy: bestMatch.strategy,
      };
    }

    return {
      success: false,
      reason: 'no_match_above_threshold',
    };
  } catch (error) {
    console.error(`[matching-engine] Error matching conversion for tenant ${tenantId}:`, error);
    return {
      success: false,
      reason: 'matching_engine_error',
    };
  }
}

/**
 * Process a conversion webhook through the matching engine
 * Called after webhook validation and deduplication
 */
export async function processConversionWebhook(
  tenantId: string,
  webhookRawId: string,
  gateway: string,
  gatewayEventId: string,
  conversionData: {
    email?: string;
    phone?: string;
    fbp?: string;
    fbc?: string;
    amount?: number;
    currency?: string;
  }
): Promise<MatchingResult & { conversionId?: string }> {
  try {
    // 1. Run matching algorithm (FBP/FBC based)
    const matchResult = await matchConversionToClick(tenantId, {
      fbp: conversionData.fbp,
      fbc: conversionData.fbc,
    });

    // 2. Create Conversion record regardless of match (for audit trail)
    const emailHash = conversionData.email
      ? sha256hex(conversionData.email.toLowerCase().trim())
      : undefined;

    const phoneHash = conversionData.phone
      ? sha256hex(conversionData.phone.replace(/\D/g, ''))
      : undefined;

    const conversion = await prisma.conversion.create({
      data: {
        tenantId,
        webhookRawId,
        gateway: gateway as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        gatewayEventId,
        matchedClickId: matchResult.matchedClickId,
        matchStrategy: (matchResult.matchStrategy || 'none') as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        amount: conversionData.amount,
        currency: conversionData.currency || 'BRL',
        emailHash,
        phoneHash,
        fbp: conversionData.fbp,
        fbc: conversionData.fbc,
      },
    });

    if (matchResult.success && matchResult.matchedClickId) {
      console.log(
        `[matching-engine] ✓ Conversion matched to click ${matchResult.matchedClickId} (score: ${matchResult.matchScore}, strategy: ${matchResult.matchStrategy})`
      );
    } else {
      console.log(
        `[matching-engine] ⚠️ Conversion created but not matched to click (reason: ${matchResult.reason})`
      );
    }

    return {
      success: true,
      conversionId: conversion.id,
      matchedClickId: matchResult.matchedClickId,
      matchScore: matchResult.matchScore,
      matchStrategy: matchResult.matchStrategy,
    };
  } catch (error) {
    console.error(
      `[matching-engine] Error processing conversion webhook for tenant ${tenantId}:`,
      error
    );
    return {
      success: false,
      reason: 'conversion_creation_error',
    };
  }
}
