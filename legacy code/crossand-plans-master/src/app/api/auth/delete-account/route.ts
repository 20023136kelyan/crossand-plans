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
      console.error('[/api/auth/delete-account] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let decodedClaims;
    try {
      // Use the correct type for authAdmin - cast to any to avoid type errors
      decodedClaims = await (authAdmin as any).verifySessionCookie(sessionCookie, true);
    } catch (error) {
      console.error('[/api/auth/delete-account] Invalid session cookie:', error);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = decodedClaims.uid;

    // Delete user data from Firestore
    if (firestoreAdmin) {
      // Cast to any to avoid type errors - in a production app, you would use proper types
      const db = firestoreAdmin as any;
      
      // Use a batch to delete multiple documents
      const batch = db.batch();

      // Delete user profile
      const userProfileRef = db.collection('userProfiles').doc(userId);
      batch.delete(userProfileRef);

      // Delete user notification preferences
      const userNotificationsRef = db.collection('userNotificationPreferences').doc(userId);
      batch.delete(userNotificationsRef);

      // Delete user subscriptions
      const subscriptionsQuery = await db.collection('subscriptions')
        .where('userId', '==', userId)
        .get();
      
      subscriptionsQuery.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      // Commit the batch
      await batch.commit();
    }

    // Delete the user's authentication account
    await (authAdmin as any).deleteUser(userId);

    // Clear the current session cookie
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    console.log(`[/api/auth/delete-account] Account deleted for user: ${userId}`);
    return NextResponse.json({ status: 'success', message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[/api/auth/delete-account] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
