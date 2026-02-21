import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router';

/**
 * Stripe webhook adapter.
 *
 * Stripe sends webhooks with a Stripe-Signature header in format: t=timestamp,v1=signature
 * Reference: https://stripe.com/docs/webhooks/signatures
 */
export class StripeAdapter implements WebhookAdapter {
  /**
   * Validate Stripe webhook signature (timing-safe).
   * Stripe signature format: t=<timestamp>,v1=<signature>
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void {
    if (!signature) {
      throw new Error('Missing Stripe-Signature header');
    }

    // Parse signature header
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    if (!parts.t || !parts.v1) {
      throw new Error('Invalid Stripe-Signature format');
    }

    const timestamp = parts.t;
    const providedSignature = parts.v1;

    // Stripe uses: HMAC(secret, timestamp + '.' + body)
    const signedContent = `${timestamp}.${rawBody}`;
    const computed = createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    // Timing-safe comparison
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (!compareBuffers(providedBuffer, computedBuffer)) {
      throw new Error('Invalid Stripe signature');
    }

    // Optional: check timestamp freshness (prevent replay attacks)
    // Stripe recommends checking if timestamp is within last 5 minutes
    const now = Math.floor(Date.now() / 1000);
    const eventTime = parseInt(timestamp, 10);
    const tolerance = 5 * 60; // 5 minutes

    if (Math.abs(now - eventTime) > tolerance) {
      throw new Error('Stripe webhook timestamp outside tolerance window');
    }
  }

  /**
   * Parse Stripe webhook payload.
   * Extracts all 15 Meta CAPI parameters for Story 008.
   * Note: Stripe sends minimal customer data in webhooks (privacy-first approach).
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to StripeWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    const data = parsed.data?.object || {};

    // Convert amount from cents to base unit
    const amount = data.amount ? data.amount / 100 : undefined;

    const event: NormalizedWebhookEvent = {
      gateway: 'stripe',
      eventId: parsed.id,
      eventType: parsed.type || 'unknown',
      amount,
      currency: data.currency?.toUpperCase(),
      // --- 15 Meta CAPI Parameters ---
      fbc: data.metadata?.fbc, // Via metadata
      fbp: data.metadata?.fbp, // Via metadata
      customerEmail: extractStripeEmail(data),
      customerPhone: undefined, // Stripe doesn't send phone in webhook
      customerFirstName: undefined,
      customerLastName: undefined,
      customerCity: undefined,
      customerState: undefined,
      customerCountry: undefined,
      customerZipCode: undefined,
      customerDateOfBirth: undefined,
      customerExternalId: data.customer, // Stripe customer ID
      // --- Legacy fields ---
      productId: undefined,
      productName: undefined,
      timestamp: parsed.created
        ? new Date(parsed.created * 1000)
        : undefined,
      rawPayload: body,
    };

    return event;
  }
}

/**
 * Extract email from Stripe payment intent or charge object.
 */
function extractStripeEmail(
  data: Record<string, unknown>
): string | undefined {
  // Try billing details from charges array
  const charges = data.charges as Record<string, unknown> | undefined;
  if (charges && Array.isArray(charges.data)) {
    for (const charge of charges.data) {
      const chargeObj = charge as Record<string, unknown>;
      const billingDetails = chargeObj.billing_details as
        | Record<string, unknown>
        | undefined;
      if (billingDetails?.email) {
        return String(billingDetails.email);
      }
    }
  }

  // Try receipt_email from payment intent
  const receiptEmail = data.receipt_email;
  if (receiptEmail) {
    return String(receiptEmail);
  }

  return undefined;
}

/**
 * Timing-safe buffer comparison wrapper.
 */
function compareBuffers(a: Buffer, b: Buffer): boolean {
  try {
    return (
      a.length === b.length &&
      timingSafeEqual(a, b) === true
    );
  } catch {
    return false;
  }
}
