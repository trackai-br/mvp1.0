import crypto from 'node:crypto';
import type { PerfectPayWebhookBody } from '@hub/shared';
import { prisma } from './db.js';

export type PerfectPayHandlerDeps = {
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
    // Se signature não for hex válido, falha seguramente
    return false;
  }
}

export async function handlePerfectPayWebhook(
  tenantId: string,
  body: PerfectPayWebhookBody,
  rawBody: string,
  signature: string | undefined,
  deps: PerfectPayHandlerDeps = {}
): Promise<
  | { ok: true; eventId: string; isDuplicate: boolean }
  | { error: 'invalid_signature' | 'tenant_not_found' }
> {
  // 1. Validar assinatura HMAC-SHA256 (timing-safe comparison)
  const secret = (deps.getSecret ?? (() => process.env.PERFECTPAY_WEBHOOK_SECRET))();
  if (!secret || !signature || !timingSafeCompare(computeHmac(secret, rawBody), signature)) {
    return { error: 'invalid_signature' };
  }

  // 2. Verificar tenant
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 3. Hash SHA-256 de PII (LGPD — nunca persiste plain text)
  const emailHash = body.customer?.email
    ? sha256hex(body.customer.email.toLowerCase().trim())
    : undefined;
  const phoneHash = body.customer?.phone
    ? sha256hex(body.customer.phone.replace(/\D/g, ''))
    : undefined;

  // 4. event_id determinístico
  const eventId = sha256hex(
    `${tenant.id}|${body.order_id}|purchase|${body.amount ?? ''}|${body.currency ?? ''}`
  );

  // 5. Persistir identity (sem deduplicar — matching engine cuida disso na Story 007)
  if (emailHash || phoneHash) {
    const createIdentity =
      deps.createIdentity ??
      (async (data) => {
        await prisma.identity.create({ data });
      });
    await createIdentity({ tenantId: tenant.id, emailHash, phoneHash });
  }

  // 6. Insert idempotente em dedupe_registry (unique constraint: tenantId + eventId)
  const insertDedupe =
    deps.insertDedupe ??
    (async (data) => {
      try {
        await prisma.dedupeRegistry.create({ data });
        return true;
      } catch {
        return false; // violação de constraint = evento duplicado
      }
    });

  const isNew = await insertDedupe({ tenantId: tenant.id, eventId });

  return { ok: true, eventId, isDuplicate: !isNew };
}
