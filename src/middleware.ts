import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  console.log(`[Middleware] Checking request for: ${requestPath}`);

  // Public routes that don't require session
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/p/[planId]',
    '/u/[profileId]',
    '/explore',
    '/onboarding',
    '/users/settings' // Add settings page to public routes to avoid middleware redirects
  ];

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(route => {
    // Handle dynamic routes with regex
    if (route.includes('[')) {
      const regex = new RegExp(`^${route.replace('[', '\[').replace(']', '\]')}`);
      return regex.test(requestPath);
    }
    return requestPath === route;
  });

  // If it's a public route, just let it through
  if (isPublicRoute) {
    console.log(`[Middleware] Public route detected (${requestPath}). Skipping session check.`);
    return NextResponse.next();
  }

  // Check if this is an API route
  if (requestPath.startsWith('/api/')) {
    console.log(`[Middleware] API route detected (${requestPath}). Skipping session check.`);
    return NextResponse.next();
  }
  
  // Check if this is a direct page access (not client-side navigation)
  // We only check for session cookies on direct page access
  const referer = request.headers.get('referer');
  const isDirectAccess = !referer || !referer.includes(request.headers.get('host') || '');
  
  // If it's not a direct access, let the client-side auth handle it
  if (!isDirectAccess) {
    console.log(`[Middleware] Client-side navigation detected from ${referer}. Skipping session check.`);
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('session');
  
  // If no session cookie exists, redirect to login
  if (!session) {
    console.log(`[Middleware] No session cookie found for ${requestPath}. Redirecting to /login.`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log(`[Middleware] Session cookie found for ${requestPath}. Proceeding with request.`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/plans/:path*',
    '/explore/:path*',
    '/messages/:path*',
    '/subscription/:path*',
    '/wallet/:path*',
    '/users/:path*', // Includes /users/settings and /users/:profileId, /profile (old)
    // Added /profile here just in case it was missed and to ensure settings redirect logic in AuthContext is the primary handler for it.
    '/profile',
  ],
};