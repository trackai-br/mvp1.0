import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { normalizeConversion } from './conversion-normalizer.js';

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
 * Includes all 15 Meta CAPI parameters for Story 008.
 */
export interface NormalizedWebhookEvent {
  // Identification
  gateway: 'hotmart' | 'kiwify' | 'stripe' | 'pagseguro' | 'perfectpay';
  eventId: string; // Unique event ID for deduplication
  eventType: string; // 'approved', 'confirmed', 'succeeded', etc.

  // Purchase data
  amount?: number;
  currency?: string;

  // --- 15 Meta CAPI Parameters ---
  // Facebook IDs (not hashed)
  fbc?: string; // Facebook Container ID
  fbp?: string; // Facebook Pixel ID

  // Contact info (will be hashed in Story 008)
  customerEmail?: string;
  customerPhone?: string;
  customerPhoneArea?: string; // Area code for phone formatting

  // Personal info (will be hashed in Story 008)
  customerFirstName?: string;
  customerLastName?: string;
  customerDateOfBirth?: string; // YYYY-MM-DD format

  // Address (will be hashed in Story 008)
  customerCity?: string;
  customerState?: string;
  customerCountry?: string;
  customerZipCode?: string;

  // External IDs (will be hashed in Story 008)
  customerExternalId?: string;
  customerFacebookLoginId?: string;

  // Legacy fields (for backward compatibility)
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
    case 'perfectpay':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./perfectpay-adapter').PerfectPayAdapter;
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
      // Import Prisma for database operations
      const { prisma } = await import('../db.js');

      // Get the appropriate adapter
      const adapter = getWebhookAdapter(gateway);

      // 1. Buscar tenant e webhook secret (temporariamente usar default para MVP)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'tenant_not_found' });
      }

      // For MVP: use a default secret. In production, fetch from SetupSession or Tenant.webhookSecret
      // TODO: After schema migration, use: tenant.webhookSecret
      const webhookSecret = process.env[`WEBHOOK_SECRET_${gateway.toUpperCase()}`] || 'dev-secret-change-in-production';

      // 2. Validar assinatura HMAC
      const signature = request.headers[`x-${gateway.toLowerCase()}-signature`] as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBody = (request as any).rawBody as string || JSON.stringify(request.body);

      adapter.validateSignature(rawBody, signature, webhookSecret);

      // 3. Parsear e normalizar evento
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = adapter.parseEvent(request.body as any);

      // 4. Persistir WebhookRaw com upsert (deduplicação via UNIQUE constraint)
      const webhookRaw = await prisma.webhookRaw.upsert({
        where: {
          tenantId_gateway_gatewayEventId: {
            tenantId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gateway: gateway.toLowerCase() as any,
            gatewayEventId: event.eventId,
          },
        },
        update: {}, // Se já existe, não faz nada (deduplicação)
        create: {
          tenantId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gateway: gateway.toLowerCase() as any,
          gatewayEventId: event.eventId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawPayload: request.body as any,
          eventType: event.eventType,
        },
      });

      // 5. Normalize and hash PII data for Meta CAPI (Story 008)
      const normalized = normalizeConversion(event);

      // 6. Persistir Conversion com dados normalizados e hasheados
      const conversion = await prisma.conversion.upsert({
        where: {
          tenantId_gateway_gatewayEventId: {
            tenantId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gateway: gateway.toLowerCase() as any,
            gatewayEventId: event.eventId,
          },
        },
        update: {}, // Se já existe, não faz nada (deduplicação)
        create: {
          tenantId,
          webhookRawId: webhookRaw.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gateway: gateway.toLowerCase() as any,
          gatewayEventId: event.eventId,
          amount: normalized.amount,
          currency: normalized.currency,
          // Facebook IDs (NOT hashed)
          fbc: normalized.fbc,
          fbp: normalized.fbp,
          // Contact info (HASHED)
          emailHash: normalized.emailHash,
          phoneHash: normalized.phoneHash,
          // Personal info (HASHED)
          firstNameHash: normalized.firstNameHash,
          lastNameHash: normalized.lastNameHash,
          dateOfBirthHash: normalized.dateOfBirthHash,
          // Address (HASHED)
          cityHash: normalized.cityHash,
          stateHash: normalized.stateHash,
          countryCode: normalized.countryCode,
          zipCodeHash: normalized.zipCodeHash,
          // External IDs (HASHED)
          externalIdHash: normalized.externalIdHash,
          facebookLoginId: normalized.facebookLoginIdHash,
        },
      });

      // 7. Log para rastreabilidade (audit trail)
      app.log.info(
        {
          webhookRawId: webhookRaw.id,
          conversionId: conversion.id,
          gateway,
          tenantId,
          eventId: event.eventId,
          eventType: event.eventType,
        },
        'Webhook processed and normalized'
      );

      // 8. Retornar 202 imediatamente (processamento assíncrono via Match Engine/SQS)
      return reply.code(202).send({
        ok: true,
        webhookRawId: webhookRaw.id,
        conversionId: conversion.id,
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

      if (errorMessage.includes('signature') || errorMessage.includes('Invalid')) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      if (errorMessage.includes('tenant_not_found')) {
        return reply.code(404).send({ error: 'tenant_not_found' });
      }

      return reply.code(400).send({ error: 'Webhook processing failed' });
    }
  });
}
