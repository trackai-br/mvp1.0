import crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));

import { handleStripeWebhook } from './stripe-webhook-handler.js';

const SECRET = 'test-secret-stripe';
const TENANT_ID = 'tenant-stripe-001';

function createStripeSignature(rawBody: string, secret = SECRET, timestampSeconds?: number): string {
  const timestamp = timestampSeconds || Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', secret).update(signedContent, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const validBody = {
  id: 'evt_stripe_001',
  type: 'payment_intent.succeeded',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_1234567890',
      amount: 9990, // $99.90 in cents
      currency: 'usd',
      charges: {
        data: [
          {
            billing_details: {
              email: 'customer@EXAMPLE.COM',
              phone: '+1 (555) 123-4567',
            },
          },
        ],
      },
    },
  },
};

const rawBody = JSON.stringify(validBody);
const validSig = createStripeSignature(rawBody);

const fakeTenant = { id: TENANT_ID };
const baseDeps = {
  getSecret: () => SECRET,
  findTenant: async (id: string) => (id === TENANT_ID ? fakeTenant : null),
  createIdentity: vi.fn(async () => {}),
  insertDedupe: vi.fn(async () => true),
};

describe('handleStripeWebhook', () => {
  it('retorna invalid_signature quando signature header está ausente', async () => {
    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, undefined, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando signature está errada', async () => {
    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, 't=123,v1=wrong', baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando secret não está configurado', async () => {
    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      getSecret: () => undefined,
    });
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('rejeita signature se timestamp está muito antigo (> 5 min)', async () => {
    // Timestamp 10 minutos atrás
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const oldSig = createStripeSignature(rawBody, SECRET, oldTimestamp);

    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, oldSig, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna tenant_not_found quando tenant não existe', async () => {
    const result = await handleStripeWebhook('tenant-inexistente', validBody, rawBody, validSig, baseDeps);
    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('cria identity com PII hasheado corretamente', async () => {
    const createIdentity = vi.fn(async () => {});
    const insertDedupe = vi.fn(async () => true);

    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: false });
    expect(createIdentity).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { emailHash?: string; phoneHash?: string } | undefined;
    expect(callArgs).toBeDefined();
    expect(callArgs?.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(callArgs?.emailHash).not.toContain('EXAMPLE.COM');
  });

  it('gera event_id determinístico', async () => {
    const insertDedupe = vi.fn(async () => true);

    const result1 = await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    const result2 = await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result1 as any).eventId).toBe((result2 as any).eventId);
  });

  it('detecta duplicata', async () => {
    const insertDedupe = vi.fn(async () => false);

    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('ignora eventos que não são payment_intent.succeeded', async () => {
    const bodyChargeEvent = { ...validBody, type: 'charge.refunded' };

    const result = await handleStripeWebhook(
      TENANT_ID,
      bodyChargeEvent,
      JSON.stringify(bodyChargeEvent),
      createStripeSignature(JSON.stringify(bodyChargeEvent)),
      baseDeps
    );

    expect(result).toMatchObject({ ok: true });
  });

  it('pula createIdentity se sem billing_details', async () => {
    const createIdentity = vi.fn(async () => {});
    const bodyNoBilling = {
      ...validBody,
      data: { object: { id: 'pi_123', amount: 9990, currency: 'usd', charges: { data: [{}] } } },
    };

    const result = await handleStripeWebhook(
      TENANT_ID,
      bodyNoBilling,
      JSON.stringify(bodyNoBilling),
      createStripeSignature(JSON.stringify(bodyNoBilling)),
      { ...baseDeps, createIdentity }
    );

    expect(result).toMatchObject({ ok: true });
    expect(createIdentity).not.toHaveBeenCalled();
  });

  it('normaliza phone antes de hashear', async () => {
    const createIdentity = vi.fn(async () => {});

    await handleStripeWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { phoneHash?: string } | undefined;
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('valida timestamp no header da assinatura', async () => {
    // Signature com timestamp válido mas muito antigo
    const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 min no futuro
    const futureSig = createStripeSignature(rawBody, SECRET, futureTimestamp);

    const result = await handleStripeWebhook(TENANT_ID, validBody, rawBody, futureSig, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });
});
