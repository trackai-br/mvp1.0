export function buildWebhookData(input: { sessionId: string; token: string }) {
  const base = process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const path = `/api/v1/webhooks/perfectpay/${input.sessionId}/${input.token}`;

  return {
    provider: 'perfectpay' as const,
    path,
    url: `${base}${path}`,
    token: input.token
  };
}
