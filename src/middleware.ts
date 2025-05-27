import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  console.log(`[Middleware] Checking request for: ${requestPath}`);

  const session = request.cookies.get('session');
  console.log(`[Middleware] Session cookie for ${requestPath}:`, session ? `Exists (value: ${session.value.substring(0, 10)}...)` : 'Not found');

  // Check auth
  if (!session) {
    console.log(`[Middleware] No session cookie found for ${requestPath}. Redirecting to /login.`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log(`[Middleware] Session cookie found for ${requestPath}. Proceeding without redirect (validation still commented out).`);
  // Temporarily bypass validation for debugging
  /*
  // Validate session
  try {
    console.log(`[Middleware] Validating session for ${requestPath}...`);
    const response = await fetch(`${request.nextUrl.origin}/api/auth/validate`, {
      headers: {
        Cookie: `session=${session.value}`,
      },
    });
    console.log(`[Middleware] Validation response status for ${requestPath}: ${response.status}`);

    if (!response.ok) {
      console.log(`[Middleware] Session validation failed for ${requestPath} (status: ${response.status}). Redirecting to /login.`);
      request.cookies.delete('session'); // Attempt to clear invalid session
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
      redirectResponse.cookies.delete('session'); // Ensure cookie is cleared on redirect response
      return redirectResponse;
    }
    console.log(`[Middleware] Session validated successfully for ${requestPath}.`);
  } catch (error) {
    console.error(`[Middleware] Error validating session for ${requestPath}:`, error);
    console.log(`[Middleware] Redirecting to /login due to validation error for ${requestPath}.`);
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
    redirectResponse.cookies.delete('session'); // Ensure cookie is cleared
    return redirectResponse;
  }
  */

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