
import { auth as firebaseAuth } from './firebase';
import { User } from 'firebase/auth';

const SESSION_COOKIE_NAME = 'session';

export const setSessionCookie = async (user: User): Promise<void> => {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let lastError: any = null;

  

  while (retryCount <= MAX_RETRIES) {
    try {
      if (!user) {
        console.error('[setSessionCookie] User object is null. Aborting.');
        throw new Error('User is not authenticated');
      }
      
      let idToken: string;
      try {

        idToken = await user.getIdToken(true); // Force refresh
        
      } catch (tokenError: any) {
        console.error(`[setSessionCookie] Attempt ${retryCount + 1}: Error getting ID token:`, tokenError?.code, tokenError?.message);
        lastError = new Error(`Failed to get ID token: ${tokenError?.message || 'Unknown token error'}`);
        if (tokenError.code === 'auth/network-request-failed') {
          // Network errors are worth retrying
        } else if (tokenError.code === 'auth/user-token-expired' || tokenError.code === 'auth/invalid-user-token') {
          // If token is truly expired/invalid beyond SDK's ability to refresh, retrying won't help
          throw lastError; // Break retry loop
        }
        // For other errors, continue to retry logic
        throw lastError; // Throw to trigger retry or final failure
      }

      if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
        console.error(`[setSessionCookie] Attempt ${retryCount + 1}: Invalid ID token received: empty or not a string.`);
        throw new Error('Invalid ID token: token is empty or not a string');
      }

      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from /api/auth/session" }));
        const errorMessage = errorData?.error || `API responded with ${response.status}`;
        console.error(`[setSessionCookie] Attempt ${retryCount + 1}: Failed to set session cookie via API. Status: ${response.status}, Message: ${errorMessage}`);
        lastError = new Error(`API error setting session cookie: ${errorMessage}`);
        
        if (response.status === 401 && errorMessage.includes('expired')) {
           // ID token might have expired between client refresh and server verification.
           // Retry might help if it was a very narrow timing window.
        } else if (response.status === 400 || response.status === 401) {
            // Bad request or unrecoverable auth error from server, no point retrying
            throw lastError;
        }
        throw lastError; // Throw to trigger retry or final failure
      }

      
      return; // Success
    } catch (error: any) {
      lastError = error; // Ensure lastError is always updated
      console.error(`[setSessionCookie] Error during attempt ${retryCount + 1}/${MAX_RETRIES + 1}:`, error?.message || error);
      
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;

        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      } else {
        console.error('[setSessionCookie] Maximum retry attempts reached. Failed to set session cookie.');
        break; 
      }
    }
  }
  
  // If loop finished due to max retries, throw the last captured error.
  if (lastError) throw lastError;
  // Fallback if somehow lastError is null (shouldn't happen if loop breaks from max retries)
  throw new Error('Failed to set session cookie after multiple attempts. Unknown reason.');
};

export const clearSessionCookie = async (): Promise<void> => {
  try {

    const response = await fetch('/api/auth/session', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from /api/auth/session DELETE" }));
      throw new Error(`Failed to clear session cookie: ${response.status} ${errorData?.error || ''}`);
    }
    
  } catch (error) {
    console.error('[clearSessionCookie] Error clearing session cookie:', error);
    throw error;
  }
};
    