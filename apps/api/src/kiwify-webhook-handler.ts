import crypto from 'node:crypto';
import type { KiwifyWebhookBody } from '@hub/shared';
import { prisma } from './db.js';

export type KiwifyHandlerDeps = {
  getSecret?: () => string | undefined;
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createIdentity?: (data: { tenantId: string; emailHash?: string; phoneHash?: string }) => Promise<void>;
  insertDedupe?: (data: { tenantId: string; eventId: string }) => Promise<boolean>;
};

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
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

export async function handleKiwifyWebhook(
  tenantId: string,
  body: KiwifyWebhookBody,
  rawBody: string,
  signature: string | undefined,
  deps: KiwifyHandlerDeps = {}
): Promise<
  | { ok: true; eventId: string; isDuplicate: boolean }
  | { error: 'invalid_signature' | 'tenant_not_found' }
> {
  // 1. Validar assinatura HMAC-SHA256 (timing-safe comparison)
  const secret = (deps.getSecret ?? (() => process.env.KIWIFY_WEBHOOK_SECRET))();
  if (!secret || !signature || !timingSafeCompare(computeHmac(secret, rawBody), signature)) {
    return { error: 'invalid_signature' };
  }

  // 2. Verificar tenant
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 3. Extrair dados de identidade (PII)
  const email = body.data?.customer?.email?.toLowerCase().trim();
  const phone = body.data?.customer?.phone?.replace(/\D/g, '');
  const emailHash = email ? sha256hex(email) : undefined;
  const phoneHash = phone ? sha256hex(phone) : undefined;

  // 4. Criar/upsert identity
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

  // 5. Gerar event_id determinístico
  // Format: SHA256(tenantId | data.id | "purchase" | amount | currency)
  const orderId = body.data?.id || body.id || 'unknown';
  const amount = body.data?.amount || 0;
  const currency = body.data?.currency || 'BRL';
  const eventId = sha256hex(`${tenantId}|${orderId}|purchase|${amount}|${currency}`);

  // 6. Registrar dedupe
  const insertDedupe = deps.insertDedupe ?? (async (data) => {
    try {
      await prisma.dedupeRegistry.create({ data });
      return true;
    } catch {
      return false;
    }
  });

  const isNew = await insertDedupe({ tenantId, eventId });

  // 7. Se webhook é novo, persistir WebhookRaw
  if (isNew) {
    try {
      await prisma.webhookRaw.create({
        data: {
          tenantId,
          gateway: 'kiwify' as const,
          gatewayEventId: eventId,
          rawPayload: body as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          eventType: 'purchase_approved',
        },
      });
    } catch (error) {
      console.error('[kiwify-webhook] Error persisting WebhookRaw:', error);
      // Don't fail webhook on persistence error
    }
  }

  return {
    ok: true,
    eventId,
    isDuplicate: !isNew,
  };
}
