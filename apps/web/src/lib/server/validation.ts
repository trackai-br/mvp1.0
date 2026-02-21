import type { SetupSessionStatus } from '@/lib/contracts';

const GRAPH_BASE = process.env.META_GRAPH_API_BASE ?? 'https://graph.facebook.com/v21.0';
const PERFECTPAY_BASE = process.env.PERFECTPAY_API_BASE ?? 'https://app.perfectpay.com.br';
const PERFECTPAY_VALIDATE_PATH = process.env.PERFECTPAY_VALIDATE_PATH ?? '/api/v1/sales/get';

async function validateMetaToken(input: {
  pixelId: string;
  accessToken: string;
}): Promise<{ ok: boolean; message?: string }> {
  const url = new URL(`${GRAPH_BASE}/${input.pixelId}`);
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', input.accessToken);

  try {
    const response = await fetch(url.toString(), { method: 'GET' });
    const data = (await response.json().catch(() => null)) as
      | { id?: string; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error?.message ?? `Meta API retornou ${response.status}`
      };
    }

    return data?.id ? { ok: true } : { ok: false, message: 'Pixel nao encontrado.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Erro de rede ao validar Meta.'
    };
  }
}

async function validatePerfectPay(input: {
  apiKey: string;
}): Promise<{ ok: boolean; message?: string }> {
  const endpoint = `${PERFECTPAY_BASE}${PERFECTPAY_VALIDATE_PATH}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({ page: 1 })
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error?.message ?? data?.message ?? `Perfect Pay retornou ${response.status}`
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Erro de rede ao validar Perfect Pay.'
    };
  }
}

export async function runValidations(session: SetupSessionStatus): Promise<SetupSessionStatus> {
  const issues: string[] = [];

  const perfectPayResult = await validatePerfectPay({ apiKey: session.input.gateway.apiKey });
  const webhookOk = session.input.gateway.webhookSecret.trim().length >= 8;
  const gatewayOk = perfectPayResult.ok && webhookOk;

  const metaResult = await validateMetaToken({
    pixelId: session.input.meta.pixelId,
    accessToken: session.input.meta.accessToken
  });

  const landingOk = /^https?:\/\//.test(session.input.landingUrl);

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
