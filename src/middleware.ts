import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/projects',
  '/project',
  '/account',
  '/billing',
  '/notifications',
  '/organizations',
  '/profile',
  '/onboarding',
  '/admin',
];

// Routes only accessible when NOT authenticated (redirect to /projects if logged in)
const AUTH_ONLY_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/public') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  const isAuthenticated = !!session?.user;

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && AUTH_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
