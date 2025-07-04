import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';

// Types for middleware
export interface AuthResult {
  userId: string;
  decodedToken: any;
  isAdmin?: boolean;
}

export interface APIContext {
  request: NextRequest;
  authResult?: AuthResult;
}

export interface AuthenticatedAPIContext {
  request: NextRequest;
  authResult: AuthResult;
}

export type APIHandler = (context: APIContext) => Promise<NextResponse>;
export type AuthenticatedAPIHandler = (context: AuthenticatedAPIContext) => Promise<NextResponse>;

// === Core Authentication Middleware ===

/**
 * Verifies user authentication via Bearer token
 */
export function withAuth(
  handler: AuthenticatedAPIHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      // Validate Firebase services
      if (!authAdmin) {
        console.error('[withAuth] Firebase Auth Admin not initialized');
        return NextResponse.json(
          { error: 'Authentication service unavailable' }, 
          { status: 503 }
        );
      }

      // Extract and validate authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authorization header required' }, 
          { status: 401 }
        );
      }

      // Verify token
      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        return NextResponse.json(
          { error: 'Invalid authorization format' }, 
          { status: 401 }
        );
      }

      const decodedToken = await authAdmin.verifyIdToken(token);
      const authResult: AuthResult = {
        userId: decodedToken.uid,
        decodedToken
      };

      // Call handler with authenticated context
      return await handler({ request, authResult });

    } catch (error: any) {
      console.error('[withAuth] Authentication error:', error);
      if (error?.code === 'auth/id-token-expired') {
        return NextResponse.json(
          { error: 'Token expired' }, 
          { status: 401 }
        );
      }
      if (error?.code === 'auth/argument-error') {
        return NextResponse.json(
          { error: 'Invalid token format' }, 
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Authentication failed' }, 
        { status: 401 }
      );
    }
  };
}

/**
 * Verifies admin authentication and authorization
 */
export function withAdminAuth(
  handler: AuthenticatedAPIHandler
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      // Validate Firebase services
      if (!authAdmin || !firestoreAdmin) {
        console.error('[withAdminAuth] Firebase services not initialized');
        return NextResponse.json(
          { error: 'Admin services unavailable' }, 
          { status: 503 }
        );
      }

      // Extract and validate authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authorization header required' }, 
          { status: 401 }
        );
      }

      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        return NextResponse.json(
          { error: 'Invalid authorization format' }, 
          { status: 401 }
        );
      }

      // Verify token
      const decodedToken = await authAdmin.verifyIdToken(token);
      
      // Check admin authorization via custom claims
      if (decodedToken.admin) {
        const authResult: AuthResult = {
          userId: decodedToken.uid,
          decodedToken,
          isAdmin: true
        };
        return await handler({ request, authResult });
      }

      // Fallback: Check admin status via user document
      const userDoc = await firestoreAdmin.collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists) {
        return NextResponse.json(
          { error: 'User not found' }, 
          { status: 404 }
        );
      }

      const userData = userDoc.data();
      if (!userData?.isAdmin && userData?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' }, 
          { status: 403 }
        );
      }

      const authResult: AuthResult = {
        userId: decodedToken.uid,
        decodedToken,
        isAdmin: true
      };

      return await handler({ request, authResult });

    } catch (error: any) {
      console.error('[withAdminAuth] Admin authentication error:', error);
      if (error?.code === 'auth/id-token-expired') {
        return NextResponse.json(
          { error: 'Token expired' }, 
          { status: 401 }
        );
      }
      if (error?.code === 'auth/argument-error') {
        return NextResponse.json(
          { error: 'Invalid token format' }, 
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Admin authentication failed' }, 
        { status: 401 }
      );
    }
  };
}

// === Error Handling Middleware ===

/**
 * Wraps handlers with standardized error handling
 */
export function withErrorHandling(
  handler: APIHandler,
  options?: {
    defaultError?: string;
    logErrors?: boolean;
  }
): APIHandler {
  const { defaultError = 'Internal server error', logErrors = true } = options || {};

  return async (context: APIContext) => {
    try {
      return await handler(context);
    } catch (error: any) {
      if (logErrors) {
        console.error('[API Error]:', error);
      }

      // Handle specific error types
      if (error?.code === 'permission-denied') {
        return NextResponse.json(
          { error: 'Permission denied' }, 
          { status: 403 }
        );
      }

      if (error?.code === 'not-found') {
        return NextResponse.json(
          { error: 'Resource not found' }, 
          { status: 404 }
        );
      }

      if (error?.code === 'already-exists') {
        return NextResponse.json(
          { error: 'Resource already exists' }, 
          { status: 409 }
        );
      }

      if (error?.code === 'invalid-argument') {
        return NextResponse.json(
          { error: 'Invalid request data' }, 
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: defaultError }, 
        { status: 500 }
      );
    }
  };
}

