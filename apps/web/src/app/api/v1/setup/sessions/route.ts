import { setupSessionCreateSchema } from '@hub/shared';
import { NextResponse } from 'next/server';
import { createSetupSession } from '@/lib/server/setup-store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = setupSessionCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const session = createSetupSession({
    payload: parsed.data,
    requestOrigin: origin
  });

  return NextResponse.json(session, { status: 201 });
}
