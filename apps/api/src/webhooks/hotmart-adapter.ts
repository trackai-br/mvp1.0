import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router.js';

/**
 * Hotmart webhook adapter.
 *
 * Hotmart sends webhooks with an X-Hotmart-Signature header (HMAC-SHA256).
 * Reference: https://developers.hotmart.com/
 */
export class HotmartAdapter implements WebhookAdapter {
  /**
   * Validate Hotmart HMAC-SHA256 signature (timing-safe).
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void {
    if (!signature) {
      throw new Error('Missing X-Hotmart-Signature header');
    }

    // Hotmart signature is HMAC-SHA256 in hex format
    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (!compareBuffers(signatureBuffer, computedBuffer)) {
      throw new Error('Invalid Hotmart signature');
    }
  }

  /**
   * Parse Hotmart webhook payload.
   * Extracts all 15 Meta CAPI parameters for Story 008 Match Engine.
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to HotmartWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    // Extract name into first/last (Hotmart sends full name)
    const fullName = parsed.buyer?.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    // Extract 15 Meta CAPI parameters
    const event: NormalizedWebhookEvent = {
      gateway: 'hotmart',
      eventId: parsed.id,
      eventType: parsed.status || 'unknown',
      amount: parsed.purchase?.full_price || parsed.purchase?.price,
      currency: parsed.purchase?.currency || 'BRL',
      // --- 15 Meta CAPI Parameters ---
      fbc: parsed.custom_fields?.fbc, // FBC from custom fields
      fbp: parsed.custom_fields?.fbp, // FBP from custom fields
      customerEmail: parsed.buyer?.email,
      customerPhone: parsed.buyer?.phone,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerCity: parsed.buyer?.city,
      customerState: parsed.buyer?.state,
      customerCountry: parsed.buyer?.country,
      customerZipCode: parsed.buyer?.zipcode,
      customerDateOfBirth: undefined, // Hotmart doesn't send this
      customerExternalId: parsed.id, // Use purchase ID as external ID
      customerPhoneArea: parsed.buyer?.phone?.substring(0, 2), // For Story 008 formatting
      // --- Legacy fields (for backward compat) ---
      productId: parsed.product?.id,
      productName: parsed.product?.name,
      timestamp: parsed.purchase?.approved_date
        ? new Date(parsed.purchase.approved_date)
        : undefined,
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
    // crypto.timingSafeEqual throws if lengths don't match
    return (
      a.length === b.length &&
      timingSafeEqual(a, b) === true
    );
  } catch {
    return false;
  }
}
