import { setupSessionStatusSchema } from '@/lib/contracts';
import { NextResponse } from 'next/server';
import { getSetupSession } from '@/lib/server/setup-store';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = getSetupSession(id);

  if (!session) {
    return NextResponse.json({ message: 'Setup session nao encontrada.' }, { status: 404 });
  }

  const parsed = setupSessionStatusSchema.safeParse(session);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Estado de sessao invalido.' }, { status: 500 });
  }

  return NextResponse.json(session);
}
