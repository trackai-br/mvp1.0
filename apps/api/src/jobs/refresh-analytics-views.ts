/**
 * Story 011g-b: Analytics Views Refresh Job
 * Refreshes materialized views every 5 minutes for dashboard queries
 *
 * Usage:
 * - Import and call startAnalyticsRefreshJob() in server bootstrap
 * - Runs indefinitely until stopAnalyticsRefreshJob() is called
 */

import { prisma } from '../db.js';

let refreshInterval: ReturnType<typeof setInterval> | null = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VIEWS_TO_REFRESH = ['v_dispatch_summary', 'v_match_rate_by_tenant'];

export async function refreshMaterializedViews(): Promise<void> {
  try {
    console.log(`[Analytics] Refreshing materialized views at ${new Date().toISOString()}`);

    for (const viewName of VIEWS_TO_REFRESH) {
      try {
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
        console.log(`[Analytics] ✓ Refreshed ${viewName}`);

        // Update refresh timestamp
        await prisma.$executeRawUnsafe(
          `UPDATE materialized_view_refresh SET last_refreshed_at = NOW() WHERE view_name = $1`,
          [viewName]
        );
      } catch (err) {
        console.error(`[Analytics] ✗ Failed to refresh ${viewName}:`, err);
        // Continue with other views even if one fails
      }
    }

    console.log(`[Analytics] View refresh completed at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[Analytics] View refresh job error:', err);
  }
}

export function startAnalyticsRefreshJob(): void {
  if (refreshInterval !== null) {
    console.warn('[Analytics] Refresh job already running');
    return;
  }

  console.log('[Analytics] Starting analytics refresh job (5 min interval)');

  // Initial refresh on start
  refreshMaterializedViews();

  // Schedule recurring refresh
  refreshInterval = setInterval(refreshMaterializedViews, REFRESH_INTERVAL_MS);
}

export function stopAnalyticsRefreshJob(): void {
  if (refreshInterval !== null) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[Analytics] Analytics refresh job stopped');
  }
}

/**
 * Manual refresh trigger (useful for forcing immediate refresh after bulk imports)
 */
export async function forceRefreshViews(): Promise<void> {
  console.log('[Analytics] Force refreshing materialized views...');
  await refreshMaterializedViews();
}
