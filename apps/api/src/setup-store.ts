import type { SetupSessionCreateInput, SetupSessionStatus } from '@hub/shared';
import { buildWebhookData } from './webhook-utils.js';
import { prisma } from './db.js';

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function toSessionStatus(row: {
  id: string;
  projectName: string;
  state: string;
  webhookToken: string;
  createdAt: Date;
  updatedAt: Date;
  input: unknown;
  issues: unknown;
  checks: unknown;
}): SetupSessionStatus {
  return {
    id: row.id,
    projectName: row.projectName,
    state: row.state as SetupSessionStatus['state'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    input: row.input as SetupSessionCreateInput,
    webhook: buildWebhookData({ sessionId: row.id, token: row.webhookToken }),
    issues: (row.issues as string[]) ?? [],
    checks: (row.checks as SetupSessionStatus['checks']) ?? {
      gatewayCredentials: 'pending',
      metaToken: 'pending',
      landingProbe: 'pending',
    },
  };
}

export async function createSetupSession(input: SetupSessionCreateInput): Promise<SetupSessionStatus> {
  const id = crypto.randomUUID();
  const webhookToken = generateToken();

  const row = await prisma.setupSession.create({
    data: {
      id,
      projectName: input.projectName,
      state: 'created',
      webhookToken,
      input: input as object,
      issues: [],
      checks: {
        gatewayCredentials: 'pending',
        metaToken: 'pending',
        landingProbe: 'pending',
      },
    },
  });

  return toSessionStatus(row);
}

export async function getSetupSession(id: string): Promise<SetupSessionStatus | null> {
  const row = await prisma.setupSession.findUnique({ where: { id } });
  if (!row) return null;
  return toSessionStatus(row);
}

export async function saveSetupSession(session: SetupSessionStatus): Promise<void> {
  await prisma.setupSession.update({
    where: { id: session.id },
    data: {
      state: session.state,
      issues: session.issues,
      checks: session.checks as object,
    },
  });
}
