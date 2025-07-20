import { messaging } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Get VAPID key from environment variable or use a placeholder
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

export async function saveFcmToken() {
  if (!messaging) {
    console.warn('FCM messaging not initialized');
    return;
  }
  
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('No authenticated user for FCM token registration');
    return;
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // Check if VAPID key is available
    if (!VAPID_KEY) {
      console.warn('VAPID key not configured. FCM push notifications will not work.');
      return;
    }

    const { getToken } = await import('firebase/messaging');
    
    // Register the service worker and pass it to getToken
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY, 
      serviceWorkerRegistration: registration 
    });
    
    if (token) {
      // Save token to Firestore
      if (!db) {
        console.error('Firestore not initialized');
        return token;
      }
      
      await setDoc(
        doc(db, 'users', currentUser.uid, 'fcmTokens', token),
        { 
          createdAt: new Date(),
          updatedAt: new Date(),
          platform: 'web'
        }
      );
      console.log('FCM token saved to Firestore successfully');
      return token;
    } else {
      console.warn('Failed to get FCM token');
    }
  } catch (err: any) {
    console.error('Error getting/saving FCM token:', err);
    
    // Provide specific error messages for common issues
    if (err.code === 'messaging/invalid-vapid-key') {
      console.error('Invalid VAPID key. Please check your Firebase configuration.');
    } else if (err.code === 'messaging/failed-service-worker-registration') {
      console.error('Service worker registration failed. This may be due to HTTPS requirements or browser restrictions.');
    } else if (err.code === 'messaging/permission-blocked') {
      console.error('Notification permission is blocked. Please enable notifications in your browser settings.');
    }
  }
} 