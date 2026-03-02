import type { ErrorType } from '@prisma/client';
import { prisma } from '../db.js';
import { dispatchConversionToMeta } from './dispatch-service.js';

/**
 * Replay Service — Story 011
 * Intelligently retry failed conversions based on error type and backoff schedule
 */

export interface ReplayStats {
  totalRetryable: number;
  attemptedCount: number;
  successCount: number;
  failedCount: number;
}

/**
 * Replay conversions that are marked as retryable and have passed their backoff window
 * This is called by the replay worker (every 30s) or manually by admin endpoint
 */
export async function replayRetryableConversions(
  tenantId?: string,
  limit: number = 50
): Promise<ReplayStats> {
  // Find conversions with retryable errors whose backoff window has passed
  const retryableConversions = await prisma.dispatchAttempt.findMany({
    where: {
      isRetryable: true,
      nextRetryAt: {
        lte: new Date(), // Backoff window has passed
      },
      maxRetriesExceeded: false,
      ...(tenantId && { tenantId }),
    },
    include: {
      tenant: true,
    },
    orderBy: {
      createdAt: 'asc', // Oldest first (FIFO)
    },
    take: limit,
  });

  let successCount = 0;
  let failedCount = 0;

  for (const attempt of retryableConversions) {
    // Find the conversion associated with this attempt
    const conversion = await prisma.conversion.findFirst({
      where: {
        tenantId: attempt.tenantId,
        gatewayEventId: attempt.eventId,
      },
    });

    if (!conversion) {
      console.log(
        `[replay] ⚠️ Conversion not found for attempt ${attempt.id}, skipping`
      );
      failedCount++;
      continue;
    }

    // Skip if already sent to CAPI
    if (conversion.sentToCAPI) {
      console.log(
        `[replay] ⏭️  Conversion ${conversion.id} already sent to CAPI, skipping`
      );
      continue;
    }

    try {
      // Attempt to dispatch
      const result = await dispatchConversionToMeta(conversion);

      if (result.success) {
        console.log(
          `[replay] ✓ Successfully replayed conversion ${conversion.id} (event: ${attempt.eventId})`
        );
        successCount++;
      } else {
        console.log(
          `[replay] ✗ Replay failed for ${conversion.id}: ${result.message}`
        );
        failedCount++;
      }
    } catch (err) {
      console.error(
        `[replay] ✗ Unexpected error replaying ${conversion.id}:`,
        err
      );
      failedCount++;
    }
  }

  console.log(
    `[replay] Summary: ${successCount}/${retryableConversions.length} succeeded`
  );

  return {
    totalRetryable: retryableConversions.length,
    attemptedCount: retryableConversions.length,
    successCount,
    failedCount,
  };
}

/**
 * Get summary statistics for failed conversions analysis
 */
export async function getFailureAnalysis(
  tenantId: string,
  periodDays: number = 30
) {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const failedAttempts = await prisma.dispatchAttempt.findMany({
    where: {
      tenantId,
      status: 'failed',
      createdAt: { gte: startDate },
    },
  });

  const retryableCount = failedAttempts.filter((a) => a.isRetryable).length;
  const notRetryableCount = failedAttempts.filter((a) => !a.isRetryable).length;

  // Group by error type
  const byErrorType: Record<string, number> = {};
  for (const attempt of failedAttempts) {
    if (attempt.errorType) {
      byErrorType[attempt.errorType] =
        (byErrorType[attempt.errorType] || 0) + 1;
    }
  }

  // Find most recent failure
  const lastFailure = failedAttempts.length
    ? new Date(
        Math.max(
          ...failedAttempts.map((a) => a.createdAt.getTime())
        )
      )
    : null;

  return {
    totalFailed: failedAttempts.length,
    retryable: retryableCount,
    notRetryable: notRetryableCount,
    byErrorType,
    lastFailure,
  };
}

/**
 * Get conversions that failed with specific error type (for filtering in dashboard)
 */
export async function getFailedConversionsByErrorType(
  tenantId: string,
  errorType: ErrorType,
  limit: number = 20
) {
  const attempts = await prisma.dispatchAttempt.findMany({
    where: {
      tenantId,
      errorType,
      status: 'failed',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return attempts;
}
