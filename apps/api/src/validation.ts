import type { SetupSessionStatus } from '@hub/shared';
import { validateMetaTokenRemote, type MetaValidationResult } from './meta-client';
import {
  validatePerfectPayToken,
  type PerfectPayValidationResult
} from './perfectpay-client';

type ValidationDeps = {
  validateMetaToken?: (input: {
    pixelId: string;
    accessToken: string;
  }) => Promise<MetaValidationResult>;
  validatePerfectPay?: (input: { apiKey: string }) => Promise<PerfectPayValidationResult>;
};

export async function runValidations(
  session: SetupSessionStatus,
  deps: ValidationDeps = {}
): Promise<SetupSessionStatus> {
  const issues: string[] = [];
  const validateMetaToken = deps.validateMetaToken ?? validateMetaTokenRemote;
  const validatePerfectPay = deps.validatePerfectPay ?? validatePerfectPayToken;

  const perfectPayResult = await validatePerfectPay({
    apiKey: session.input.gateway.apiKey
  });

  const webhookOk = session.input.gateway.webhookSecret.trim().length >= 8;
  const gatewayOk = perfectPayResult.ok && webhookOk;
  const landingOk = /^https?:\/\//.test(session.input.landingUrl);

  const metaResult = await validateMetaToken({
    pixelId: session.input.meta.pixelId,
    accessToken: session.input.meta.accessToken
  });

  session.checks.gatewayCredentials = gatewayOk ? 'ok' : 'failed';
  session.checks.metaToken = metaResult.ok ? 'ok' : 'failed';
  session.checks.landingProbe = landingOk ? 'ok' : 'failed';

  if (!gatewayOk) {
    issues.push(
      `Falha na validacao de credenciais da Perfect Pay${
        perfectPayResult.message ? `: ${perfectPayResult.message}` : '.'
      }`
    );
  }
  if (!metaResult.ok) {
    issues.push(
      `Falha na validacao do token/pixel Meta${metaResult.message ? `: ${metaResult.message}` : '.'}`
    );
  }
  if (!landingOk) {
    issues.push('Falha no probe da URL da landing page.');
  }

  session.issues = issues;
  session.state = issues.length === 0 ? 'validated' : 'troubleshooting_required';

  return session;
}
