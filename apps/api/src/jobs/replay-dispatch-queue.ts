#!/usr/bin/env node

/**
 * Replay Dispatch Queue Worker
 * Background job that periodically retries failed conversions (Story 011)
 *
 * Usage:
 *   node -r esbuild-register dist/jobs/replay-dispatch-queue.js
 *
 * Or via npm script:
 *   npm run worker:replay
 */

import { replayRetryableConversions } from '../services/replay-service.js';

const POLL_INTERVAL_MS = parseInt(process.env.REPLAY_POLL_INTERVAL_MS || '30000', 10);
const BATCH_SIZE = parseInt(process.env.REPLAY_BATCH_SIZE || '50', 10);

let isRunning = true;

/**
 * Main loop: continuously poll and replay retryable conversions
 */
async function startWorker(): Promise<void> {
  console.log('[replay-worker] 🚀 Started');
  console.log(`[replay-worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[replay-worker] Batch size: ${BATCH_SIZE}`);

  while (isRunning) {
    try {
      const stats = await replayRetryableConversions(undefined, BATCH_SIZE);

      if (stats.attemptedCount > 0) {
        console.log(
          `[replay-worker] ✓ Cycle complete: ${stats.successCount}/${stats.attemptedCount} succeeded`
        );
      }
    } catch (err) {
      console.error('[replay-worker] ✗ Error in replay cycle:', err);
    }

    // Wait before next cycle
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Graceful shutdown
 */
function setupShutdownHandlers(): void {
  const signals = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, () => {
      console.log(`[replay-worker] 🛑 Received ${signal}, shutting down gracefully...`);
      isRunning = false;

      // Wait a bit for current operation to complete, then exit
      setTimeout(() => {
        console.log('[replay-worker] 👋 Shutdown complete');
        process.exit(0);
      }, 5000);
    });
  }
}

/**
 * Start the worker
 */
setupShutdownHandlers();
startWorker().catch((err) => {
  console.error('[replay-worker] ✗ Fatal error:', err);
  process.exit(1);
});
