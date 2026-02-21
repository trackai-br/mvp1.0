import { describe, it, expect, vi } from 'vitest';

// Evita import de .prisma/client (não disponível em ambiente de teste)
vi.mock('./db', () => ({ prisma: {} }));

import { handleClickIngest } from './click-handler';

const fakeRequest = {
  ip: '1.2.3.4',
  headers: { 'user-agent': 'Mozilla/5.0' },
};

describe('handleClickIngest', () => {
  it('retorna tenant_not_found quando tenant nao existe', async () => {
    const result = await handleClickIngest('nao-existe', {}, fakeRequest, {
      findTenant: async () => null,
    });
    expect(result).toEqual({ error: 'tenant_not_found' });
  });

  it('cria click e retorna id quando tenant existe', async () => {
    const result = await handleClickIngest(
      'tenant-123',
      { fbclid: 'abc123', utmSource: 'google' },
      fakeRequest,
      {
        findTenant: async (id) => ({ id }),
        createClick: async (data) => {
          expect(data.tenantId).toBe('tenant-123');
          expect(data.fbclid).toBe('abc123');
          expect(data.utmSource).toBe('google');
          expect(data.ip).toBe('1.2.3.4');
          expect(data.userAgent).toBe('Mozilla/5.0');
          return { id: 'click-uuid-001' };
        },
      }
    );
    expect(result).toEqual({ id: 'click-uuid-001' });
  });

  it('cria click sem campos opcionais', async () => {
    const result = await handleClickIngest('tenant-123', {}, fakeRequest, {
      findTenant: async (id) => ({ id }),
      createClick: async () => ({ id: 'click-uuid-002' }),
    });
    expect(result).toEqual({ id: 'click-uuid-002' });
  });

  it('usa x-forwarded-for quando ip direto nao disponivel', async () => {
    const created = vi.fn(async () => ({ id: 'click-uuid-003' }));
    await handleClickIngest(
      'tenant-123',
      {},
      { ip: undefined, headers: { 'x-forwarded-for': '9.9.9.9', 'user-agent': 'bot' } },
      { findTenant: async (id) => ({ id }), createClick: created }
    );
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ ip: '9.9.9.9' }));
  });
});
