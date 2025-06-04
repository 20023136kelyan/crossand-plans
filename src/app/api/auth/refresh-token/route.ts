import { cookies } from 'next/headers';
import { authAdmin } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie || !authAdmin) {
      return NextResponse.json(
        { error: 'No session token found' },
        { status: 401 }
      );
    }

    const auth = authAdmin as any;
    const decodedToken = await auth.verifyIdToken(sessionCookie.value);
    
    // Generate new token
    const newToken = await auth.createCustomToken(decodedToken.uid);
    
    // Set new session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
