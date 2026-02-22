/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Analytics Routes — Story 010: Dashboard Operacional
 *
 * Endpoints for operational dashboard:
 * - GET /api/v1/analytics/metrics — KPIs agregados
 * - GET /api/v1/analytics/events — Eventos paginados
 * - GET /api/v1/analytics/dispatch-attempts — Tentativas CAPI
 * - GET /api/v1/analytics/match-rate — Taxa de matching
 * - GET /api/v1/analytics/performance — Latência percentis
 * - GET /api/v1/analytics/export/{format} — CSV/JSON export
 *
 * All queries scoped by tenant_id via JWT auth
 * All responses redacted (no PII: email/phone hashes)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

/**
 * Query validation schemas
 */
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/**
 * Helper: Get date range from period
 */
function getDateRange(period: string, customStart?: string, customEnd?: string) {
  const end = new Date();
  let start = new Date();

  switch(period) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case 'custom':
      if(customStart) start = new Date(customStart);
      if(customEnd) end.setTime(new Date(customEnd).getTime());
      break;
  }

  return { start, end };
}

/**
 * Helper: Mask PII from responses
 */
function maskPII(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return obj;

  const masked = { ...obj };

  // Remove or mask sensitive fields
  if ('email_hash' in masked) delete masked.email_hash;
  if ('phone_hash' in masked) delete masked.phone_hash;
  if ('first_name_hash' in masked) delete masked.first_name_hash;
  if ('last_name_hash' in masked) delete masked.last_name_hash;

  return masked;
}

/**
 * Helper: Log audit trail
 */
// Audit logging disabled - auditLog table not in schema (TODO: create in migration)
// async function logAudit(
//   tenantId: string,
//   userId: string | undefined,
//   action: string,
//   resource: string,
//   queryParams?: Record<string, unknown>
// ) {
//   try {
//     await prisma.auditLog.create({
//       data: {
//         tenant_id: tenantId,
//         user_id: userId,
//         action,
//         resource,
//         query_params: queryParams ? JSON.stringify(queryParams) : null,
//       },
//     });
//   } catch (error) {
//     console.error('Audit log failed:', error);
//     // Don't block request if audit fails
//   }
// }

/**
 * GET /api/v1/analytics/metrics
 * Returns: KPIs aggregados (total eventos, sucesso %, match rate, latência p95, DLQ backlog, uptime)
 * Cache: 30s
 */
async function getMetrics(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const period = (request.query as any).period as string || '24h';
  const customStart = (request.query as any).start_date as string;
  const customEnd = (request.query as any).end_date as string;

  const { start, end } = getDateRange(period, customStart, customEnd);

  try {
    interface DispatchMetric {
      total_events: number;
      success_count: number;
      failed_count: number;
      dlq_count: number;
      latency_p95: number;
    }
    interface MatchRateMetric {
      match_rate: number;
    }

    // Query: Dispatch summary from v_dispatch_summary view
    const dispatchData = await prisma.$queryRaw<DispatchMetric[]>`
      SELECT
        COALESCE(SUM(total_attempts), 0) as total_events,
        COALESCE(SUM(success_count), 0) as success_count,
        COALESCE(SUM(failed_count), 0) as failed_count,
        COALESCE(SUM(dlq_count), 0) as dlq_count,
        COALESCE(AVG(latency_p95), 0)::int as latency_p95
      FROM v_dispatch_summary
      WHERE tenant_id = ${tenantId}::uuid
        AND date >= ${start.toISOString().split('T')[0]}::date
        AND date <= ${end.toISOString().split('T')[0]}::date
    `;

    // Query: Match rate from v_match_rate_by_tenant
    const matchRateData = await prisma.$queryRaw<MatchRateMetric[]>`
      SELECT
        COALESCE(AVG(match_rate_pct), 0)::numeric(5,2) as match_rate
      FROM v_match_rate_by_tenant
      WHERE tenant_id = ${tenantId}::uuid
        AND date >= ${start.toISOString().split('T')[0]}::date
    `;

    // Query: Uptime (assume 99.9% if we have recent data)
    const hasRecentData = await prisma.dispatchAttempt.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 3600000) }, // last hour
      },
    });
    const uptime = hasRecentData > 0 ? 99.9 : 0;

    const metrics = {
      period,
      total_events: Number(dispatchData[0]?.total_events || 0),
      success_rate_pct: dispatchData[0]?.total_events > 0
        ? (Number(dispatchData[0]?.success_count) / Number(dispatchData[0]?.total_events) * 100).toFixed(2)
        : 0,
      match_rate_pct: matchRateData[0]?.match_rate || 0,
      latency_p95_ms: Number(dispatchData[0]?.latency_p95 || 0),
      dlq_backlog: Number(dispatchData[0]?.dlq_count || 0),
      uptime_pct: uptime,
    };

    // await logAudit(tenantId, (request as any).user.id, 'GET', '/analytics/metrics', { period });
    reply.header('Cache-Control', 'public, max-age=30');
    return reply.send(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return reply.code(500).send({ error: 'Failed to fetch metrics' });
  }
}

