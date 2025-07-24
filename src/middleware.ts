import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface AppSettings {
  enableRegistration: boolean;
  maintenanceMode: boolean;
  requireEmailVerification: boolean;
}

const defaultSettings: AppSettings = {
  enableRegistration: true,
  maintenanceMode: false,
  requireEmailVerification: true,
};

// Note: Firebase Admin SDK cannot be used in Edge Runtime middleware
// Settings checks are now handled client-side or in API routes
async function getSettings(): Promise<AppSettings> {
  // Return default settings since we can't access Firestore in Edge Runtime
  // TODO: Consider moving settings checks to API routes or client-side
  return defaultSettings;
}

export async function middleware(request: NextRequest) {
  const requestPath = request.nextUrl.pathname;
  

  // Skip middleware for API routes, static files, and internal Next.js routes
  if (
    requestPath.startsWith('/api/') ||
    requestPath.startsWith('/_next/') ||
    requestPath.startsWith('/favicon.ico') ||
    requestPath.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    const settings = await getSettings();

    // Maintenance mode check
    if (settings.maintenanceMode) {
      // Allow access to maintenance page and admin routes
      if (!requestPath.startsWith('/maintenance') && !requestPath.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/maintenance', request.url));
      }
    }

    // Registration disabled check
    if (!settings.enableRegistration && requestPath === '/signup') {
      return NextResponse.redirect(new URL('/login?message=registration-disabled', request.url));
    }
  } catch (error) {
    console.error('Settings middleware error:', error);
  }

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
    
    return NextResponse.next();
  }

  // Check if this is an API route
  if (requestPath.startsWith('/api/')) {
    
    return NextResponse.next();
  }
  
  // Check if this is a direct page access (not client-side navigation)
  // We only check for session cookies on direct page access
  const referer = request.headers.get('referer');
  const isDirectAccess = !referer || !referer.includes(request.headers.get('host') || '');
  
  // If it's not a direct access, let the client-side auth handle it
  if (!isDirectAccess) {
    
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('session');
  
  // If no session cookie exists, redirect to login
  if (!session) {
    
    return NextResponse.redirect(new URL('/login', request.url));
  }

  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};