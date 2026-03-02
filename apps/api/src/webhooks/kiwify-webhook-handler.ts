import crypto from 'node:crypto';
import type { KiwifyWebhookBody } from '@hub/shared';
import { prisma } from '../db.js';
import { processConversionWebhook } from '../matching-engine.js';
import { normalizeKiwifyConversion, createIdentityHashes } from './utils/normalize-conversion.js';

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
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
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
  | { ok: true; eventId: string; isDuplicate: boolean; conversionId?: string; matchScore?: number }
  | { error: 'invalid_signature' | 'tenant_not_found' }
> {
  // 1. Validate HMAC-SHA256 signature
  const secret = (deps.getSecret ?? (() => process.env.KIWIFY_WEBHOOK_SECRET))();
  if (!secret || !signature || !timingSafeCompare(computeHmac(secret, rawBody), signature)) {
    return { error: 'invalid_signature' };
  }

  // 2. Verify tenant
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 3. Normalize conversion data
  const normalized = normalizeKiwifyConversion(body);

  // 4. Create deterministic event ID
  const eventId = sha256hex(
    `${tenant.id}|${normalized.gatewayEventId}|${normalized.eventType}|${normalized.amount ?? ''}|${normalized.currency ?? ''}`
  );

  // 5. Create identity records if we have PII
  const { emailHash, phoneHash } = createIdentityHashes(normalized);
  if (emailHash || phoneHash) {
    const createIdentity =
      deps.createIdentity ??
      (async (data) => {
        await prisma.identity.create({ data });
      });
    await createIdentity({ tenantId: tenant.id, emailHash, phoneHash });
  }

  // 6. Insert idempotent dedupe record
  const insertDedupe =
    deps.insertDedupe ??
    (async (data) => {
      try {
        await prisma.dedupeRegistry.create({ data });
        return true;
      } catch {
        return false;
      }
    });

  const isNew = await insertDedupe({ tenantId: tenant.id, eventId });

  // 7. If new, run matching engine
  let conversionId: string | undefined;
  let matchScore: number | undefined;

  if (isNew) {
    try {
      const webhookRaw = await prisma.webhookRaw.create({
        data: {
          tenantId: tenant.id,
          gateway: 'kiwify' as const,
          gatewayEventId: normalized.gatewayEventId,
          rawPayload: body as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          eventType: normalized.eventType,
        },
      });

      const matchResult = await processConversionWebhook(
        tenant.id,
        webhookRaw.id,
        'kiwify',
        eventId,
        {
          email: normalized.email,
          phone: normalized.phone,
          fbp: normalized.fbp,
          fbc: normalized.fbc,
          amount: normalized.amount,
          currency: normalized.currency,
        }
      );

      if (matchResult.success && matchResult.conversionId) {
        conversionId = matchResult.conversionId;
        matchScore = matchResult.matchScore;
        console.log(`[kiwify-webhook] ✓ Conversion created and matched (score: ${matchScore})`);
      }
    } catch (error) {
      console.error('[kiwify-webhook] Error in matching engine:', error);
    }
  }

  return { ok: true, eventId, isDuplicate: !isNew, conversionId, matchScore };
}
