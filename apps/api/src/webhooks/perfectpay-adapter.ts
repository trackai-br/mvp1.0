import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router.js';

/**
 * PerfectPay webhook adapter.
 *
 * PerfectPay sends webhooks with X-PerfectPay-Signature header (HMAC-SHA256).
 * Reference: https://docs.perfectpay.com.br/
 *
 * NOTE: PerfectPay is the ONLY gateway that provides dateOfBirth (critical for Meta CAPI).
 */
export class PerfectPayAdapter implements WebhookAdapter {
  /**
   * Validate PerfectPay HMAC-SHA256 signature (timing-safe).
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void {
    if (!signature) {
      throw new Error('Missing X-PerfectPay-Signature header');
    }

    // PerfectPay signature is HMAC-SHA256 in hex format
    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (!compareBuffers(signatureBuffer, computedBuffer)) {
      throw new Error('Invalid PerfectPay signature');
    }
  }

  /**
   * Parse PerfectPay webhook payload.
   * Extracts all 15 Meta CAPI parameters for Story 008.
   * Note: PerfectPay is the ONLY gateway with dateOfBirth data.
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to PerfectPayWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    // Extract name into first/last (try full_name first, then separate fields)
    let firstName = parsed.customer?.first_name;
    let lastName = parsed.customer?.last_name;
    if (!firstName && !lastName) {
      const fullName = parsed.customer?.full_name || '';
      const nameParts = fullName.split(' ');
      firstName = nameParts[0] || undefined;
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Extract phone with area code if present
    let phone: string | undefined;
    if (parsed.customer?.phone) {
      // PerfectPay phone may have area code embedded or separate
      // Format as +55 + area code + number if available
      const phoneStr = parsed.customer.phone;
      if (phoneStr.length >= 10) {
        // Assume format: (XX) XXXXX-XXXX or similar
        const digitsOnly = phoneStr.replace(/\D/g, '');
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
          phone = `+55${digitsOnly}`;
        } else {
          phone = phoneStr;
        }
      } else {
        phone = phoneStr;
      }
    }

    const event: NormalizedWebhookEvent = {
      gateway: 'perfectpay',
      eventId: parsed.order_id,
      eventType: parsed.status || 'unknown',
      amount: parsed.amount,
      currency: parsed.currency || 'BRL',
      // --- 15 Meta CAPI Parameters ---
      // Facebook IDs (NOT hashed)
      fbc: parsed.fbc || parsed.customer?.custom_fields?.fbc,
      fbp: parsed.fbp || parsed.customer?.custom_fields?.fbp,
      // Contact info (HASHED in Story 008)
      customerEmail: parsed.customer?.email,
      customerPhone: phone,
      // Personal info (HASHED in Story 008)
      customerFirstName: firstName,
      customerLastName: lastName,
      customerDateOfBirth: parsed.customer?.date_of_birth || parsed.customer?.birthdate, // YYYY-MM-DD
      // Address (HASHED in Story 008)
      customerCity: parsed.customer?.address_city,
      customerState: parsed.customer?.address_state,
      customerCountry: parsed.customer?.address_country,
      customerZipCode: parsed.customer?.address_zipcode,
      // External IDs (HASHED in Story 008)
      customerExternalId: parsed.customer?.external_id || parsed.order_id,
      customerFacebookLoginId: parsed.customer?.facebook_login_id,
      // --- Legacy fields ---
      productId: parsed.product_id,
      productName: undefined,
      timestamp: parsed.event_time ? new Date(parsed.event_time) : undefined,
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
