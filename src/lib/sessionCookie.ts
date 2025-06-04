import { auth as firebaseAuth } from './firebase';
import { User } from 'firebase/auth';

const SESSION_COOKIE_NAME = 'session';

export const setSessionCookie = async (user: User): Promise<void> => {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let lastError: any = null;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Verify user is still authenticated
      if (!user) {
        throw new Error('User is not authenticated');
      }
      
      // Get the ID token from Firebase Auth with force refresh
      let idToken: string;
      try {
        idToken = await user.getIdToken(true);
        console.log(`[sessionCookie] Got fresh ID token${retryCount > 0 ? ` (retry ${retryCount})` : ''}, length: ${idToken?.length}`);
      } catch (tokenError: any) {
        console.error('[sessionCookie] Error getting ID token:', tokenError?.message || tokenError);
        throw new Error(`Failed to get ID token: ${tokenError?.message || 'Unknown error'}`);
      }

      // Validate token before sending to server
      if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
        throw new Error('Invalid ID token: token is empty or not a string');
      }

      // Call your backend API to create a session cookie
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
        // Ensure we don't use cached responses
        cache: 'no-store',
      });

      // Handle API response
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error || 'Unknown error';
        
        // Handle specific error cases
        if (errorMessage.includes('expired')) {
          console.warn('[sessionCookie] Token expired, will force refresh on next attempt');
        } else if (errorMessage.includes('Invalid ID token format')) {
          console.error('[sessionCookie] Invalid token format detected by server');
        }
        
        throw new Error(`Failed to set session cookie: ${response.status} ${errorMessage}`);
      }

      // The session cookie will be automatically set by the server
      console.log('[sessionCookie] Session cookie set successfully');
      return;
    } catch (error: any) {
      lastError = error;
      console.error(`[sessionCookie] Error setting session cookie (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error?.message || error);
      
      if (retryCount < MAX_RETRIES) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[sessionCookie] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      } else {
        console.error('[sessionCookie] Maximum retry attempts reached');
        break;
      }
    }
  }
  
  // If we got here, all retries failed
  throw lastError || new Error('Failed to set session cookie after multiple attempts');
};

export const clearSessionCookie = async (): Promise<void> => {
  try {
    // Call your backend API to clear the session cookie
    const response = await fetch('/api/auth/session', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear session cookie');
    }

    // The session cookie will be automatically cleared by the server
    console.log('Session cookie cleared successfully');
  } catch (error) {
    console.error('Error clearing session cookie:', error);
    throw error;
  }
};