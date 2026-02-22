import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router.js';

/**
 * Kiwify webhook adapter.
 *
 * Kiwify sends webhooks with an X-Kiwify-Signature header (HMAC-SHA256).
 * Reference: https://docs.kiwify.com.br/
 */
export class KiwifyAdapter implements WebhookAdapter {
  /**
   * Validate Kiwify HMAC-SHA256 signature (timing-safe).
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void {
    if (!signature) {
      throw new Error('Missing X-Kiwify-Signature header');
    }

    // Kiwify signature is HMAC-SHA256 in hex format
    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (!compareBuffers(signatureBuffer, computedBuffer)) {
      throw new Error('Invalid Kiwify signature');
    }
  }

  /**
   * Parse Kiwify webhook payload.
   * Extracts all 15 Meta CAPI parameters for Story 008.
   * Note: Kiwify has conditional data sharing (customer may opt-out).
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to KiwifyWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    // Extract data from nested structure
    const data = parsed.data || {};
    const customer = data.customer || {};

    // Extract name into first/last
    const fullName = customer.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const event: NormalizedWebhookEvent = {
      gateway: 'kiwify',
      eventId: parsed.id,
      eventType: parsed.event || data.status || 'unknown',
      amount: data.amount,
      currency: data.currency || 'BRL',
      // --- 15 Meta CAPI Parameters ---
      fbc: data.custom_fields?.fbc,
      fbp: data.custom_fields?.fbp,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerCity: undefined, // Kiwify doesn't send address
      customerState: undefined,
      customerCountry: undefined,
      customerZipCode: undefined,
      customerDateOfBirth: undefined,
      customerExternalId: parsed.id, // Use order ID
      // --- Legacy fields ---
      productId: data.product?.id,
      productName: data.product?.name,
      timestamp: parsed.timestamp ? new Date(parsed.timestamp) : undefined,
      rawPayload: body,
    };

    return event;
  }
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
