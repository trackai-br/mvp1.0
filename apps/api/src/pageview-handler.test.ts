import { describe, it, expect } from 'vitest';
import { handlePageviewIngest } from './pageview-handler.js';

describe('pageview handler', () => {
  const validTenant = { id: 'tenant-001' };
  const validPayload = {
    url: 'https://example.com/landing',
    referrer: 'https://google.com',
    title: 'My Landing Page',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'summer-sale',
  };

  it('should create pageview with valid tenant and payload', async () => {
    const deps = {
      findTenant: async () => validTenant,
      createPageview: async () => ({ id: 'pageview-001' }),
    };

    const result = await handlePageviewIngest('tenant-001', validPayload, '192.168.1.1', 'Mozilla/5.0', deps);

    expect(result).toEqual({ ok: true, id: 'pageview-001' });
  });

  it('should return 404 for non-existent tenant', async () => {
    const deps = {
      findTenant: async () => null,
    };

    const result = await handlePageviewIngest('nonexistent', validPayload, '192.168.1.1', 'Mozilla/5.0', deps);

    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('should persist pageview with all optional fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null;

    const deps = {
      findTenant: async () => validTenant,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createPageview: async (data: any) => {
        capturedData = data;
        return { id: 'pageview-002' };
      },
    };

    await handlePageviewIngest('tenant-001', validPayload, '192.168.1.1', 'Mozilla/5.0', deps);

    expect(capturedData).toMatchObject({
      tenantId: 'tenant-001',
      url: 'https://example.com/landing',
      referrer: 'https://google.com',
      title: 'My Landing Page',
      utmSource: 'google',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('should create pageview without optional fields', async () => {
    const minimalPayload = {
      url: 'https://example.com/landing',
    };

    const deps = {
      findTenant: async () => validTenant,
      createPageview: async () => ({ id: 'pageview-003' }),
    };

    const result = await handlePageviewIngest('tenant-001', minimalPayload, '192.168.1.1', 'Mozilla/5.0', deps);

    expect(result).toEqual({ ok: true, id: 'pageview-003' });
  });
});
