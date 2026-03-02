import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { dispatchConversionToMeta, retryStalledConversions } from '../services/dispatch-service.js';

/**
 * Dispatch Routes — Manual trigger + admin endpoints
 * POST /api/v1/admin/dispatch/conversions/{id} — Send single conversion to Meta
 * POST /api/v1/admin/dispatch/retry — Retry failed conversions
 * GET /api/v1/admin/dispatch/status — Queue status
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
}
