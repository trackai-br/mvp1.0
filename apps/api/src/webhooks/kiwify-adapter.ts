import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router';

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
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to KiwifyWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    // Extract data from nested structure
    const data = parsed.data || {};

    const event: NormalizedWebhookEvent = {
      gateway: 'kiwify',
      eventId: parsed.id,
      eventType: parsed.event || data.status || 'unknown',
      amount: data.amount,
      currency: data.currency || 'BRL',
      customerEmail: data.customer?.email,
      customerPhone: data.customer?.phone,
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
