import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { HotmartAdapter } from './hotmart-adapter.js';

describe('HotmartAdapter', () => {
  const adapter = new HotmartAdapter();
  const secret = 'test-secret-key';

  const validPayload = {
    id: 'evt-hotmart-001',
    status: 'approved',
    purchase: {
      id: 'purchase-123',
      full_price: 99.99,
      price: 99.99,
      currency: 'BRL',
      approved_date: '2026-02-21T10:00:00Z',
    },
    buyer: {
      email: 'buyer@example.com',
      name: 'Test Buyer',
      phone: '11999999999',
    },
    product: {
      id: 'prod-001',
      name: 'Test Product',
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

    // Should not throw
    expect(() => {
      adapter.validateSignature(rawBody, signature, secret);
    }).not.toThrow();
  });

  it('should reject invalid HMAC signature', () => {
    const rawBody = JSON.stringify(validPayload);

    expect(() => {
      adapter.validateSignature(rawBody, 'invalid-signature', secret);
    }).toThrow('Invalid Hotmart signature');
  });

  it('should reject missing signature header', () => {
    const rawBody = JSON.stringify(validPayload);

    expect(() => {
      adapter.validateSignature(rawBody, undefined, secret);
    }).toThrow('Missing X-Hotmart-Signature header');
  });

  it('should parse valid Hotmart webhook payload', () => {
    const event = adapter.parseEvent(validPayload);

    expect(event.gateway).toBe('hotmart');
    expect(event.eventId).toBe('evt-hotmart-001');
    expect(event.eventType).toBe('approved');
    expect(event.amount).toBe(99.99);
    expect(event.currency).toBe('BRL');
    expect(event.customerEmail).toBe('buyer@example.com');
    expect(event.customerPhone).toBe('11999999999');
    expect(event.productId).toBe('prod-001');
    expect(event.productName).toBe('Test Product');
  });

  it('should handle minimal Hotmart webhook payload', () => {
    const minimalPayload = {
      id: 'evt-minimal-001',
      status: 'pending',
    };

    const event = adapter.parseEvent(minimalPayload);

    expect(event.eventId).toBe('evt-minimal-001');
    expect(event.eventType).toBe('pending');
    expect(event.amount).toBeUndefined();
    expect(event.customerEmail).toBeUndefined();
  });

  it('should preserve raw payload for audit', () => {
    const event = adapter.parseEvent(validPayload);

    expect(event.rawPayload).toEqual(validPayload);
  });
});
