import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router';

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
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to HotmartWebhookBody
    // Zod validation would require schema import, avoided for test isolation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    const event: NormalizedWebhookEvent = {
      gateway: 'hotmart',
      eventId: parsed.id,
      eventType: parsed.status || 'unknown',
      amount: parsed.purchase?.full_price || parsed.purchase?.price,
      currency: parsed.purchase?.currency || 'BRL',
      customerEmail: parsed.buyer?.email,
      customerPhone: parsed.buyer?.phone,
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
