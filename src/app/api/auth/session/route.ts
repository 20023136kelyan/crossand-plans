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

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    if (!authAdmin) {
      console.error('[/api/auth/session POST] Firebase Admin SDK Auth service not initialized or available.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const currentAuthAdmin: Auth = authAdmin;

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await currentAuthAdmin.verifyIdToken(idToken, true /* checkRevoked */);
    } catch (error: any) {
      console.error('[/api/auth/session POST] Error verifying ID token:', error);
      if (error.code === 'auth/id-token-revoked') {
        return NextResponse.json({ error: 'ID token has been revoked. Please sign in again.' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, idToken, {
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