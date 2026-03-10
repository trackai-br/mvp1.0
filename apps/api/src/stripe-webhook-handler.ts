import crypto from 'node:crypto';
import type { StripeWebhookBody } from '@hub/shared';
import { prisma } from './db.js';

export type StripeHandlerDeps = {
  getSecret?: () => string | undefined;
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createIdentity?: (data: { tenantId: string; emailHash?: string; phoneHash?: string }) => Promise<void>;
  insertDedupe?: (data: { tenantId: string; eventId: string }) => Promise<boolean>;
};

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function timingSafeCompare(computed: string, signature: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Validata Stripe signature
 * Format: t=timestamp,v1=signature
 * Validation: HMAC_SHA256(timestamp.body, secret) should match signature
 */
function validateStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  // Parse header: "t=1234567890,v1=abcd..."
  const pairs = signatureHeader.split(',');
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) return false;

  // Reject if timestamp is too old (> 5 minutes)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestampSeconds = parseInt(timestamp, 10);
  if (isNaN(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }

  // Compute HMAC: SHA256(timestamp.rawBody, secret)
  const signedContent = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedContent, 'utf8')
    .digest('hex');

  return timingSafeCompare(expectedSignature, signature);
}

export async function handleStripeWebhook(
  tenantId: string,
  body: StripeWebhookBody,
  rawBody: string,
  signatureHeader: string | undefined,
  deps: StripeHandlerDeps = {}
): Promise<
  | { ok: true; eventId: string; isDuplicate: boolean }
  | { error: 'invalid_signature' | 'tenant_not_found' }
> {
  // 1. Validar assinatura Stripe (especial: t=timestamp,v1=signature)
  const secret = (deps.getSecret ?? (() => process.env.STRIPE_WEBHOOK_SECRET))();
  if (!secret || !validateStripeSignature(rawBody, signatureHeader, secret)) {
    return { error: 'invalid_signature' };
  }

  // 2. Apenas processar payment_intent.succeeded
  if (body.type !== 'payment_intent.succeeded') {
    return { ok: true, eventId: body.id, isDuplicate: false };
  }

  // 3. Verificar tenant
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 4. Extrair dados de identidade (PII) do charges.data[0].billing_details
  let email: string | undefined;
  let phone: string | undefined;

  const charge = body.data?.object?.charges?.data?.[0];
  if (charge?.billing_details) {
    email = charge.billing_details.email?.toLowerCase().trim();
    phone = charge.billing_details.phone?.replace(/\D/g, '');
  }

  const emailHash = email ? sha256hex(email) : undefined;
  const phoneHash = phone ? sha256hex(phone) : undefined;

  // 5. Criar/upsert identity
  const createIdentity = deps.createIdentity ?? (async (data) => {
    // Create identity with email hash if present, ignoring duplicates
    if (data.emailHash) {
      await prisma.identity.create({
        data: { tenantId, emailHash: data.emailHash, phoneHash: data.phoneHash },
      }).catch(() => {
        // Ignore constraint violation — identity with this email already exists
      });
    }
  });

  if (emailHash || phoneHash) {
    await createIdentity({ tenantId, emailHash, phoneHash });
  }

  // 6. Gerar event_id determinístico
  // Format: SHA256(tenantId | payment_intent_id | "payment_intent" | amount (cents) | currency)
  const paymentIntentId = body.data?.object?.id || 'unknown';
  const amount = body.data?.object?.amount || 0; // in cents
  const currency = body.data?.object?.currency || 'usd';
  const eventId = sha256hex(`${tenantId}|${paymentIntentId}|payment_intent|${amount}|${currency}`);

  // 7. Registrar dedupe
  const insertDedupe = deps.insertDedupe ?? (async (data) => {
    try {
      await prisma.dedupeRegistry.create({ data });
      return true;
    } catch {
      return false;
    }
  });

  const isNew = await insertDedupe({ tenantId, eventId });

  // 8. Se webhook é novo, persistir WebhookRaw
  if (isNew) {
    try {
      await prisma.webhookRaw.create({
        data: {
          tenantId,
          gateway: 'stripe' as const,
          gatewayEventId: eventId,
          rawPayload: body as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          eventType: 'payment_intent.succeeded',
        },
      });
    } catch (error) {
      console.error('[stripe-webhook] Error persisting WebhookRaw:', error);
      // Don't fail webhook on persistence error
    }
  }

  return {
    ok: true,
    eventId,
    isDuplicate: !isNew,
  };
}
