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
    const firstName = nameParts[0] || parsed.buyer?.first_name || undefined;
    const lastName = nameParts.slice(1).join(' ') || parsed.buyer?.last_name || undefined;

    // Extract 15 Meta CAPI parameters
    const event: NormalizedWebhookEvent = {
      gateway: 'hotmart',
      eventId: parsed.id,
      eventType: parsed.status || 'unknown',
      amount: parsed.purchase?.full_price || parsed.purchase?.price,
      currency: parsed.purchase?.currency || 'BRL',
      // --- 15 Meta CAPI Parameters ---
      // Facebook IDs (NOT hashed)
      fbc: parsed.fbc || parsed.custom_fields?.fbc,
      fbp: parsed.fbp || parsed.custom_fields?.fbp,
      // Contact info (HASHED in Story 008)
      customerEmail: parsed.buyer?.email,
      customerPhone: parsed.buyer?.phone,
      customerPhoneArea: parsed.buyer?.phone?.substring(0, 2), // For Story 008 formatting
      // Personal info (HASHED in Story 008)
      customerFirstName: firstName,
      customerLastName: lastName,
      customerDateOfBirth: parsed.buyer?.birth_date || parsed.buyer?.date_of_birth,
      // Address (HASHED in Story 008)
      customerCity: parsed.buyer?.address?.city,
      customerState: parsed.buyer?.address?.state,
      customerCountry: parsed.buyer?.address?.country,
      customerZipCode: parsed.buyer?.address?.zip_code,
      // External IDs (HASHED in Story 008)
      customerExternalId: parsed.buyer?.external_id || parsed.id, // Use external_id if available, else purchase ID
      customerFacebookLoginId: undefined, // Hotmart doesn't send Facebook Login ID
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
