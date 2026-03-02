import crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));

import { handleKiwifyWebhook } from './kiwify-webhook-handler.js';

const SECRET = 'test-secret-kiwify';
const TENANT_ID = 'tenant-kiwify-001';

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

const validBody = {
  event: 'sale.confirmed',
  id: 'evt-kiwify-001',
  data: {
    id: 'KW-98765',
    status: 'confirmed',
    amount: 49.90,
    currency: 'BRL',
    customer: {
      email: 'buyer@EXAMPLE.COM',
      phone: '+55 21 3333-4444',
    },
  },
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

describe('handleKiwifyWebhook', () => {
  it('retorna invalid_signature quando signature está ausente', async () => {
    const result = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, undefined, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando signature está errada', async () => {
    const result = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, 'wrong-signature', baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando secret não está configurado', async () => {
    const result = await handleKiwifyWebhook(
      TENANT_ID,
      validBody,
      rawBody,
      validSig,
      { ...baseDeps, getSecret: () => undefined }
    );
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna tenant_not_found quando tenant não existe', async () => {
    const result = await handleKiwifyWebhook(
      'tenant-inexistente',
      validBody,
      rawBody,
      validSig,
      baseDeps
    );
    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('cria identity com PII hasheado corretamente', async () => {
    const createIdentity = vi.fn(async () => {});
    const insertDedupe = vi.fn(async () => true);

    const result = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, validSig, {
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

    const result1 = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    const result2 = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result1 as any).eventId).toBe((result2 as any).eventId);
  });

  it('detecta duplicata', async () => {
    const insertDedupe = vi.fn(async () => false);

    const result = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('normaliza phone antes de hashear', async () => {
    const createIdentity = vi.fn(async () => {});

    await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { phoneHash?: string } | undefined;
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('pula createIdentity se sem contato', async () => {
    const createIdentity = vi.fn(async () => {});
    const bodyNoContact = {
      ...validBody,
      data: { ...validBody.data, customer: { name: 'John' } },
    };

    const result = await handleKiwifyWebhook(
      TENANT_ID,
      bodyNoContact,
      JSON.stringify(bodyNoContact),
      sign(JSON.stringify(bodyNoContact)),
      { ...baseDeps, createIdentity }
    );

    expect(result).toMatchObject({ ok: true });
    expect(createIdentity).not.toHaveBeenCalled();
  });

  it('usa timing-safe comparison para HMAC', async () => {
    const fakeHexSig = 'a'.repeat(64);

    const result = await handleKiwifyWebhook(TENANT_ID, validBody, rawBody, fakeHexSig, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });
});
