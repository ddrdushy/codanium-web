import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET /api/tutorial/status — return tutorial progress */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });

  return NextResponse.json({
    completed: prefs?.tutorialCompleted ?? false,
    step: prefs?.tutorialStep ?? 0,
  });
}

/** PATCH /api/tutorial/status — update tutorial progress */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.step !== undefined) data.tutorialStep = body.step;
  if (body.completed !== undefined) data.tutorialCompleted = body.completed;

  await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json({ success: true });
}
