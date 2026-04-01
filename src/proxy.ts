import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Page Auth ──────────────────────────────────────────────────────────────
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const isLoggedIn = !!sessionToken;

  // Public routes — no auth needed
  const publicPaths = ['/', '/login', '/signup'];
  const isPublic = publicPaths.some(p => pathname === p);
  const isAuthPage = ['/login', '/signup'].includes(pathname);

  // Allow public routes (let auth pages always render — client handles redirect after login)
  if (isPublic) {
    return NextResponse.next();
  }

  // Admin routes — require auth (role check done at layout level)
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
