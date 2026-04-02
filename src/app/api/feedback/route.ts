import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** POST /api/feedback — submit feedback (any authenticated user) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const { category, rating, title, description, pageUrl, projectId } = body;

  if (!category || !title || !description) {
    return NextResponse.json({ error: 'category, title, and description are required' }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      category,
      rating: rating ?? null,
      title,
      description,
      pageUrl: pageUrl ?? null,
      projectId: projectId ?? null,
    },
  });

  return NextResponse.json({ id: feedback.id, status: feedback.status });
}

/** GET /api/feedback — list all feedback (admin only) */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const [feedback, total, stats] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { user: { select: { name: true, email: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({
      by: ['category'],
      _count: true,
    }),
  ]);

  const avgRating = await prisma.feedback.aggregate({
    _avg: { rating: true },
    where: { rating: { not: null } },
  });

  return NextResponse.json({
    feedback,
    total,
    avgRating: avgRating._avg.rating ?? 0,
    categoryBreakdown: stats.reduce((acc, s) => ({ ...acc, [s.category]: s._count }), {}),
  });
}
