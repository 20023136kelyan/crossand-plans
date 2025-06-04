import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { authAdmin } from '@/lib/firebaseAdmin';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = 'session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body.idToken;

    // Validate token input
    if (!idToken) {
      console.error('[/api/auth/session POST] No ID token provided');
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }
    
    if (typeof idToken !== 'string' || idToken.trim() === '') {
      console.error('[/api/auth/session POST] Invalid token format: empty string or not a string');
      return NextResponse.json({ error: 'Invalid ID token format' }, { status: 400 });
    }

    // Basic format validation (Firebase tokens are quite long)
    if (idToken.length < 50) {
      console.error('[/api/auth/session POST] Token appears too short to be valid');
      return NextResponse.json({ error: 'Invalid ID token format: token too short' }, { status: 400 });
    }

    if (!authAdmin) {
      console.error('[/api/auth/session POST] Firebase Admin SDK Auth service not initialized or available.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const currentAuthAdmin: Auth = authAdmin;

    let decodedToken: DecodedIdToken;
    try {
      console.log('[/api/auth/session POST] Verifying ID token...');
      decodedToken = await currentAuthAdmin.verifyIdToken(idToken, true /* checkRevoked */);
      console.log(`[/api/auth/session POST] ID token verified successfully for UID: ${decodedToken.uid}`);
    } catch (error: any) {
      const errorCode = error.code || 'unknown';
      const errorMessage = error.message || 'No error message';
      console.error(`[/api/auth/session POST] Error verifying ID token: [${errorCode}] ${errorMessage}`, error);
      
      if (errorCode === 'auth/id-token-revoked') {
        return NextResponse.json({ error: 'ID token has been revoked. Please sign in again.' }, { status: 401 });
      } else if (errorCode === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'ID token has expired. Please sign in again.' }, { status: 401 });
      } else if (errorCode === 'auth/argument-error') {
        return NextResponse.json({ error: 'Invalid ID token format. Please sign in again.' }, { status: 400 });
      } else if (errorCode === 'auth/invalid-id-token') {
        return NextResponse.json({ error: 'Invalid ID token. Please sign in again.' }, { status: 401 });
      }
      return NextResponse.json({ error: `Authentication error: ${errorCode}` }, { status: 401 });
    }

    // Create a session cookie with Firebase Admin
    // This creates a proper session cookie that lasts longer than the ID token
    const expiresIn = COOKIE_MAX_AGE_SECONDS * 1000; // Convert to milliseconds
    const sessionCookie = await currentAuthAdmin.createSessionCookie(idToken, { expiresIn });
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    console.log(`[/api/auth/session POST] Session cookie set for UID: ${decodedToken.uid}`);
    return NextResponse.json({ status: 'success', message: 'Session cookie set' });

  } catch (error) {
    console.error('[/api/auth/session POST] General error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    if (sessionCookie && authAdmin) {
      const currentAuthAdmin: Auth = authAdmin;
      try {
        const decodedToken = await currentAuthAdmin.verifyIdToken(sessionCookie.value, true);
        await currentAuthAdmin.revokeRefreshTokens(decodedToken.uid);
        console.log(`[/api/auth/session DELETE] Revoked refresh tokens for UID: ${decodedToken.uid}`);
      } catch (error: any) {
        console.warn(`[/api/auth/session DELETE] Error revoking refresh tokens (UID might be unavailable or token invalid, this is often OK during signout):`, error.message);
      }
    }
    
    cookieStore.delete(SESSION_COOKIE_NAME);
    console.log('[/api/auth/session DELETE] Session cookie deleted.');
    return NextResponse.json({ status: 'success', message: 'Session cookie cleared' });

  } catch (error) {
    console.error('[/api/auth/session DELETE] General error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 