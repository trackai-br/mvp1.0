import type { FastifyInstance } from 'fastify';
import {
  getDashboardSummary,
  getConversionTimeseries,
  getDispatchMetrics,
  getMatchRateBreakdown,
  getTopGateways,
  getRecentConversions,
} from '../services/analytics-service.js';

/**
 * Analytics Routes — Dashboard data endpoints
 * All routes require x-tenant-id header
 */

export async function register(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/analytics/summary
   * Dashboard overview with all key metrics
   */
  app.get<{ Querystring: { period?: string; gateway?: string } }>(
    '/api/v1/analytics/summary',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const periodDays = request.query.period ? parseInt(request.query.period) : 30;
      const gateway = request.query.gateway;

      try {
        const summary = await getDashboardSummary(tenantId, periodDays, gateway);
        return reply.send(summary);
      } catch (error) {
        console.error('[analytics] Error in summary endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch summary' });
      }
    }
  );

  /**
   * GET /api/v1/analytics/conversions/timeseries
   * Daily conversions for chart
   */
  app.get<{ Querystring: { period?: string; gateway?: string } }>(
    '/api/v1/analytics/conversions/timeseries',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const periodDays = request.query.period ? parseInt(request.query.period) : 30;
      const gateway = request.query.gateway;

      try {
        const timeseries = await getConversionTimeseries(tenantId, periodDays, gateway);
        return reply.send(timeseries);
      } catch (error) {
        console.error('[analytics] Error in timeseries endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch timeseries' });
      }
    }
  );

  /**
   * GET /api/v1/analytics/dispatch
   * Meta CAPI dispatch success/failure metrics
   */
  app.get<{ Querystring: { period?: string } }>(
    '/api/v1/analytics/dispatch',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const periodDays = request.query.period ? parseInt(request.query.period) : 30;

      try {
        const metrics = await getDispatchMetrics(tenantId, periodDays);
        return reply.send(metrics);
      } catch (error) {
        console.error('[analytics] Error in dispatch endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch dispatch metrics' });
      }
    }
  );

  /**
   * GET /api/v1/analytics/match-rate
   * Match strategy breakdown (FBP vs FBC vs unmatched)
   */
  app.get<{ Querystring: { period?: string } }>(
    '/api/v1/analytics/match-rate',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const periodDays = request.query.period ? parseInt(request.query.period) : 30;

      try {
        const breakdown = await getMatchRateBreakdown(tenantId, periodDays);
        return reply.send(breakdown);
      } catch (error) {
        console.error('[analytics] Error in match-rate endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch match rate' });
      }
    }
  );

  /**
   * GET /api/v1/analytics/gateways/top
   * Top gateways by conversion count
   */
  app.get<{ Querystring: { period?: string; limit?: string } }>(
    '/api/v1/analytics/gateways/top',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const periodDays = request.query.period ? parseInt(request.query.period) : 30;
      const limit = request.query.limit ? parseInt(request.query.limit) : 5;

      try {
        const gateways = await getTopGateways(tenantId, periodDays, limit);
        return reply.send(gateways);
      } catch (error) {
        console.error('[analytics] Error in gateways endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch gateways' });
      }
    }
  );

  /**
   * GET /api/v1/analytics/conversions/recent
   * Recent conversions for table
   */
  app.get<{ Querystring: { limit?: string } }>(
    '/api/v1/analytics/conversions/recent',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'];
      if (!tenantId || typeof tenantId !== 'string') {
        return reply.code(400).send({ error: 'Missing x-tenant-id header' });
      }

      const limit = request.query.limit ? parseInt(request.query.limit) : 10;

      try {
        const recent = await getRecentConversions(tenantId, limit);
        return reply.send(recent);
      } catch (error) {
        console.error('[analytics] Error in recent conversions endpoint:', error);
        return reply.code(500).send({ error: 'Failed to fetch recent conversions' });
      }
    }
  );
}
