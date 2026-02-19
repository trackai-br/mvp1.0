import { NextResponse } from 'next/server';
import { getSetupSession } from '@/lib/server/setup-store';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; token: string }> }
) {
  const { sessionId, token } = await context.params;
  const session = getSetupSession(sessionId);

  if (!session) {
    return NextResponse.json({ message: 'Sessao nao encontrada para webhook.' }, { status: 404 });
  }

  if (session.webhook.token !== token) {
    return NextResponse.json({ message: 'Token de webhook invalido.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  console.log('Perfect Pay webhook recebido', { sessionId, payload });

  return NextResponse.json({ ok: true }, { status: 202 });
}
