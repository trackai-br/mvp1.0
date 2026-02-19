import type { SetupSessionCreateInput, SetupSessionStatus } from '@hub/shared';
import { buildWebhookData } from './webhook-utils';

const sessions = new Map<string, SetupSessionStatus>();

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function createSetupSession(input: SetupSessionCreateInput): SetupSessionStatus {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const webhookToken = generateToken();

  const session: SetupSessionStatus = {
    id,
    projectName: input.projectName,
    state: 'created',
    createdAt: now,
    updatedAt: now,
    input,
    webhook: buildWebhookData({
      sessionId: id,
      token: webhookToken
    }),
    checks: {
      gatewayCredentials: 'pending',
      metaToken: 'pending',
      landingProbe: 'pending'
    },
    issues: []
  };

  sessions.set(session.id, session);
  return session;
}

export function getSetupSession(id: string): SetupSessionStatus | null {
  return sessions.get(id) ?? null;
}

export function saveSetupSession(session: SetupSessionStatus): void {
  session.updatedAt = new Date().toISOString();
  sessions.set(session.id, session);
}
