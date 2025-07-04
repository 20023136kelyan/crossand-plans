import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { createPublicHandler, parseRequestBody } from '@/lib/api/middleware';

const SESSION_COOKIE_NAME = 'session';

// POST /api/auth/session - Create HTTP session cookie from idToken
export const POST = createPublicHandler(
  async ({ request }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    if (!authAdmin) {
      console.error('[/api/auth/session] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
      // Verify the ID token with Firebase Admin
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      console.log(`[/api/auth/session] ID token verified for user: ${decodedToken.uid}`);

      // Create session cookie from the ID token
      // Session cookies expire in 5 days
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in milliseconds
      const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

      // Set the session cookie in the HTTP response
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
        maxAge: expiresIn / 1000, // Convert to seconds for cookie
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });

      console.log(`[/api/auth/session] Session cookie created successfully for user: ${decodedToken.uid}`);
      
      return NextResponse.json({
        success: true,
        message: 'Session cookie created successfully'
      });

    } catch (error: any) {
      console.error('[/api/auth/session] Error creating session cookie:', error);
      
      if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'ID token expired' }, { status: 401 });
      }
      if (error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Invalid ID token' }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Failed to create session cookie' }, { status: 500 });
    }
  },
  { defaultError: 'Failed to create session' }
);

// DELETE /api/auth/session - Clear session cookie
export const DELETE = createPublicHandler(
  async () => {
    try {
      // Clear the session cookie
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      console.log('[/api/auth/session] Session cookie cleared successfully');
      
      return NextResponse.json({
        success: true,
        message: 'Session cookie cleared successfully'
      });
    } catch (error) {
      console.error('[/api/auth/session] Error clearing session cookie:', error);
      return NextResponse.json({ error: 'Failed to clear session cookie' }, { status: 500 });
    }
  },
  { defaultError: 'Failed to clear session' }
);
    