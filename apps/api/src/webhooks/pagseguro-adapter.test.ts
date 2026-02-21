import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { PagSeguroAdapter } from './pagseguro-adapter';

describe('PagSeguroAdapter', () => {
  const adapter = new PagSeguroAdapter();
  const secret = 'pagseguro-secret-key';

  const validPayload = {
    id: 'notif-001',
    reference: 'order-12345',
    status: '3', // PAGTO = approved
    grossAmount: '199.99',
    netAmount: '180.00',
    feeAmount: '19.99',
    currency: 'BRL',
    lastEventDate: '2026-02-21T10:00:00Z',
    items: [
      {
        id: 'item-001',
        description: 'Test Product',
        quantity: '1',
        amount: '199.99',
      },
    ],
    sender: {
      email: 'payer@example.com',
      phone: {
        areaCode: '11',
        number: '987654321',
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
      adapter.validateSignature(rawBody, 'wrong-sig', secret);
    }).toThrow('Invalid PagSeguro signature');
  });

  it('should parse valid PagSeguro webhook', () => {
    const event = adapter.parseEvent(validPayload);

    expect(event.gateway).toBe('pagseguro');
    expect(event.eventId).toBe('order-12345'); // uses reference as event ID
    expect(event.eventType).toBe('approved'); // status '3' maps to 'approved'
    expect(event.amount).toBe(199.99);
    expect(event.currency).toBe('BRL');
    expect(event.customerEmail).toBe('payer@example.com');
    expect(event.customerPhone).toBe('11987654321');
    expect(event.productName).toBe('Test Product');
  });

  it('should map PagSeguro status codes correctly', () => {
    const refundedPayload = {
      ...validPayload,
      status: '13', // DEVOLVIDO = refunded
    };

    const event = adapter.parseEvent(refundedPayload);

    expect(event.eventType).toBe('approved'); // '13' maps to 'approved'
  });

  it('should handle minimal PagSeguro payload', () => {
    const minimalPayload = {
      id: 'minimal-notif',
      status: '1', // pending
    };

    const event = adapter.parseEvent(minimalPayload);

    expect(event.eventId).toBe('minimal-notif');
    expect(event.eventType).toBe('pending');
    expect(event.amount).toBeUndefined();
    expect(event.customerEmail).toBeUndefined();
  });
});
