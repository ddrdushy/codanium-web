import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { sendEmail, invalidateEmailConfigCache } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/email/test
 * Send a test email to the admin's own address to verify email configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const adminEmail = (session.user as any)?.email;
    const adminName = session.user?.name ?? 'Admin';

    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Could not determine admin email address' },
        { status: 400 },
      );
    }

    // Invalidate cache to pick up any recent config changes
    await invalidateEmailConfigCache();

    const success = await sendEmail({
      to: adminEmail,
      subject: 'Test Email — Codanium',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #18181b; border-radius: 8px 8px 0 0; padding: 24px 32px;">
            <h1 style="color: #f59e0b; font-size: 20px; margin: 0;">Codanium</h1>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #18181b; font-size: 20px; margin: 0 0 16px 0;">Email Configuration Test</h2>
            <p style="color: #374151; font-size: 15px; line-height: 24px;">
              Hi ${adminName}, this is a test email from Codanium.
              If you're reading this, your email configuration is working correctly!
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px 16px; margin: 20px 0;">
              <p style="color: #166534; font-size: 14px; margin: 0; font-weight: 500;">
                Email service is configured and operational.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `,
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${adminEmail}`,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send test email. Check your email configuration.' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('POST /api/admin/email/test error:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 },
    );
  }
}
