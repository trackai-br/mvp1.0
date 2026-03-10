import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db.js';
import { handleAdminOnboardCustomer } from './admin-onboard-handler.js';

describe('Admin Onboard Handler', () => {
  let createdTenantIds: string[] = [];

  afterEach(async () => {
    // Cleanup
    for (const tenantId of createdTenantIds) {
      await prisma.funnel.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {
        // Ignore if already deleted
      });
    }
    createdTenantIds = [];
  });

  it('[1] Create customer with all fields', async () => {
    const result = await handleAdminOnboardCustomer({
      companyName: 'Test Company Inc',
      email: 'admin@test.com',
      gateway: 'perfectpay',
      funnelName: 'Test Funnel',
      funnelUrl: 'https://test.com',
    });

    expect(result.success).toBe(true);
    expect(result.tenantId).toBeDefined();
    expect(result.funnelId).toBeDefined();
    expect(result.tenantSlug).toBe('test-company-inc');
    expect(result.webhookUrl).toContain('perfectpay');
    expect(result.trackingPixelCode).toContain('Track AI Pixel');
    expect(result.message).toContain('✅');

    createdTenantIds.push(result.tenantId);

    // Verify tenant was created
    const tenant = await prisma.tenant.findUnique({
      where: { id: result.tenantId },
    });
    expect(tenant).toBeDefined();
    expect(tenant?.name).toBe('Test Company Inc');
    expect(tenant?.status).toBe('active');

    // Verify funnel was created
    const funnel = await prisma.funnel.findUnique({
      where: { id: result.funnelId },
    });
    expect(funnel).toBeDefined();
    expect(funnel?.name).toBe('Test Funnel');
    expect(funnel?.status).toBe('active');
  });

  it('[2] Create customer without funnel', async () => {
    const result = await handleAdminOnboardCustomer({
      companyName: 'Simple Company',
      email: 'test@simple.com',
      gateway: 'hotmart',
    });

    expect(result.success).toBe(true);
    expect(result.tenantId).toBeDefined();
    expect(result.funnelId).toBe(''); // No funnel created
    expect(result.tenantSlug).toBe('simple-company');
    expect(result.webhookUrl).toContain('hotmart');

    createdTenantIds.push(result.tenantId);
  });

  it('[3] Support all gateways', async () => {
    const gateways = ['perfectpay', 'hotmart', 'kiwify', 'stripe'] as const;

    for (const gateway of gateways) {
      const result = await handleAdminOnboardCustomer({
        companyName: `Company ${gateway}`,
        email: `test@${gateway}.com`,
        gateway,
      });

      expect(result.success).toBe(true);
      expect(result.webhookUrl).toContain(gateway);
      createdTenantIds.push(result.tenantId);
    }

    expect(createdTenantIds.length).toBe(4);
  });

  it('[4] Generate slug from company name', async () => {
    const result = await handleAdminOnboardCustomer({
      companyName: 'MINUTOS PAGOS - Instituton Nexxa',
      email: 'contact@minutospagos.com',
      gateway: 'perfectpay',
    });

    expect(result.tenantSlug).toBe('minutos-pagos-instituton-nexxa');
    createdTenantIds.push(result.tenantId);
  });

  it('[5] Tracking pixel includes tenant ID', async () => {
    const result = await handleAdminOnboardCustomer({
      companyName: 'Pixel Test Corp',
      email: 'pixel@test.com',
      gateway: 'stripe',
    });

    expect(result.trackingPixelCode).toContain(result.tenantId);
    expect(result.trackingPixelCode).toContain('window.__trackAI.tenantId');
    expect(result.trackingPixelCode).toContain('api.track-ai.com/api/v1/track/click');
    createdTenantIds.push(result.tenantId);
  });

  it('[6] Fail on missing company name', async () => {
    try {
      await handleAdminOnboardCustomer({
        companyName: '',
        email: 'test@test.com',
        gateway: 'perfectpay',
      });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('companyName');
    }
  });

  it('[7] Fail on missing email', async () => {
    try {
      await handleAdminOnboardCustomer({
        companyName: 'Test Co',
        email: '',
        gateway: 'perfectpay',
      });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('email');
    }
  });

  it('[8] Fail on invalid gateway', async () => {
    try {
      await handleAdminOnboardCustomer({
        companyName: 'Test Co',
        email: 'test@test.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gateway: 'invalid-gateway' as any,
      });
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('gateway');
    }
  });

  it('[9] Handle duplicate tenant slug gracefully', async () => {
    const request = {
      companyName: 'Duplicate Test',
      email: 'dup@test.com',
      gateway: 'perfectpay' as const,
    };

    // Create first
    const result1 = await handleAdminOnboardCustomer(request);
    expect(result1.success).toBe(true);
    createdTenantIds.push(result1.tenantId);

    // Try to create second with same slug (should fail gracefully)
    try {
      await handleAdminOnboardCustomer(request);
      expect.fail('Should have thrown error for duplicate slug');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('already exists');
    }
  });

  it('[10] Webhook URL format is correct', async () => {
    const result = await handleAdminOnboardCustomer({
      companyName: 'URL Test',
      email: 'url@test.com',
      gateway: 'kiwify',
    });

    const expectedUrl = `https://api.track-ai.com/api/v1/webhooks/kiwify/${result.tenantId}`;
    expect(result.webhookUrl).toBe(expectedUrl);
    createdTenantIds.push(result.tenantId);
  });
});
