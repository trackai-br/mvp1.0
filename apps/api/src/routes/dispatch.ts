import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { dispatchConversionToMeta, retryStalledConversions } from '../services/dispatch-service.js';
import {
  replayRetryableConversions,
  getFailureAnalysis,
  getFailedConversionsByErrorType,
} from '../services/replay-service.js';

/**
 * Dispatch Routes — Manual trigger + admin endpoints
 * POST /api/v1/admin/dispatch/conversions/{id} — Send single conversion to Meta
 * POST /api/v1/admin/dispatch/retry — Retry failed conversions
 * GET /api/v1/admin/dispatch/status — Queue status
 * GET /api/v1/admin/dispatch/failed-conversions — Failed conversions with error classification (Story 011)
 * GET /api/v1/admin/dispatch/retryable — Conversions ready for retry (Story 011)
 * POST /api/v1/admin/dispatch/retry-retryable — Trigger intelligent replay (Story 011)
 * GET /api/v1/admin/dispatch/export — Export failed conversions as CSV (Story 011)
 */

export async function register(app: FastifyInstance): Promise<void> {
  /**
   * Send a specific conversion to Meta CAPI (by-id)
   */
  app.post<{ Params: { id: string } }>(
    '/api/v1/admin/dispatch/conversions/:id',
    async (request, reply) => {
      const { id } = request.params;

      // Find conversion
      const conversion = await prisma.conversion.findUnique({
        where: { id },
      });

      if (!conversion) {
        return reply.code(404).send({ error: 'Conversion not found' });
      }

      if (conversion.sentToCAPI) {
        return reply.code(400).send({
          error: 'Conversion already sent to Meta CAPI',
          sentAt: conversion.updatedAt,
        });
      }

      // Dispatch
      const result = await dispatchConversionToMeta(conversion);

      return reply.send({
        success: result.success,
        message: result.message,
        retries: result.retries,
      });
    }
  );

  /**
   * Retry all stalled conversions
   */
  app.post<{ Body: { maxAttempts?: number } }>(
    '/api/v1/admin/dispatch/retry',
    async (request, reply) => {
      const maxAttempts = request.body?.maxAttempts ?? 5;

      const successCount = await retryStalledConversions(maxAttempts);

      return reply.send({
        message: 'Retry cycle complete',
        successCount,
        maxAttempts,
      });
    }
  );

  /**
   * Get dispatch queue status
   */
  app.get('/api/v1/admin/dispatch/status', async (request, reply) => {
    // Count pending conversions
    const pendingCount = await prisma.conversion.count({
      where: { sentToCAPI: false },
    });

    // Count successful dispatches
    const successCount = await prisma.conversion.count({
      where: { sentToCAPI: true },
    });

    // Get recent dispatch attempts
    const recentAttempts = await prisma.dispatchAttempt.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Count attempts by status
    const successAttempts = recentAttempts.filter((a) => a.status === 'success').length;
    const failedAttempts = recentAttempts.filter((a) => a.status === 'failed').length;

    return reply.send({
      queue: {
        pending: pendingCount,
        success: successCount,
      },
      recentAttempts: {
        total: recentAttempts.length,
        success: successAttempts,
        failed: failedAttempts,
      },
      lastAttempts: recentAttempts.slice(0, 5).map((a) => ({
        eventId: a.eventId,
        attempt: a.attempt,
        status: a.status,
        error: a.error,
        createdAt: a.createdAt,
      })),
    });
  });

  /**
   * Bulk dispatch conversions by tenant
   */
  app.post<{ Body: { tenantId: string; limit?: number } }>(
    '/api/v1/admin/dispatch/bulk',
    async (request, reply) => {
      const { tenantId, limit = 100 } = request.body;

      // Find pending conversions for tenant
      const conversions = await prisma.conversion.findMany({
        where: {
          tenantId,
          sentToCAPI: false,
        },
        take: limit,
      });

      if (conversions.length === 0) {
        return reply.code(400).send({ error: 'No pending conversions for tenant' });
      }

      const results = [];

      for (const conversion of conversions) {
        const result = await dispatchConversionToMeta(conversion);
        results.push({
          conversionId: conversion.id,
          success: result.success,
          message: result.message,
        });
      }

      const successCount = results.filter((r) => r.success).length;

      return reply.send({
        message: `Dispatched ${successCount}/${results.length} conversions`,
        successCount,
        total: results.length,
        details: results,
      });
    }
  );

  /**
   * Get failed conversions with error classification (Story 011)
   */
  app.get<{
    Querystring: {
      tenantId?: string;
      errorType?: string;
      limit?: string;
    };
  }>('/api/v1/admin/dispatch/failed-conversions', async (request, reply) => {
    const { tenantId, errorType, limit = '20' } = request.query;
    const limitNum = parseInt(limit, 10);

    if (!tenantId) {
      return reply.code(400).send({ error: 'tenantId is required' });
    }

    if (errorType) {
      // Filter by specific error type
      const attempts = await getFailedConversionsByErrorType(
        tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errorType as any,
        limitNum
      );

      return reply.send({
        errorType,
        count: attempts.length,
        conversions: attempts.map((a) => ({
          id: a.id,
          eventId: a.eventId,
          attempt: a.attempt,
          status: a.status,
          errorType: a.errorType,
          error: a.error,
          httpStatusCode: a.httpStatusCode,
          isRetryable: a.isRetryable,
          maxRetriesExceeded: a.maxRetriesExceeded,
          createdAt: a.createdAt,
        })),
      });
    }

    // Get all failed attempts for tenant
    const failedAttempts = await prisma.dispatchAttempt.findMany({
      where: {
        tenantId,
        status: 'failed',
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    });

    return reply.send({
      count: failedAttempts.length,
      conversions: failedAttempts.map((a) => ({
        id: a.id,
        eventId: a.eventId,
        attempt: a.attempt,
        status: a.status,
        errorType: a.errorType,
        error: a.error,
        httpStatusCode: a.httpStatusCode,
        isRetryable: a.isRetryable,
        maxRetriesExceeded: a.maxRetriesExceeded,
        createdAt: a.createdAt,
      })),
    });
  });

  /**
   * Get conversions ready for intelligent retry (Story 011)
   */
  app.get<{ Querystring: { tenantId?: string } }>(
    '/api/v1/admin/dispatch/retryable',
    async (request, reply) => {
      const { tenantId } = request.query;

      if (!tenantId) {
        return reply.code(400).send({ error: 'tenantId is required' });
      }

      // Find retryable conversions whose backoff window has passed
      const retryableConversions = await prisma.dispatchAttempt.findMany({
        where: {
          tenantId,
          isRetryable: true,
          nextRetryAt: {
            lte: new Date(), // Backoff window has passed
          },
          maxRetriesExceeded: false,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      return reply.send({
        readyCount: retryableConversions.length,
        retryable: retryableConversions.map((a) => ({
          id: a.id,
          eventId: a.eventId,
          attempt: a.attempt,
          errorType: a.errorType,
          nextRetryAt: a.nextRetryAt,
          createdAt: a.createdAt,
        })),
      });
    }
  );

  /**
   * Trigger intelligent replay for retryable conversions (Story 011)
   */
  app.post<{ Body: { tenantId?: string; limit?: number } }>(
    '/api/v1/admin/dispatch/retry-retryable',
    async (request, reply) => {
      const { tenantId, limit = 50 } = request.body;

      if (!tenantId) {
        return reply.code(400).send({ error: 'tenantId is required' });
      }

      const stats = await replayRetryableConversions(tenantId, limit);

      return reply.send({
        message: 'Replay cycle complete',
        stats,
      });
    }
  );

  /**
   * Get failure analysis summary (Story 011)
   */
  app.get<{ Querystring: { tenantId?: string; period?: string } }>(
    '/api/v1/admin/dispatch/failure-analysis',
    async (request, reply) => {
      const { tenantId, period = '30' } = request.query;

      if (!tenantId) {
        return reply.code(400).send({ error: 'tenantId is required' });
      }

      const periodDays = parseInt(period, 10) || 30;
      const analysis = await getFailureAnalysis(tenantId, periodDays);

      return reply.send({
        period: `${periodDays}d`,
        ...analysis,
      });
    }
  );

  /**
   * Export failed conversions as CSV (Story 011)
   */
  app.get<{
    Querystring: {
      tenantId?: string;
      period?: string;
      errorType?: string;
    };
  }>('/api/v1/admin/dispatch/export', async (request, reply) => {
    const { tenantId, period = '7d', errorType } = request.query;

    if (!tenantId) {
      return reply.code(400).send({ error: 'tenantId is required' });
    }

    // Parse period (e.g., "7d" → 7 days)
    const periodDays = parseInt(period.replace('d', ''), 10) || 7;

    // Get failed attempts (optionally filtered by error type)
    const failedAttempts = await prisma.dispatchAttempt.findMany({
      where: {
        tenantId,
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(errorType && { errorType: errorType as any }),
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const csvHeaders = [
      'Event ID',
      'Attempt',
      'Status',
      'Error Type',
      'Error Message',
      'HTTP Status',
      'Retryable',
      'Max Retries Exceeded',
      'Next Retry At',
      'Created At',
    ];
    const csvRows = failedAttempts.map((a) => [
      a.eventId,
      a.attempt.toString(),
      a.status,
      a.errorType || 'unknown',
      a.error || 'N/A',
      a.httpStatusCode ? a.httpStatusCode.toString() : 'N/A',
      a.isRetryable ? 'yes' : 'no',
      a.maxRetriesExceeded ? 'yes' : 'no',
      a.nextRetryAt ? a.nextRetryAt.toISOString() : 'N/A',
      a.createdAt.toISOString(),
    ]);

    const csv = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Return as file download
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="failed-conversions-${tenantId}-${new Date().toISOString().split('T')[0]}.csv"`
      )
      .send(csv);
  });
}
