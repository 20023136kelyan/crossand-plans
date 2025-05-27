import { auth as firebaseAuth } from './firebase';
import { User } from 'firebase/auth';

const SESSION_COOKIE_NAME = 'session';

export const setSessionCookie = async (user: User): Promise<void> => {
  try {
    // Get the ID token from Firebase Auth
    const idToken = await user.getIdToken(true);

    // Call your backend API to create a session cookie
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to set session cookie');
    }

    // The session cookie will be automatically set by the server
    console.log('Session cookie set successfully');
  } catch (error) {
    console.error('Error setting session cookie:', error);
    throw error;
  }
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