/**
 * GET /api/v1/analytics/events
 * Returns: Eventos paginados com filtros (status, gateway, período)
 */
async function getEvents(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const pageSchema = PaginationSchema.parse(request.query);
  const period = ((request.query as any).period as string) || '7d';
  const status = (request.query as any).status as string;
  const searchId = (request.query as any).search_id as string;

  const { start, end } = getDateRange(period);
  const skip = (pageSchema.page - 1) * pageSchema.limit;

  try {
    const where: Record<string, unknown> = {
      tenantId,
      createdAt: { gte: start, lte: end },
    };

    if (status) where.status = status as any;
    if (searchId) where.eventId = { contains: searchId };

    const [events, total] = await Promise.all([
      prisma.dispatchAttempt.findMany({
        where,
        select: {
          id: true,
          eventId: true,
          status: true,
          error: true,
          createdAt: true,
          attempt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: pageSchema.limit,
        skip,
      }),
      prisma.dispatchAttempt.count({ where }),
    ]);

    const masked = events.map((e: any) => maskPII(e as unknown as Record<string, unknown>));

    // await logAudit(tenantId, (request as any).user.id, 'GET', '/analytics/events', {
    //   page: pageSchema.page,
    //   limit: pageSchema.limit,
    //   status,
    //   gateway,
    // });

    return reply.send({
      data: masked,
      pagination: {
        page: pageSchema.page,
        limit: pageSchema.limit,
        total,
        pages: Math.ceil(total / pageSchema.limit),
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return reply.code(500).send({ error: 'Failed to fetch events' });
  }
}

/**
 * GET /api/v1/analytics/dispatch-attempts
 * Returns: Tentativas CAPI com status e erros (para troubleshooting)
 */
async function getDispatchAttempts(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const pageSchema = PaginationSchema.parse(request.query);
  const status = ((request.query as any).status as string) || 'failed';

  const skip = (pageSchema.page - 1) * pageSchema.limit;

  try {
    const [attempts, total] = await Promise.all([
      prisma.dispatchAttempt.findMany({
        where: {
          tenantId,
          status: status as any,
        },
        select: {
          id: true,
          attempt: true,
          status: true,
          error: true,
          eventId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: pageSchema.limit,
        skip,
      }),
      prisma.dispatchAttempt.count({
        where: { tenantId, status: status as any },
      }),
    ]);

    // await logAudit(tenantId, (request as any).user.id, 'GET', '/analytics/dispatch-attempts', { status });

    return reply.send({
      data: attempts,
      pagination: {
        page: pageSchema.page,
        limit: pageSchema.limit,
        total,
        pages: Math.ceil(total / pageSchema.limit),
      },
    });
  } catch (error) {
    console.error('Error fetching dispatch attempts:', error);
    return reply.code(500).send({ error: 'Failed to fetch dispatch attempts' });
  }
}

/**
 * GET /api/v1/analytics/match-rate
 * Returns: Taxa de matching por tenant/gateway com trending
 */
async function getMatchRate(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const period = ((request.query as any).period as string) || '30d';
  const gateway = (request.query as any).gateway as string;

  const { start, end } = getDateRange(period);

  try {
    let query = `
      SELECT
        date,
        total_conversions,
        matched_conversions,
        match_rate_pct
      FROM v_match_rate_by_tenant
      WHERE tenant_id = ${tenantId}::uuid
        AND date >= ${start.toISOString().split('T')[0]}::date
        AND date <= ${end.toISOString().split('T')[0]}::date
    `;

    if (gateway) {
      query += ` AND gateway = '${gateway}'`;
    }

    query += ` ORDER BY date DESC`;

    interface MatchRateTrend { date: string; match_rate_pct: number }
    const matchRate = await prisma.$queryRaw<MatchRateTrend[]>(query as any);

    // await logAudit(tenantId, (request as any).user.id, 'GET', '/analytics/match-rate', { period, gateway });

    return reply.send({
      period,
      gateway: gateway || 'all',
      data: matchRate,
    });
  } catch (error) {
    console.error('Error fetching match rate:', error);
    return reply.code(500).send({ error: 'Failed to fetch match rate' });
  }
}

/**
 * GET /api/v1/analytics/performance
 * Returns: Latência percentis (p50, p95, p99) + throughput
 */
async function getPerformance(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const period = ((request.query as any).period as string) || '7d';

  const { start, end } = getDateRange(period);

  try {
    interface PerformanceMetric {
      date: string;
      latency_p50: number;
      latency_p95: number;
      latency_p99: number;
      throughput_events: number;
      max_latency: number;
    }
    const performance = await prisma.$queryRaw<PerformanceMetric[]>`
      SELECT
        DATE(created_at) as date,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as latency_p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as latency_p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as latency_p99,
        COUNT(*) as throughput_events,
        MAX(latency_ms) as max_latency
      FROM dispatch_attempts
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // await logAudit(tenantId, (request as any).user.id, 'GET', '/analytics/performance', { period });

    return reply.send({
      period,
      data: performance,
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return reply.code(500).send({ error: 'Failed to fetch performance data' });
  }
}

/**
 * GET /api/v1/analytics/export/{format}
 * Returns: CSV or JSON export for selected period
 */
async function exportData(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = ((request as any).user.tenantId || (request as any).user.tenant_id) as string;
  const format = (request.params as { format: string }).format as 'csv' | 'json';
  const period = ((request.query as any).period as string) || '30d';

  if (!['csv', 'json'].includes(format)) {
    return reply.code(400).send({ error: 'Format must be csv or json' });
  }

  const { start, end } = getDateRange(period);

  try {
    // Limit to max 30 days to prevent large exports
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      return reply.code(400).send({ error: 'Export period limited to 30 days' });
    }

    const events = await prisma.dispatchAttempt.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        eventId: true,
        status: true,
        error: true,
        attempt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString()}.json"`);
      return reply.send(events);
    }

    // CSV format
    if (events.length === 0) {
      return reply.code(204).send();
    }

    const headers = Object.keys(events[0]).join(',');
    const rows = events.map((e: any) => Object.values(e).map((v: any) =>
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
    ).join(','));

    const csv = [headers, ...rows].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString()}.csv"`);
    return reply.send(csv);
  } catch (error) {
    console.error('Error exporting data:', (error as Error).message);
    return reply.code(500).send({ error: 'Failed to export data' });
  }
}

/**
 * Register all analytics routes
 */
export async function register(app: FastifyInstance) {
  // All routes require authentication (fastify-jwt plugin)

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/metrics',
    { onRequest: [(app as any).authenticate] },
    getMetrics
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/events',
    { onRequest: [(app as any).authenticate] },
    getEvents
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/dispatch-attempts',
    { onRequest: [(app as any).authenticate] },
    getDispatchAttempts
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/match-rate',
    { onRequest: [(app as any).authenticate] },
    getMatchRate
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/performance',
    { onRequest: [(app as any).authenticate] },
    getPerformance
  );

  app.get<{ Params: { format: string }; Querystring: Record<string, unknown> }>(
    '/api/v1/analytics/export/:format',
    { onRequest: [(app as any).authenticate] },
    exportData
  );
}
