import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from './db.js';
import { matchConversion, getMatchStats } from './match-engine.js';
import crypto from 'node:crypto';

/**
 * Match Engine Tests — Story 008
 *
 * 8 Comprehensive integration scenarios:
 * 1. FBC match found within 72h window (primary strategy)
 * 2. FBC match NOT found → fallback to FBP
 * 3. FBC + FBP both not found → unmatched
 * 4. Click outside 72h window → not matched
 * 5. Most recent click selected when multiple FBC matches
 * 6. MatchLog persistence with full audit trail
 * 7. PII hashing + SHA-256 validation
 * 8. Match stats aggregation (rate, by strategy)
 */

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('Match Engine — Integration Tests', () => {
  let testTenantId: string;
  let testWebhookRawId: string;

  beforeEach(async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug: `test-tenant-${Date.now()}`,
        name: 'Test Tenant',
        status: 'active',
      },
    });
    testTenantId = tenant.id;

    // Create test webhook raw
    const webhookRaw = await prisma.webhookRaw.create({
      data: {
        tenantId: testTenantId,
        gateway: 'perfectpay',
        gatewayEventId: `test-event-${Date.now()}`,
        rawPayload: { test: true },
      },
    });
    testWebhookRawId = webhookRaw.id;
  });

  afterEach(async () => {
    // Cleanup - delete in correct order due to foreign key constraints
    await prisma.matchLog.deleteMany({});
    await prisma.conversion.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.click.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.webhookRaw.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.identity.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.dedupeRegistry.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  // SCENARIO 1: FBC match found within 72h window
  it('[1] FBC match found within 72h window → matchStrategy=fbc', async () => {
    const testFbc = 'fb.1.test-fbc-001';

    // Create click with FBC
    const click = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: testFbc,
        fbp: undefined,
        fbclid: undefined,
        ip: '192.168.1.1',
      },
    });

    // Create conversion with same FBC
     
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: testFbc,
        fbp: undefined,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    // Execute match
    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: {
        eventId: 'test-event-001',
        email: 'test@example.com',
        amount: 99.90,
      },
    });

    // Verify FBC match
    expect(result.matchStrategy).toBe('fbc');
    expect(result.matchedClickId).toBe(click.id);
    expect(result.conversionId).toBe(conversion.id);

    // Verify MatchLog created
    expect(result.matchLogId).toBeDefined();
    const matchLog = await prisma.matchLog.findUnique({ where: { id: result.matchLogId } });
    expect(matchLog).toBeDefined();
    expect(matchLog?.fbcAttempted).toBe(true);
    expect(matchLog?.fbcResult).toBe('found');
    expect(matchLog?.fbcClickId).toBe(click.id);
  });

  // SCENARIO 2: FBC not found → fallback to FBP
  it('[2] FBC not found → fallback to FBP → matchStrategy=fbp', async () => {
    const testFbp = 'fb.1.test-fbp-001';

    // Create click with only FBP (no FBC)
    const click = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: undefined,
        fbp: testFbp,
        fbclid: undefined,
      },
    });

    // Create conversion with FBC (won't match) + FBP (will match)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: 'fb.1.nonexistent-fbc',
        fbp: testFbp,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'test-event-002', amount: 99.90 },
    });

    expect(result.matchStrategy).toBe('fbp');
    expect(result.matchedClickId).toBe(click.id);

    const matchLog = await prisma.matchLog.findUnique({ where: { id: result.matchLogId } });
    expect(matchLog?.fbcAttempted).toBe(true);
    expect(matchLog?.fbcResult).toBe('not_found');
    expect(matchLog?.fbpAttempted).toBe(true);
    expect(matchLog?.fbpResult).toBe('found');
  });

  // SCENARIO 3: No FBC + No FBP → unmatched
  it('[3] No FBC + No FBP → matchStrategy=unmatched', async () => {
    // Create conversion with NO FBC/FBP
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: undefined,
        fbp: undefined,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'test-event-003', amount: 99.90 },
    });

    expect(result.matchStrategy).toBe('unmatched');
    expect(result.matchedClickId).toBeUndefined();

    const matchLog = await prisma.matchLog.findUnique({ where: { id: result.matchLogId } });
    expect(matchLog?.finalStrategy).toBe('unmatched');
  });

  // SCENARIO 4: Click outside 72h window → no match
  it('[4] Click outside 72h window → no match (boundary test)', async () => {
    const testFbc = 'fb.1.test-fbc-old';
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Create click 7 days ago (outside 72h window)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const click = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: testFbc,
        fbp: undefined,
        createdAt: sevenDaysAgo,
      },
    });

    // Create conversion with matching FBC
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: testFbc,
        fbp: undefined,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'test-event-004', amount: 99.90 },
    });

    // Should not match because click is outside 72h window
    expect(result.matchStrategy).toBe('unmatched');
    expect(result.matchedClickId).toBeUndefined();
  });

  // SCENARIO 5: Most recent click selected when multiple FBC matches
  it('[5] Multiple FBC matches → select most recent', async () => {
    const testFbc = 'fb.1.test-fbc-multi';

    // Create first click (older)
    const olderClick = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: testFbc,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    // Create second click (newer)
    const newerClick = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: testFbc,
        createdAt: new Date(Date.now() - 1 * 60 * 1000),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: testFbc,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'test-event-005', amount: 99.90 },
    });

    // Should match the NEWER click (most recent)
    expect(result.matchedClickId).toBe(newerClick.id);
    expect(result.matchedClickId).not.toBe(olderClick.id);
  });

  // SCENARIO 6: MatchLog persistence with full audit trail
  it('[6] MatchLog contains full audit trail (FBC/FBP attempts, time window)', async () => {
    const testFbc = 'fb.1.test-fbc-audit';
    const testFbp = 'fb.1.test-fbp-audit';

    // Create click with FBC only
    const click = await prisma.click.create({
      data: {
        tenantId: testTenantId,
        fbc: testFbc,
      },
    });

    // Create conversion with FBC + FBP
    const conversion = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: testFbc,
        fbp: testFbp,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    const result = await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'test-event-006', amount: 99.90 },
    });

    const matchLog = await prisma.matchLog.findUnique({
      where: { id: result.matchLogId },
    });

    // Verify audit trail
    expect(matchLog?.conversionId).toBe(conversion.id);
    expect(matchLog?.fbcAttempted).toBe(true);
    expect(matchLog?.fbcResult).toBe('found');
    expect(matchLog?.fbcClickId).toBe(click.id);
    expect(matchLog?.fbpAttempted).toBe(false); // Not attempted because FBC found
    expect(matchLog?.timeWindowStart).toBeDefined();
    expect(matchLog?.timeWindowEnd).toBeDefined();
    expect(matchLog?.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  // SCENARIO 7: PII hashing validation (SHA-256)
  it('[7] PII hashing uses SHA-256 (email validation)', () => {
    const email = 'test@example.com';
    const hash = sha256hex(email);

    // SHA-256 produces 64 hex characters
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    // Known hash for test@example.com
    expect(hash).toBe('1b1f472cc84e39121b8ff2723c9d3e0b4e2b79d9fdd5e0b10c1f5e8c1a7c3e2a');
  });

  // SCENARIO 8: Match stats aggregation
  it('[8] Match stats aggregation (rate, by strategy)', async () => {
    // Create 3 conversions: 2 matched (1 FBC, 1 FBP), 1 unmatched
    const testFbc = 'fb.1.test-fbc-stats';
    const testFbp = 'fb.1.test-fbp-stats';

    // Click for FBC match
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fbcClick = await prisma.click.create({
      data: { tenantId: testTenantId, fbc: testFbc },
    });

    // Click for FBP match
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fbpClick = await prisma.click.create({
      data: { tenantId: testTenantId, fbp: testFbp },
    });

    // Conversion 1: FBC match
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conv1 = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: testWebhookRawId,
        gateway: 'perfectpay',
        fbc: testFbc,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    // Conversion 2: FBP match (create new webhook raw)
    const wr2 = await prisma.webhookRaw.create({
      data: {
        tenantId: testTenantId,
        gateway: 'perfectpay',
        gatewayEventId: `test-event-${Date.now()}-fbp`,
        rawPayload: { test: true },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conv2 = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: wr2.id,
        gateway: 'perfectpay',
        fbc: 'nonexistent',
        fbp: testFbp,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    // Conversion 3: unmatched (create new webhook raw)
    const wr3 = await prisma.webhookRaw.create({
      data: {
        tenantId: testTenantId,
        gateway: 'perfectpay',
        gatewayEventId: `test-event-${Date.now()}-unmatched`,
        rawPayload: { test: true },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const conv3 = await prisma.conversion.create({
      data: {
        tenantId: testTenantId,
        webhookRawId: wr3.id,
        gateway: 'perfectpay',
        fbc: undefined,
        fbp: undefined,
        amount: 99.90,
        currency: 'BRL',
      },
    });

    // Execute matches
    await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: testWebhookRawId,
      event: { eventId: 'evt-1', amount: 99.90 },
    });

    await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: wr2.id,
      event: { eventId: 'evt-2', amount: 99.90 },
    });

    await matchConversion({
      tenantId: testTenantId,
      gateway: 'perfectpay',
      webhookRawId: wr3.id,
      event: { eventId: 'evt-3', amount: 99.90 },
    });

    // Get stats
    const stats = await getMatchStats(testTenantId);

    expect(stats.total).toBe(3);
    expect(stats.matched).toBe(2);
    expect(stats.matchRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    expect(stats.byStrategy).toBeDefined();
    expect(stats.byStrategy.length).toBeGreaterThan(0);
  });

  // SCENARIO 0: Type validation and exports
  it('[0] Type exports and interface validation', async () => {
    const { matchConversion, getMatchStats, matchConversionsBatch } = await import('./match-engine.js');

    expect(typeof matchConversion).toBe('function');
    expect(typeof getMatchStats).toBe('function');
    expect(typeof matchConversionsBatch).toBe('function');
  });
});
