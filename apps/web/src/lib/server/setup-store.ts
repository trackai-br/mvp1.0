import type { SetupSessionCreateInput, SetupSessionStatus } from '@hub/shared';

const sessions = new Map<string, SetupSessionStatus>();

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function buildWebhookData(input: {
  requestOrigin: string;
  sessionId: string;
  token: string;
}) {
  const path = `/api/v1/webhooks/perfectpay/${input.sessionId}/${input.token}`;
  return {
    provider: 'perfectpay' as const,
    path,
    url: `${input.requestOrigin}${path}`,
    token: input.token
  };
}

export function createSetupSession(input: {
  payload: SetupSessionCreateInput;
  requestOrigin: string;
}): SetupSessionStatus {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const token = generateToken();

  const session: SetupSessionStatus = {
    id,
    projectName: input.payload.projectName,
    state: 'created',
    createdAt: now,
    updatedAt: now,
    input: input.payload,
    webhook: buildWebhookData({
      requestOrigin: input.requestOrigin,
      sessionId: id,
      token
    }),
    checks: {
      gatewayCredentials: 'pending',
      metaToken: 'pending',
      landingProbe: 'pending'
    },
    issues: []
  };

  sessions.set(id, session);
  return session;
}

export function getSetupSession(id: string): SetupSessionStatus | null {
  return sessions.get(id) ?? null;
}

export function saveSetupSession(session: SetupSessionStatus): void {
  session.updatedAt = new Date().toISOString();
  sessions.set(session.id, session);
}
