import { auth as firebaseAuth } from './firebase';
import { cookies } from 'next/headers';
import { authAdmin } from './firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { calculateUserPremiumStatus, calculateUserActivityScore } from '@/services/userService.admin';

export const auth = async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      console.log('[auth] No session token found in cookies');
      return null;
    }

    if (!authAdmin) {
      console.error('[auth] Firebase Admin Auth is not initialized');
      return null;
    }

    const auth = authAdmin as Auth;
    
    try {
      // Validate token format before attempting verification
      if (typeof token !== 'string' || token.trim() === '') {
        console.error('[auth] Invalid token format: Token is empty or not a string');
        return null;
      }

      // Check if token appears to be a Firebase session cookie (basic validation)
      if (token.length < 10) { // Firebase tokens are much longer
        console.error('[auth] Invalid token format: Token is too short');
        return null;
      }

      // Verify the session cookie
      let decodedToken;
      try {
        decodedToken = await auth.verifySessionCookie(token, true); // Use verifySessionCookie instead of verifyIdToken
      } catch (sessionError: any) {
        // If session cookie verification fails, try as ID token as fallback
        console.warn('[auth] Session cookie verification failed, trying as ID token:', sessionError.code);
        decodedToken = await auth.verifyIdToken(token);
      }

      // Get user data
      const user = await auth.getUser(decodedToken.uid);

      // Get user's premium status and activity score
      const [isPremium, activityScore] = await Promise.all([
        calculateUserPremiumStatus(user.uid),
        calculateUserActivityScore(user.uid)
      ]);

      return {
        user: {
          id: user.uid,
          email: user.email,
          name: user.displayName,
          isPremium,
          activityScore,
        }
      };
    } catch (tokenError: any) {
      // Provide detailed error logging
      if (tokenError.code === 'auth/id-token-expired' || tokenError.code === 'auth/session-cookie-expired') {
        console.warn('[auth] Token/cookie expired. User needs to re-authenticate.');
      } else if (tokenError.code === 'auth/argument-error') {
        console.error('[auth] Invalid token format:', tokenError.message);
      } else if (tokenError.code === 'auth/invalid-id-token') {
        console.error('[auth] Invalid ID token:', tokenError.message);
      } else {
        console.error('[auth] Token verification error:', tokenError.code, tokenError.message);
      }
      return null;
    }
  } catch (error: any) {
    console.error('[auth] Unexpected error in auth function:', error?.message || error);
    return null;
  }
}; 