import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Generic webhook adapter interface.
 * Each gateway implements this to handle its specific webhook format and signature validation.
 */
export interface WebhookAdapter {
  /**
   * Validate the webhook signature (HMAC or other).
   * Must use timing-safe comparison.
   * @throws Error if signature is invalid
   */
  validateSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): void;

  /**
   * Parse and normalize the webhook payload.
   * Returns a standardized event format.
   */
  parseEvent(body: unknown): NormalizedWebhookEvent;
}

/**
 * Standardized webhook event format (gateway-agnostic).
 * All gateways are normalized to this format.
 */
export interface NormalizedWebhookEvent {
  gateway: 'hotmart' | 'kiwify' | 'stripe' | 'pagseguro' | 'perfectpay';
  eventId: string; // Unique event ID for deduplication
  eventType: string; // 'approved', 'confirmed', 'succeeded', etc.
  amount?: number; // In smallest unit (cents for USD, etc.)
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  productId?: string;
  productName?: string;
  timestamp?: Date;
  rawPayload: unknown; // Store original payload for audit
}

/**
 * Factory function to get the correct adapter for a gateway.
 */
export function getWebhookAdapter(gateway: string): WebhookAdapter {
  switch (gateway.toLowerCase()) {
    case 'hotmart':
      // Lazy import to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./hotmart-adapter').HotmartAdapter;
    case 'kiwify':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./kiwify-adapter').KiwifyAdapter;
    case 'stripe':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./stripe-adapter').StripeAdapter;
    case 'pagseguro':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./pagseguro-adapter').PagSeguroAdapter;
    default:
      throw new Error(`Unsupported gateway: ${gateway}`);
  }
}

/**
 * Register generic webhook routes.
 * Route: POST /api/v1/webhooks/:gateway/:tenantId
 */
export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post<{
    Params: { gateway: string; tenantId: string };
  }>('/api/v1/webhooks/:gateway/:tenantId', {
    config: { rawBody: true },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { gateway, tenantId } = request.params as any;

    try {
      // Get the appropriate adapter
      const adapter = getWebhookAdapter(gateway);

      // For now, we just parse and return the event
      // In a real implementation, this would:
      // 1. Fetch tenant's webhook secret
      // 2. Validate signature
      // 3. Persist to database
      // 4. Enqueue to processing pipeline

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = adapter.parseEvent(request.body as any);

      return reply.code(202).send({
        ok: true,
        eventId: event.eventId,
        gateway: event.gateway,
        message: 'Webhook accepted for processing',
      });
    } catch (err) {
      app.log.error({
        gateway,
        tenantId,
        error: String(err),
      }, 'Webhook processing error');

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage.includes('signature')) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      return reply.code(400).send({ error: 'Webhook processing failed' });
    }
  });
}
