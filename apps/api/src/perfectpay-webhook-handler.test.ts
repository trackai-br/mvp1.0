import crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));

import { handlePerfectPayWebhook } from './perfectpay-webhook-handler.js';

const SECRET = 'test-secret-key';
const TENANT_ID = 'tenant-abc';

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

const validBody = {
  order_id: 'ORD-001',
  customer: { email: 'Lead@Example.com', phone: '+55 11 91234-5678' },
  amount: 197,
  currency: 'BRL',
  status: 'approved',
};
const rawBody = JSON.stringify(validBody);
const validSig = sign(rawBody);

const fakeTenant = { id: TENANT_ID };
const baseDeps = {
  getSecret: () => SECRET,
  findTenant: async (id: string) => (id === TENANT_ID ? fakeTenant : null),
  createIdentity: vi.fn(async () => {}),
  insertDedupe: vi.fn(async () => true),
};

describe('handlePerfectPayWebhook', () => {
  it('retorna invalid_signature quando signature está ausente', async () => {
    const result = await handlePerfectPayWebhook(TENANT_ID, validBody, rawBody, undefined, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando signature está errada', async () => {
    const result = await handlePerfectPayWebhook(TENANT_ID, validBody, rawBody, 'assinatura-errada', baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando secret não está configurado', async () => {
    const result = await handlePerfectPayWebhook(
      TENANT_ID, validBody, rawBody, validSig,
      { ...baseDeps, getSecret: () => undefined }
    );
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna tenant_not_found quando tenant não existe', async () => {
    const result = await handlePerfectPayWebhook(
      'tenant-inexistente', validBody, rawBody, validSig,
      baseDeps
    );
    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('cria identity e retorna ok para payload válido', async () => {
    const createIdentity = vi.fn(async () => {});
    const insertDedupe = vi.fn(async () => true);

    const result = await handlePerfectPayWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: false });
    expect(createIdentity).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { emailHash?: string; phoneHash?: string } | undefined;
    expect(callArgs).toBeDefined();
    // PII nunca é texto puro — deve ser hash hex de 64 chars
    expect(callArgs?.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
    // email normalizado (lowercase) antes do hash
    expect(callArgs?.emailHash).not.toContain('Lead@Example.com');
  });

  it('retorna isDuplicate: true quando event_id já existe', async () => {
    const result = await handlePerfectPayWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe: async () => false,
    });
    expect(result).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('não cria identity quando customer está ausente', async () => {
    const bodySemCustomer = { order_id: 'ORD-002' };
    const raw = JSON.stringify(bodySemCustomer);
    const createIdentity = vi.fn(async () => {});

    await handlePerfectPayWebhook(TENANT_ID, bodySemCustomer, raw, sign(raw), {
      ...baseDeps,
      createIdentity,
    });

    expect(createIdentity).not.toHaveBeenCalled();
  });

  it('event_id é determinístico para mesmos inputs', async () => {
    const eventIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const r = await handlePerfectPayWebhook(TENANT_ID, validBody, rawBody, validSig, {
        ...baseDeps,
        insertDedupe: async () => true,
      });
      if ('ok' in r) eventIds.push(r.eventId);
    }
    expect(eventIds).toHaveLength(2);
    expect(eventIds[0]).toBe(eventIds[1]);
  });
});
