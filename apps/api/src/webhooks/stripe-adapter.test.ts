import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { StripeAdapter } from './stripe-adapter.js';

describe('StripeAdapter', () => {
  const adapter = new StripeAdapter();
  const secret = 'whsec_test_stripe_secret';

  const validPayload = {
    id: 'evt_1234567890',
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: 'pi_1234567890',
        object: 'payment_intent',
        amount: 9999, // in cents = $99.99
        currency: 'usd',
        status: 'succeeded',
        customer: 'cus_1234567890',
        charges: {
          data: [
            {
              billing_details: {
                email: 'customer@example.com',
              },
            },
          ],
        },
      },
    },
  };

  function createStripeSignature(
    rawBody: string,
    timestamp: string
  ): string {
    const signedContent = `${timestamp}.${rawBody}`;
    const signature = createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  it('should validate correct Stripe signature', () => {
    const rawBody = JSON.stringify(validPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createStripeSignature(rawBody, timestamp);

    expect(() => {
      adapter.validateSignature(rawBody, signature, secret);
    }).not.toThrow();
  });

  it('should reject invalid Stripe signature', () => {
    const rawBody = JSON.stringify(validPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    expect(() => {
      adapter.validateSignature(rawBody, `t=${timestamp},v1=invalidsig`, secret);
    }).toThrow('Invalid Stripe signature');
  });

  it('should reject old timestamp (replay attack)', () => {
    const rawBody = JSON.stringify(validPayload);
    // Timestamp from 10 minutes ago
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const signature = createStripeSignature(rawBody, oldTimestamp);

    expect(() => {
      adapter.validateSignature(rawBody, signature, secret);
    }).toThrow('timestamp outside tolerance');
  });

  it('should parse valid Stripe webhook', () => {
    const event = adapter.parseEvent(validPayload);

    expect(event.gateway).toBe('stripe');
    expect(event.eventId).toBe('evt_1234567890');
    expect(event.eventType).toBe('payment_intent.succeeded');
    expect(event.amount).toBe(99.99); // converted from cents
    expect(event.currency).toBe('USD');
    expect(event.customerEmail).toBe('customer@example.com');
  });

  it('should handle missing billing details', () => {
    const payload = {
      ...validPayload,
      data: {
        object: {
          id: 'pi_minimal',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
        },
      },
    };

    const event = adapter.parseEvent(payload);

    expect(event.eventId).toBe('evt_1234567890');
    expect(event.customerEmail).toBeUndefined();
  });
});
