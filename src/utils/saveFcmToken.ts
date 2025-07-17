import { messaging } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const VAPID_KEY = 'A0oAhnmYo7ObXJ8wHlTA8pYrw-X78ONJ_obL7JgUhZE';

export async function saveFcmToken() {
  if (!messaging) return;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'fcmTokens', token),
        { createdAt: new Date() }
      );
      console.log('FCM token saved to Firestore:', token);
    }
  } catch (err) {
    console.error('Error getting/saving FCM token:', err);
  }
} 