import { createHmac, timingSafeEqual } from 'crypto';
import { NormalizedWebhookEvent, WebhookAdapter } from './webhook-router';

/**
 * PagSeguro webhook adapter.
 *
 * PagSeguro sends webhooks with X-PagSeguro-Signature header.
 * Format is typically form-encoded or XML, but we accept JSON here.
 * Reference: https://dev.pagseguro.uol.com.br/
 */
export class PagSeguroAdapter implements WebhookAdapter {
  /**
   * Validate PagSeguro signature (HMAC-SHA256).
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void {
    if (!signature) {
      throw new Error('Missing X-PagSeguro-Signature header');
    }

    // PagSeguro signature is HMAC-SHA256 in hex format
    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (!compareBuffers(signatureBuffer, computedBuffer)) {
      throw new Error('Invalid PagSeguro signature');
    }
  }

  /**
   * Parse PagSeguro webhook payload.
   * Extracts all 15 Meta CAPI parameters for Story 008.
   * Note: PagSeguro provides the richest address data of all gateways.
   */
  parseEvent(body: unknown): NormalizedWebhookEvent {
    // NOTE: Pragmatically casting to PagSeguroWebhookBody
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = body as any;

    // Parse amount (PagSeguro sends as string)
    let amount: number | undefined;
    if (parsed.grossAmount) {
      amount = parseFloat(parsed.grossAmount);
    }

    // Determine event type from status code
    const statusMap: Record<string, string> = {
      '1': 'pending',
      '2': 'waiting_payment',
      '3': 'approved',
      '4': 'available',
      '5': 'in_dispute',
      '6': 'refunded',
      '7': 'cancelled',
      '8': 'chargeback',
      '9': 'in_analysis',
      '10': 'pre_approved',
      '11': 'reinstated',
      '12': 'pre_approved_pending',
      '13': 'approved',
    };
    const eventType = statusMap[parsed.status || ''] || 'unknown';

    // Extract items for product info
    let productName: string | undefined;
    let productId: string | undefined;
    if (parsed.items && parsed.items.length > 0) {
      const firstItem = parsed.items[0];
      productName = firstItem.description;
      productId = firstItem.id;
    }

    // Extract name into first/last
    const fullName = parsed.sender?.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const event: NormalizedWebhookEvent = {
      gateway: 'pagseguro',
      eventId: parsed.reference || parsed.id,
      eventType,
      amount,
      currency: parsed.currency || 'BRL',
      // --- 15 Meta CAPI Parameters ---
      fbc: undefined, // PagSeguro doesn't send Meta IDs
      fbp: undefined,
      customerEmail: parsed.sender?.email,
      customerPhone: parsed.sender?.phone
        ? `${parsed.sender.phone.areaCode}${parsed.sender.phone.number}`
        : undefined,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerCity: parsed.shipping?.address?.city,
      customerState: parsed.shipping?.address?.state,
      customerCountry: parsed.shipping?.address?.country,
      customerZipCode: parsed.shipping?.address?.postalCode,
      customerDateOfBirth: undefined,
      customerExternalId: parsed.reference, // PagSeguro reference
      // --- Legacy fields ---
      productId,
      productName,
      timestamp: parsed.lastEventDate
        ? new Date(parsed.lastEventDate)
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
    return (
      a.length === b.length &&
      timingSafeEqual(a, b) === true
    );
  } catch {
    return false;
  }
}
