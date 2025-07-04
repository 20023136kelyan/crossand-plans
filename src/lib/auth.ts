
import { auth as firebaseAuth } from './firebase';
import { cookies } from 'next/headers';
import { authAdmin } from './firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { calculateUserPremiumStatus, calculateUserActivityScore } from '@/services/userService.server';

export const auth = async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      console.log('[auth lib] No session token found in cookies. Returning null.');
      return null;
    }

    if (!authAdmin) {
      console.error('[auth lib] Firebase Admin Auth is not initialized. Returning null.');
      return null;
    }

    const authInstance = authAdmin as Auth;
    
    try {
      // Validate token format before attempting verification
      if (typeof token !== 'string' || token.trim() === '') {
        console.error('[auth lib] Invalid token format: Token is empty or not a string. Returning null.');
        return null;
      }

      // Check if token appears to be a Firebase session cookie (basic validation)
      // Session cookies are typically JWTs and longer. This is a very loose check.
      if (token.length < 100) { 
        console.warn(`[auth lib] Token length (${token.length}) seems short for a session cookie. Proceeding with verification.`);
      }

      // Verify the session cookie
      console.log('[auth lib] Attempting to verify session cookie...');
      const decodedToken = await authInstance.verifySessionCookie(token, true); // checkRevoked = true
      console.log(`[auth lib] Session cookie verified successfully for UID: ${decodedToken.uid}.`);

      // Get user data from Firebase Auth (not Firestore profile here)
      const userRecord = await authInstance.getUser(decodedToken.uid);
      console.log(`[auth lib] User record fetched for UID: ${userRecord.uid}.`);

      // Get user's premium status and activity score (these are custom logic)
      const [isPremium, activityScore] = await Promise.all([
        calculateUserPremiumStatus(userRecord.uid),
        calculateUserActivityScore(userRecord.uid)
      ]);
      console.log(`[auth lib] Premium status: ${isPremium}, Activity score: ${activityScore} for UID: ${userRecord.uid}.`);

      return {
        user: {
          id: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName,
          isPremium,
          activityScore,
        }
      };
    } catch (error: any) {
      console.error(`[auth lib] Error verifying session cookie or fetching user data: Code: ${error.code}, Message: ${error.message}`);
      // Specific error handling for common token issues
      if (error.code === 'auth/session-cookie-expired') {
        console.warn('[auth lib] Session cookie expired. User needs to re-authenticate.');
      } else if (error.code === 'auth/session-cookie-revoked') {
        console.warn('[auth lib] Session cookie revoked. User needs to re-authenticate.');
      } else if (error.code === 'auth/argument-error') {
        console.error('[auth lib] Invalid session cookie format passed to verifySessionCookie.');
      } else {
        console.error('[auth lib] An unexpected error occurred during session cookie verification.');
      }
      return null; // If session cookie is invalid for any reason, treat as unauthenticated
    }
  } catch (error: any) {
    console.error('[auth lib] Unexpected error in auth function:', error?.message || error);
    return null;
  }
};
    