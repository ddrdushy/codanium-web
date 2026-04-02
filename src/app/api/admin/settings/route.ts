import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { invalidateGuardrailConfigCache } from '@/lib/ai/orchestration/guardrails';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/settings
 * Load all admin settings as a { key: parsedValue } object.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const settings = await prisma.adminSetting.findMany();

    // Build a key-value map, attempting JSON parse for each value
    const result: Record<string, unknown> = {};
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        // If not valid JSON, return as raw string
        result[setting.key] = setting.value;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Accept { key: value } pairs and upsert each to the AdminSetting table.
 * Creates an audit log entry for each updated setting.
 */
export async function PUT(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object of { key: value } pairs' },
        { status: 400 }
      );
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No settings provided' },
        { status: 400 }
      );
    }

    const adminId = (session!.user as any).id;
    const ipAddress = request.headers.get('x-forwarded-for') ?? 'unknown';

    // Upsert each setting and create audit logs
    const upsertPromises = entries.map(([key, value]) => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      return prisma.adminSetting.upsert({
        where: { key },
        create: {
          key,
          value: serializedValue,
          updatedBy: adminId,
        },
        update: {
          value: serializedValue,
          updatedBy: adminId,
        },
      });
    });

    const auditPromises = entries.map(([key, value]) =>
      prisma.auditLog.create({
        data: {
          action: 'admin.updateSetting',
          target: `setting:${key}`,
          details: `Updated setting "${key}" to "${typeof value === 'string' ? value : JSON.stringify(value)}"`,
          ipAddress,
          userId: adminId,
        },
      })
    );

    await Promise.all([...upsertPromises, ...auditPromises]);

    // Invalidate guardrail config cache if guardrail settings were updated
    if (entries.some(([key]) => key.startsWith('guardrails'))) {
      await invalidateGuardrailConfigCache();
    }

    // Return the updated settings map
    const allSettings = await prisma.adminSetting.findMany();
    const result: Record<string, unknown> = {};
    for (const setting of allSettings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        result[setting.key] = setting.value;
      }
    }

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
