import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Health check endpoint for Docker, Nginx, and monitoring.
 * Returns 200 when app is ready to serve traffic.
 */
export async function GET() {
  try {
    // Verify DB connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database unreachable' },
      { status: 503 },
    );
  }
}
