/**
 * Dispatch Queue Worker
 * Long-running process that:
 * 1. Queries for pending conversions (sentToCAPI = false)
 * 2. Sends to Meta CAPI
 * 3. Updates Conversion and DispatchAttempt records
 * 4. Sleeps and repeats
 *
 * Run: node -r esbuild-register dist/jobs/process-dispatch-queue.js
 * Or in docker: npm run worker:dispatch
 */

import { prisma } from '../db.js';
import { dispatchConversionToMeta } from '../services/dispatch-service.js';

const BATCH_SIZE = process.env.DISPATCH_BATCH_SIZE ? parseInt(process.env.DISPATCH_BATCH_SIZE) : 10;
const POLL_INTERVAL_MS = process.env.DISPATCH_POLL_INTERVAL_MS
  ? parseInt(process.env.DISPATCH_POLL_INTERVAL_MS)
  : 5000; // 5 seconds

let isRunning = false;

/**
 * Main worker loop
 */
async function processQueue(): Promise<void> {
  if (isRunning) {
    console.log('[worker] Already processing, skipping cycle');
    return;
  }

  isRunning = true;

  try {
    // 1. Find pending conversions (not yet sent to Meta CAPI)
    const pendingConversions = await prisma.conversion.findMany({
      where: { sentToCAPI: false },
      orderBy: { createdAt: 'asc' }, // Process oldest first
      take: BATCH_SIZE,
    });

    if (pendingConversions.length === 0) {
      console.log('[worker] No pending conversions, idle...');
      isRunning = false;
      return;
    }

    console.log(
      `[worker] Processing ${pendingConversions.length} pending conversion(s)...`
    );

    // 2. Process each conversion
    const results: Array<{ conversionId: string; success: boolean; message: string }> = [];

    for (const conversion of pendingConversions) {
      try {
        const result = await dispatchConversionToMeta(conversion);
        results.push({
          conversionId: conversion.id,
          success: result.success,
          message: result.message,
        });
      } catch (error) {
        console.error(`[worker] Error processing ${conversion.id}:`, error);
        results.push({
          conversionId: conversion.id,
          success: false,
          message: String(error),
        });
      }
    }

    // 3. Log summary
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`[worker] Cycle complete: ${successCount} success, ${failureCount} failed`);

    if (failureCount > 0) {
      console.log('[worker] Failed conversions:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.conversionId}: ${r.message}`);
        });
    }
  } catch (error) {
    console.error('[worker] Fatal error in process cycle:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start worker (runs forever)
 */
async function startWorker(): Promise<void> {
  console.log(
    `[worker] Started dispatch queue worker (batch: ${BATCH_SIZE}, poll: ${POLL_INTERVAL_MS}ms)`
  );

  // Process queue immediately, then on interval
  await processQueue();

  const intervalId = setInterval(async () => {
    await processQueue();
  }, POLL_INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[worker] Received SIGTERM, shutting down gracefully...');
    clearInterval(intervalId);
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[worker] Received SIGINT, shutting down gracefully...');
    clearInterval(intervalId);
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Start if run directly (ES modules)
const isMainModule = process.argv[1]?.includes('process-dispatch-queue');
if (isMainModule) {
  startWorker().catch((error) => {
    console.error('[worker] Fatal startup error:', error);
    process.exit(1);
  });
}

export { startWorker, processQueue };
