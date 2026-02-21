import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { register as registerAnalyticsRoutes } from '../analytics';

describe('Analytics Routes (Story 010)', () => {
  let app: FastifyInstance;
  const tenantId = 'test-tenant-010';
  const headers = { 'x-tenant-id': tenantId };

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerAnalyticsRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/analytics/metrics', () => {
    it('should return KPI metrics for the period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/metrics?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('total_events');
      expect(body).toHaveProperty('success_rate_pct');
      expect(body).toHaveProperty('match_rate_pct');
      expect(body).toHaveProperty('latency_p95_ms');
      expect(body).toHaveProperty('dlq_backlog');
      expect(body).toHaveProperty('uptime_pct');
    });

    it('should cache metrics for 30 seconds', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/metrics?period=7d',
        headers,
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/metrics?period=7d',
        headers,
      });

      expect(response1.payload).toBe(response2.payload);
    });

    it('should validate period parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/metrics?period=invalid',
        headers,
      });

      expect([400, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/analytics/events', () => {
    it('should return paginated events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/events?period=7d&page=1&limit=50',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body).toHaveProperty('pagination');
    });

    it('should filter events by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/events?period=7d&page=1&limit=50&status=sent',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as { data?: Array<{ status: string }> };
      body.data?.forEach((event) => {
        expect(event.status).toBe('sent');
      });
    });

    it('should mask PII in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/events?period=7d&page=1&limit=50',
        headers,
      });

      expect(response.statusCode).toBe(200);
      interface EventData { email?: string }
      const body = JSON.parse(response.payload) as { data?: EventData[] };
      body.data?.forEach((event) => {
        if (event.email) {
          expect(event.email).toMatch(/^\*+@.+\*+$/);
        }
      });
    });
  });

  describe('GET /api/v1/analytics/match-rate', () => {
    it('should return match rate trend data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/match-rate?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should support gateway filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/match-rate?period=7d&gateway=facebook',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/performance', () => {
    it('should return latency and throughput metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/performance?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should include latency percentiles', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/performance?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      interface PerformanceMetric { latency_p50?: number; latency_p95?: number; latency_p99?: number }
      const body = JSON.parse(response.payload) as { data?: PerformanceMetric[] };
      body.data?.forEach((metric) => {
        expect(metric).toHaveProperty('latency_p50');
        expect(metric).toHaveProperty('latency_p95');
        expect(metric).toHaveProperty('latency_p99');
      });
    });
  });

  describe('GET /api/v1/analytics/export/{format}', () => {
    it('should export data as CSV', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/export/csv?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/csv/);
    });

    it('should export data as JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/export/json?period=7d',
        headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should enforce 30-day limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/export/csv?period=90d',
        headers,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require tenant authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/export/csv?period=7d',
        headers: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Security & Audit', () => {
    it('should require x-tenant-id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/metrics?period=7d',
        headers: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should scope queries to tenant only', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/events?period=7d&page=1&limit=10',
        headers: { 'x-tenant-id': 'tenant-a' },
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/events?period=7d&page=1&limit=10',
        headers: { 'x-tenant-id': 'tenant-b' },
      });

      // Both should return 200, but data should be different (tenant-scoped)
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      // Verify payloads are different (tenant-scoped)
      expect(response1.payload).not.toBe(response2.payload);
    });
  });
});
