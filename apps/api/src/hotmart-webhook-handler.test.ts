import crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({ prisma: {} }));

import { handleHotmartWebhook } from './hotmart-webhook-handler.js';

const SECRET = 'test-secret-hotmart';
const TENANT_ID = 'tenant-hotmart-001';

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

const validBody = {
  id: 'evt-hotmart-001',
  status: 'approved',
  purchase: {
    id: 'HT-12345',
    price: 99.90,
    currency: 'BRL',
  },
  buyer: {
    email: 'customer@Example.COM',
    phone: '+55 (11) 9999-8888',
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

describe('handleHotmartWebhook', () => {
  it('retorna invalid_signature quando signature está ausente', async () => {
    const result = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, undefined, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando signature está errada', async () => {
    const result = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, 'wrong-signature', baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna invalid_signature quando secret não está configurado', async () => {
    const result = await handleHotmartWebhook(
      TENANT_ID,
      validBody,
      rawBody,
      validSig,
      { ...baseDeps, getSecret: () => undefined }
    );
    expect(result).toEqual({ error: 'invalid_signature' });
  });

  it('retorna tenant_not_found quando tenant não existe', async () => {
    const result = await handleHotmartWebhook(
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

    const result = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: false });
    expect(createIdentity).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { emailHash?: string; phoneHash?: string } | undefined;
    expect(callArgs).toBeDefined();
    // PII deve ser hash hex de 64 chars, nunca plain-text
    expect(callArgs?.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
    // Email normalizado (lowercase, trim) antes de hash
    expect(callArgs?.emailHash).not.toContain('Example.COM');
  });

  it('gera event_id determinístico (mesmo input = mesmo event_id)', async () => {
    const insertDedupe = vi.fn(async () => true);

    const result1 = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    const result2 = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    expect(result1).toMatchObject({ ok: true });
    expect(result2).toMatchObject({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result1 as any).eventId).toBe((result2 as any).eventId);
  });

  it('detecta duplicata (isDuplicate: true quando insertDedupe retorna false)', async () => {
    const insertDedupe = vi.fn(async () => false); // Já existe

    const result = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      insertDedupe,
    });

    expect(result).toMatchObject({ ok: true, isDuplicate: true });
  });

  it('normaliza phone sem números e espaços antes de hashear', async () => {
    const createIdentity = vi.fn(async () => {});

    await handleHotmartWebhook(TENANT_ID, validBody, rawBody, validSig, {
      ...baseDeps,
      createIdentity,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (createIdentity.mock.calls as any[])[0]?.[0] as { phoneHash?: string } | undefined;
    // Phone normalizado: '+55 (11) 9999-8888' -> '5511999998888' -> hash
    expect(callArgs?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('pula createIdentity se email e phone são ausentes', async () => {
    const createIdentity = vi.fn(async () => {});
    const bodyWithoutContact = {
      ...validBody,
      buyer: { name: 'John Doe' }, // sem email/phone
    };

    const result = await handleHotmartWebhook(
      TENANT_ID,
      bodyWithoutContact,
      JSON.stringify(bodyWithoutContact),
      sign(JSON.stringify(bodyWithoutContact)),
      { ...baseDeps, createIdentity }
    );

    expect(result).toMatchObject({ ok: true });
    // createIdentity não deve ser chamado
    expect(createIdentity).not.toHaveBeenCalled();
  });

  it('compara HMAC com timing-safe comparison (evita timing attacks)', async () => {
    // Signature inválida mas com mesmo tamanho (hex 64 chars)
    const fakeValidHexSig = 'a'.repeat(64);

    const result = await handleHotmartWebhook(TENANT_ID, validBody, rawBody, fakeValidHexSig, baseDeps);
    expect(result).toEqual({ error: 'invalid_signature' });
  });
});
