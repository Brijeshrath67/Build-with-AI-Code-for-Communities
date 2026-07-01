import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * PHC Exchange - Next.js Edge Middleware
 *
 * Handles auth-based redirects at the edge:
 * - Unauthenticated users hitting any /dashboard/* /inventory/* /transfers/*
 *   /analytics/* /ai/* /notifications/* route are redirected to /login.
 * - Authenticated users hitting /login are redirected to /dashboard.
 *
 * Auth state is checked via the presence of the `phc_token` cookie
 * (set by the login page via document.cookie after a successful API login).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPrefixes = [
    '/dashboard',
    '/inventory',
    '/transfers',
    '/analytics',
    '/ai',
    '/notifications',
  ];

  const token = request.cookies.get('phc_token')?.value;

  // Redirect unauthenticated users away from protected routes
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /login
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/inventory/:path*',
    '/transfers/:path*',
    '/analytics/:path*',
    '/ai/:path*',
    '/notifications/:path*',
    '/login',
  ],
};
