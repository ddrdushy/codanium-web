import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateApiKey, API_KEY_LIMITS } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vscode/auth
 *
 * OAuth-style flow for VS Code extension authentication.
 * NOTE: This route lives outside /api/auth/ to avoid NextAuth's catch-all [...nextauth] route.
 *
 * Flow:
 * 1. VS Code extension opens browser to this endpoint
 * 2. If user is not logged in, redirects to /login with return URL
 * 3. If user is logged in, generates API key and redirects to vscode:// URI
 * 4. VS Code extension catches the URI and stores the API key
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Not authenticated — redirect to login with return URL
    if (!session?.user) {
      const returnUrl = encodeURIComponent('/api/vscode/auth');
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${returnUrl}`, request.url)
      );
    }

    const userId = (session.user as any).id;
    const userName = session.user.name || 'User';

    // Check plan limits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const limit = API_KEY_LIMITS[user?.plan ?? 'STARTER'];
    const existing = await prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });

    // If at limit, revoke the oldest VS Code key to make room
    if (existing >= limit) {
      const oldestVscodeKey = await prisma.apiKey.findFirst({
        where: { userId, revokedAt: null, name: { contains: 'VS Code' } },
        orderBy: { createdAt: 'asc' },
      });

      if (oldestVscodeKey) {
        await prisma.apiKey.update({
          where: { id: oldestVscodeKey.id },
          data: { revokedAt: new Date() },
        });
      } else {
        // No VS Code keys to revoke — generate anyway (best effort)
      }
    }

    // Generate new API key for VS Code
    const { raw, hash, prefix } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        name: `VS Code — ${new Date().toLocaleDateString()}`,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: ['read', 'write'],
        userId,
      },
    });

    // Build VS Code callback URI
    // Format: vscode://<publisher>.<extension-name>/<path>
    const callbackUri = `vscode://ai-team-studio.ai-team-studio/auth/callback?key=${encodeURIComponent(raw)}&prefix=${encodeURIComponent(prefix)}&user=${encodeURIComponent(userName)}`;

    // Return HTML page that redirects to VS Code and shows success message
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Team Studio — VS Code Connected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 48px;
      max-width: 480px;
      border: 1px solid #262626;
      border-radius: 16px;
      background: #141414;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #737373; font-size: 14px; margin-bottom: 24px; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #34d399;
      font-size: 13px;
      font-weight: 500;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .hint {
      margin-top: 24px;
      color: #525252;
      font-size: 12px;
    }
    a { color: #f59e0b; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>Connected to VS Code</h1>
    <p class="subtitle">Your API key has been sent to VS Code. You can close this tab.</p>
    <div class="status">
      <span class="dot"></span>
      Authenticated as ${userName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </div>
    <p class="hint">
      Didn't open in VS Code? <a href="${callbackUri}">Click here to try again</a>.
      <br>Or copy this key manually: <code>${prefix}...</code>
    </p>
  </div>
  <script>
    // Redirect to VS Code URI scheme
    window.location.href = ${JSON.stringify(callbackUri)};
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('GET /api/vscode/auth error:', err);
    return NextResponse.json(
      { error: 'Failed to generate VS Code API key' },
      { status: 500 }
    );
  }
}