// === Firebase Validation Middleware ===

/**
 * Validates Firebase services are available
 */
export function withFirebaseValidation(
  handler: APIHandler,
  options?: {
    requireAuth?: boolean;
    requireFirestore?: boolean;
  }
): APIHandler {
  const { requireAuth = false, requireFirestore = false } = options || {};

  return async (context: APIContext) => {
    if (requireAuth && !authAdmin) {
      console.error('[withFirebaseValidation] Firebase Auth Admin not initialized');
      return NextResponse.json(
        { error: 'Authentication service unavailable' }, 
        { status: 503 }
      );
    }

    if (requireFirestore && !firestoreAdmin) {
      console.error('[withFirebaseValidation] Firebase Firestore Admin not initialized');
      return NextResponse.json(
        { error: 'Database service unavailable' }, 
        { status: 503 }
      );
    }

    return await handler(context);
  };
}

// === Composed Middleware Helpers ===

/**
 * Combines authentication with error handling and Firebase validation
 */
export function createAuthenticatedHandler(
  handler: AuthenticatedAPIHandler,
  options?: {
    defaultError?: string;
    logErrors?: boolean;
  }
): (request: NextRequest) => Promise<NextResponse> {
  // Create a wrapper that adapts the authenticated handler to the general APIHandler type
  const adaptedHandler: APIHandler = async (context: APIContext) => {
    if (!context.authResult) {
      throw new Error('Authentication context missing');
    }
    return await handler({ request: context.request, authResult: context.authResult });
  };

  const withValidation = withFirebaseValidation(
    withErrorHandling(adaptedHandler, options),
    { requireAuth: true, requireFirestore: true }
  );

  return withAuth(async ({ request, authResult }) => {
    return await withValidation({ request, authResult });
  });
}

/**
 * Combines admin authentication with error handling and Firebase validation
 */
export function createAdminHandler(
  handler: AuthenticatedAPIHandler,
  options?: {
    defaultError?: string;
    logErrors?: boolean;
  }
): (request: NextRequest) => Promise<NextResponse> {
  // Create a wrapper that adapts the authenticated handler to the general APIHandler type
  const adaptedHandler: APIHandler = async (context: APIContext) => {
    if (!context.authResult) {
      throw new Error('Authentication context missing');
    }
    return await handler({ request: context.request, authResult: context.authResult });
  };

  const withValidation = withFirebaseValidation(
    withErrorHandling(adaptedHandler, options),
    { requireAuth: true, requireFirestore: true }
  );

  return withAdminAuth(async ({ request, authResult }) => {
    return await withValidation({ request, authResult });
  });
}

/**
 * Simple handler with just error handling and Firebase validation (no auth)
 */
export function createPublicHandler(
  handler: APIHandler,
  options?: {
    defaultError?: string;
    logErrors?: boolean;
    requireFirestore?: boolean;
  }
): (request: NextRequest) => Promise<NextResponse> {
  const { requireFirestore = false, ...errorOptions } = options || {};
  
  const withValidation = withFirebaseValidation(
    withErrorHandling(handler, errorOptions),
    { requireAuth: false, requireFirestore }
  );

  return async (request: NextRequest) => {
    return await withValidation({ request });
  };
}

// === Request Body Parsing Helpers ===

/**
 * Safely parses JSON request body with validation
 */
export async function parseRequestBody<T = any>(
  request: NextRequest,
  validator?: (data: any) => data is T
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await request.json();
    
    if (validator && !validator(body)) {
      return {
        error: NextResponse.json(
          { error: 'Invalid request body format' }, 
          { status: 400 }
        )
      };
    }

    return { data: body as T };
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: 'Invalid JSON in request body' }, 
        { status: 400 }
      )
    };
  }
}

/**
 * Extracts query parameters with type safety
 */
export function getQueryParams<T extends Record<string, string | undefined>>(
  request: NextRequest,
  schema: Record<keyof T, { required?: boolean; defaultValue?: string }>
): { params: T; error?: never } | { params?: never; error: NextResponse } {
  const url = new URL(request.url);
  const params: Partial<T> = {};
  const missing: string[] = [];

  for (const [key, config] of Object.entries(schema)) {
    const value = url.searchParams.get(key);
    
    if (!value && config.required) {
      missing.push(key);
      continue;
    }

    params[key as keyof T] = (value || config.defaultValue) as T[keyof T];
  }

  if (missing.length > 0) {
    return {
      error: NextResponse.json(
        { error: `Missing required parameters: ${missing.join(', ')}` }, 
        { status: 400 }
      )
    };
  }

  return { params: params as T };
} 