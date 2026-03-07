import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API Rate Limiting ──────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Skip rate limiting for inbound webhooks (Stripe, GitHub)
    if (
      !pathname.startsWith('/api/webhooks/stripe') &&
      !pathname.startsWith('/api/webhooks/github')
    ) {
      const sessionToken =
        request.cookies.get('authjs.session-token')?.value ||
        request.cookies.get('__Secure-authjs.session-token')?.value;

      const authHeader = request.headers.get('authorization') ?? '';
      const apiKey = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7, 19) // prefix only — don't expose full key
        : null;

      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown';

      const identifier = sessionToken?.slice(0, 16) ?? apiKey ?? `ip:${ip}`;
      const method = request.method;
      const isAuth = pathname.startsWith('/api/auth/');

      let category: 'read' | 'mutation' | 'auth' = 'read';
      if (isAuth) {
        category = 'auth';
      } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        category = 'mutation';
      }

      try {
        const blocked = await rateLimit(identifier, category);
        if (blocked) return blocked;
      } catch {
        // If rate-limit check fails (Redis down), allow through
      }
    }

    return NextResponse.next();
  }

  // ── Page Auth ──────────────────────────────────────────────────────────────
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const isLoggedIn = !!sessionToken;

  // Public routes — no auth needed
  const publicPaths = ['/', '/login', '/signup'];
  const isPublic = publicPaths.some(p => pathname === p);
  const isAuthPage = ['/login', '/signup'].includes(pathname);

  // Allow public routes
  if (isPublic) {
    // If logged in and on auth pages, redirect to projects
    if (isLoggedIn && isAuthPage) {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
    return NextResponse.next();
  }

  // Admin routes — require auth (role check done at layout level since
  // we can't decode JWT here without the secret easily)
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // All other routes require auth
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
