import { describe, it, expect } from 'vitest';
import { handleCheckoutIngest } from './checkout-handler';

describe('checkout handler', () => {
  const validTenant = { id: 'tenant-001' };
  const validPayload = {
    cartValue: 299.99,
    currency: 'BRL',
    cartItems: [
      { productId: 'prod-001', productName: 'Product 1', quantity: 2, unitPrice: 99.99 },
      { productId: 'prod-002', productName: 'Product 2', quantity: 1, unitPrice: 100.01 },
    ],
    utmSource: 'instagram',
    utmMedium: 'organic',
    utmCampaign: 'influencer-collab',
  };

  it('should create checkout with valid tenant and payload', async () => {
    const deps = {
      findTenant: async () => validTenant,
      createCheckout: async () => ({ id: 'checkout-001' }),
    };

    const result = await handleCheckoutIngest('tenant-001', validPayload, '192.168.1.2', 'Mozilla/5.0', deps);

    expect(result).toEqual({ ok: true, id: 'checkout-001' });
  });

  it('should return 404 for non-existent tenant', async () => {
    const deps = {
      findTenant: async () => null,
    };

    const result = await handleCheckoutIngest('nonexistent', validPayload, '192.168.1.2', 'Mozilla/5.0', deps);

    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('should persist checkout with all fields including cart items', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null;

    const deps = {
      findTenant: async () => validTenant,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createCheckout: async (data: any) => {
        capturedData = data;
        return { id: 'checkout-002' };
      },
    };

    await handleCheckoutIngest('tenant-001', validPayload, '192.168.1.2', 'Mozilla/5.0', deps);

    expect(capturedData).toMatchObject({
      tenantId: 'tenant-001',
      cartValue: 299.99,
      currency: 'BRL',
      utmSource: 'instagram',
      ip: '192.168.1.2',
      userAgent: 'Mozilla/5.0',
    });
    expect(capturedData.cartItems).toHaveLength(2);
    expect(capturedData.cartItems[0]).toMatchObject({
      productId: 'prod-001',
      productName: 'Product 1',
      quantity: 2,
      unitPrice: 99.99,
    });
  });

  it('should create checkout without optional fields', async () => {
    const minimalPayload = {
      currency: 'BRL',
    };

    const deps = {
      findTenant: async () => validTenant,
      createCheckout: async () => ({ id: 'checkout-003' }),
    };

    const result = await handleCheckoutIngest('tenant-001', minimalPayload, '192.168.1.2', 'Mozilla/5.0', deps);

    expect(result).toEqual({ ok: true, id: 'checkout-003' });
  });

  it('should respect currency field when provided', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedData: any = null;

    const deps = {
      findTenant: async () => validTenant,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createCheckout: async (data: any) => {
        capturedData = data;
        return { id: 'checkout-004' };
      },
    };

    const payload = { cartValue: 150, currency: 'USD' };
    await handleCheckoutIngest('tenant-001', payload, '192.168.1.2', 'Mozilla/5.0', deps);

    expect(capturedData.currency).toBe('USD');
  });
});
