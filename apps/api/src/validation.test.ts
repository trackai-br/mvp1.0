import { describe, expect, it } from 'vitest';
import type { SetupSessionStatus } from '@hub/shared';
import { runValidations } from './validation';

function makeSession(): SetupSessionStatus {
  return {
    id: 's1',
    projectName: 'Track AI',
    state: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: {
      projectName: 'Track AI',
      trackingEnvironment: 'lp',
      landingUrl: 'https://example.com',
      meta: {
        pixelId: '12345',
        accessToken: 'token-super-valido',
        adAccountId: 'act_123'
      },
      gateway: {
        platform: 'perfectpay',
        apiKey: 'api-key-12345',
        webhookSecret: 'secret-12345'
      }
    },
    webhook: {
      provider: 'perfectpay',
      path: '/api/v1/webhooks/perfectpay/s1/token',
      url: 'http://localhost:3001/api/v1/webhooks/perfectpay/s1/token',
      token: 'token'
    },
    checks: {
      gatewayCredentials: 'pending',
      metaToken: 'pending',
      landingProbe: 'pending'
    },
    issues: []
  };
}

describe('runValidations', () => {
  it('marks session as validated when all checks pass', async () => {
    const session = makeSession();
    const out = await runValidations(session, {
      validateMetaToken: async () => ({ ok: true }),
      validatePerfectPay: async () => ({ ok: true })
    });

    expect(out.state).toBe('validated');
    expect(out.issues).toHaveLength(0);
    expect(out.checks.gatewayCredentials).toBe('ok');
    expect(out.checks.metaToken).toBe('ok');
    expect(out.checks.landingProbe).toBe('ok');
  });

  it('marks session for troubleshooting when checks fail', async () => {
    const session = makeSession();
    session.input.landingUrl = 'ftp://bad';

    const out = await runValidations(session, {
      validateMetaToken: async () => ({ ok: false, message: 'Invalid OAuth access token.' }),
      validatePerfectPay: async () => ({ ok: false, message: 'Token invalido.' })
    });

    expect(out.state).toBe('troubleshooting_required');
    expect(out.issues.length).toBeGreaterThan(0);
    expect(out.checks.gatewayCredentials).toBe('failed');
    expect(out.checks.metaToken).toBe('failed');
    expect(out.checks.landingProbe).toBe('failed');
  });
});
