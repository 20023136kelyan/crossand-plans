
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { authAdmin } from '@/lib/firebaseAdmin';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = 'session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days in seconds

export async function POST(request: NextRequest) {
  const requestLogId = `[${new Date().toISOString()}] [/api/auth/session POST]`;
  console.log(`${requestLogId} Received request to create session.`);

  try {
    const body = await request.json();
    const idToken = body.idToken;

    if (!idToken) {
      console.error(`${requestLogId} No ID token provided.`);
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }
    
    if (typeof idToken !== 'string' || idToken.trim() === '') {
      console.error(`${requestLogId} Invalid token format: empty string or not a string.`);
      return NextResponse.json({ error: 'Invalid ID token format' }, { status: 400 });
    }

    if (idToken.length < 50) {
      console.error(`${requestLogId} Token appears too short to be valid.`);
      return NextResponse.json({ error: 'Invalid ID token format: token too short' }, { status: 400 });
    }

    if (!authAdmin) {
      console.error(`${requestLogId} Firebase Admin SDK Auth service not initialized or available.`);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const currentAuthAdmin: Auth = authAdmin;

    let decodedToken: DecodedIdToken;
    try {
      console.log(`${requestLogId} Verifying ID token (checkRevoked=true)...`);
      decodedToken = await currentAuthAdmin.verifyIdToken(idToken, true /* checkRevoked */);
      console.log(`${requestLogId} ID token verified successfully for UID: ${decodedToken.uid}`);
    } catch (error: any) {
      const errorCode = error.code || 'unknown_auth_error';
      const errorMessage = error.message || 'No error message from Firebase Admin';
      console.error(`${requestLogId} Error verifying ID token: [${errorCode}] ${errorMessage}`, error);
      
      let clientErrorMessage = `Authentication error: ${errorCode}`;
      let clientStatus = 401;

      if (errorCode === 'auth/id-token-revoked') {
        clientErrorMessage = 'ID token has been revoked. Please sign in again.';
      } else if (errorCode === 'auth/id-token-expired') {
        clientErrorMessage = 'ID token has expired. Please sign in again.';
      } else if (errorCode === 'auth/argument-error') {
        clientErrorMessage = 'Invalid ID token format provided to server. Please sign in again.';
        clientStatus = 400;
      } else if (errorCode === 'auth/invalid-id-token') {
        clientErrorMessage = 'Invalid ID token structure or signature. Please sign in again.';
      }
      return NextResponse.json({ error: clientErrorMessage, errorCode }, { status: clientStatus });
    }

    const expiresIn = COOKIE_MAX_AGE_SECONDS * 1000; // Convert to milliseconds
    console.log(`${requestLogId} Creating session cookie for UID: ${decodedToken.uid}, expiresIn: ${expiresIn}ms.`);
    const sessionCookie = await currentAuthAdmin.createSessionCookie(idToken, { expiresIn });
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    console.log(`${requestLogId} Session cookie set successfully for UID: ${decodedToken.uid}`);
    return NextResponse.json({ status: 'success', message: 'Session cookie set' });

  } catch (error: any) {
    const generalErrorCode = error.code || 'internal_server_error';
    console.error(`${requestLogId} General error: [${generalErrorCode}]`, error.message || error);
    return NextResponse.json({ error: 'Internal server error', errorCode: generalErrorCode }, { status: 500 });
  }
}

export async function HEAD() {
  // Health check endpoint for authentication service
  try {
    if (!authAdmin) {
      return new NextResponse(null, { status: 503 }); // Service Unavailable
    }
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const requestLogId = `[${new Date().toISOString()}] [/api/auth/session DELETE]`;
  console.log(`${requestLogId} Received request to clear session.`);
  try {
    const cookieStore = await cookies();
    const sessionCookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (sessionCookieValue && authAdmin) {
      const currentAuthAdmin: Auth = authAdmin;
      try {
        console.log(`${requestLogId} Verifying session cookie before revoking refresh tokens.`);
        const decodedToken = await currentAuthAdmin.verifySessionCookie(sessionCookieValue, true); // Check if active session cookie
        console.log(`${requestLogId} Session cookie valid for UID: ${decodedToken.uid}. Revoking refresh tokens.`);
        await currentAuthAdmin.revokeRefreshTokens(decodedToken.uid);
        console.log(`${requestLogId} Revoked refresh tokens for UID: ${decodedToken.uid}`);
      } catch (error: any) {
        console.warn(`${requestLogId} Error verifying session cookie or revoking refresh tokens (UID might be unavailable or token invalid, this is often OK during signout): Code: ${error.code}, Message:`, error.message);
        // Proceed to delete cookie even if token verification/revocation fails, as client wants to sign out.
      }
    } else {
      console.log(`${requestLogId} No session cookie found or authAdmin not available. Clearing cookie if present.`);
    }
    
    cookieStore.delete(SESSION_COOKIE_NAME);
    console.log(`${requestLogId} Session cookie cleared from browser.`);
    return NextResponse.json({ status: 'success', message: 'Session cookie cleared' });

  } catch (error: any) {
    const generalErrorCode = error.code || 'internal_server_error';
    console.error(`${requestLogId} General error: [${generalErrorCode}]`, error.message || error);
    return NextResponse.json({ error: 'Internal server error', errorCode: generalErrorCode }, { status: 500 });
  }
}
    