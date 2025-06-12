import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { authAdmin } from '@/lib/firebaseAdmin';

const SESSION_COOKIE_NAME = 'session';

export async function POST(request: NextRequest) {
  try {
    // Get the session cookie from the request
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "No session cookie found" }, { status: 401 });
    }

    // Verify the session cookie with Firebase Admin
    if (!authAdmin) {
      console.error('[/api/auth/revoke-sessions] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let decodedClaims;
    try {
      // Use the correct type for authAdmin - cast to any to avoid type errors
      decodedClaims = await (authAdmin as any).verifySessionCookie(sessionCookie, true);
    } catch (error) {
      console.error('[/api/auth/revoke-sessions] Invalid session cookie:', error);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = decodedClaims.uid;

    // Revoke all refresh tokens for the user
    // This will invalidate all sessions for this user
    await (authAdmin as any).revokeRefreshTokens(userId);

    // Clear the current session cookie
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    console.log(`[/api/auth/revoke-sessions] All sessions revoked for user: ${userId}`);
    return NextResponse.json({ status: 'success', message: 'All sessions revoked' });
  } catch (error) {
    console.error('[/api/auth/revoke-sessions] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
