import { NextResponse } from 'next/server';
import { getSetupSession, saveSetupSession } from '@/lib/server/setup-store';
import { runValidations } from '@/lib/server/validation';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = getSetupSession(id);

  if (!session) {
    return NextResponse.json({ message: 'Setup session nao encontrada.' }, { status: 404 });
  }

  const validated = await runValidations(session);
  saveSetupSession(validated);

  return NextResponse.json(validated);
}
