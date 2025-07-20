import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';

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
      console.error('[/api/auth/enable-2fa] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let decodedClaims;
    try {
      // Use the correct type for authAdmin - cast to any to avoid type errors
      decodedClaims = await (authAdmin as any).verifySessionCookie(sessionCookie, true);
    } catch (error) {
      console.error('[/api/auth/enable-2fa] Invalid session cookie:', error);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = decodedClaims.uid;

    // Note: Firebase Authentication doesn't have built-in 2FA support in the client SDK
    // For a real implementation, you would need to:
    // 1. Generate a secret key for the user
    // 2. Generate a QR code for the user to scan with an authenticator app
    // 3. Store the secret key in Firestore
    // 4. Implement verification of codes during login

    // For this demo, we'll just update a flag in Firestore to indicate 2FA is enabled
    if (firestoreAdmin) {
      // Cast to any to avoid type errors - in a production app, you would use proper types
      const db = firestoreAdmin as any;
      
          const userSecurityRef = db.collection('userSecurity').doc(userId);
    
    await userSecurityRef.set({
        twoFactorEnabled: true,
        updatedAt: new Date()
      }, { merge: true });
    }

    console.log(`[/api/auth/enable-2fa] 2FA enabled for user: ${userId}`);
    return NextResponse.json({ 
      status: 'success', 
      message: '2FA has been enabled for your account',
      // In a real implementation, you would return the QR code data here
      // qrCodeUrl: 'data:image/png;base64,...'
    });
  } catch (error) {
    console.error('[/api/auth/enable-2fa] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
