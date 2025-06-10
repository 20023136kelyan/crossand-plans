import { NextRequest } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';

/**
 * Verifies user authentication from request headers or cookies
 * @param request - The NextRequest object
 * @returns Promise<string> - The authenticated user's ID
 * @throws Error if authentication fails
 */
export async function verifyAuth(request: NextRequest): Promise<string> {
  try {
    if (!authAdmin) {
      throw new Error('Firebase Admin Auth is not initialized');
    }

    const authInstance = authAdmin as Auth;
    let token: string | null = null;

    // Try to get token from Authorization header first
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    }

    // If no Authorization header, try to get session cookie
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        token = cookies.session;
      }
    }

    if (!token) {
      throw new Error('No authentication token provided');
    }

    // Verify the token
    let decodedToken;
    try {
      // Try as session cookie first
      decodedToken = await authInstance.verifySessionCookie(token, true);
    } catch (sessionError) {
      try {
        // If session cookie fails, try as ID token
        decodedToken = await authInstance.verifyIdToken(token);
      } catch (idTokenError) {
        throw new Error('Invalid authentication token');
      }
    }

    return decodedToken.uid;
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    throw new Error('Authentication failed');
  }
}

/**
 * Verifies user authentication and returns user object with additional data
 * @param request - The NextRequest object
 * @returns Promise<{userId: string}> - Object containing the authenticated user's ID
 * @throws Error if authentication fails
 */
export async function verifyAuthWithUserData(request: NextRequest): Promise<{ userId: string }> {
  const userId = await verifyAuth(request);
  return { userId };
}