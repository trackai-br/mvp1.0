export type PerfectPayValidationResult = {
  ok: boolean;
  message?: string;
};

const PERFECTPAY_BASE = process.env.PERFECTPAY_API_BASE ?? 'https://app.perfectpay.com.br';
const PERFECTPAY_VALIDATE_PATH =
  process.env.PERFECTPAY_VALIDATE_PATH ?? '/api/v1/sales/get';

export async function validatePerfectPayToken(input: {
  apiKey: string;
}): Promise<PerfectPayValidationResult> {
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
        message:
          data?.error?.message ?? data?.message ?? `Perfect Pay retornou ${response.status}`
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha de rede ao validar token da Perfect Pay.'
    };
  }
}
