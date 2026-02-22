import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { KiwifyAdapter } from './kiwify-adapter.js';

describe('KiwifyAdapter', () => {
  const adapter = new KiwifyAdapter();
  const secret = 'kiwify-secret-key';

  const validPayload = {
    id: 'evt-kiwify-001',
    event: 'sale.confirmed',
    timestamp: '2026-02-21T10:00:00Z',
    data: {
      id: 'sale-123',
      status: 'confirmed',
      amount: 149.99,
      currency: 'BRL',
      customer: {
        email: 'customer@example.com',
        name: 'Test Customer',
        document: '12345678901',
        phone: '11988888888',
      },
      product: {
        id: 'kiwify-prod-001',
        name: 'Kiwify Product',
      },
    },
  };

  function createSignature(body: string): string {
    return createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  it('should validate correct HMAC signature', () => {
    const rawBody = JSON.stringify(validPayload);
    const signature = createSignature(rawBody);

    expect(() => {
      adapter.validateSignature(rawBody, signature, secret);
    }).not.toThrow();
  });

  it('should reject invalid signature', () => {
    const rawBody = JSON.stringify(validPayload);

    expect(() => {
      adapter.validateSignature(rawBody, 'wrong-signature', secret);
    }).toThrow('Invalid Kiwify signature');
  });

  it('should parse valid Kiwify webhook', () => {
    const event = adapter.parseEvent(validPayload);

    expect(event.gateway).toBe('kiwify');
    expect(event.eventId).toBe('evt-kiwify-001');
    expect(event.eventType).toBe('sale.confirmed');
    expect(event.amount).toBe(149.99);
    expect(event.currency).toBe('BRL');
    expect(event.customerEmail).toBe('customer@example.com');
    expect(event.customerPhone).toBe('11988888888');
    expect(event.productId).toBe('kiwify-prod-001');
  });
});
