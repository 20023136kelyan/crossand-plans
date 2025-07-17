import { onSnapshot, collection, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface NotificationListener {
  unsubscribe: () => void;
}

export function listenToNotifications(
  userId: string,
  onUpdate: (notifications: any[]) => void,
  onError: (error: any) => void
): NotificationListener {
  if (!db) {
    onError(new Error('Firebase not initialized'));
    return { unsubscribe: () => {} };
  }

  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const notificationsQuery = query(
    notificationsRef,
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      onUpdate(notifications);
    },
    onError
  );

  return { unsubscribe };
}

export function listenToUnreadNotifications(
  userId: string,
  onUpdate: (count: number) => void,
  onError: (error: any) => void
): NotificationListener {
  if (!db) {
    onError(new Error('Firebase not initialized'));
    return { unsubscribe: () => {} };
  }

  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const unreadQuery = query(
    notificationsRef,
    where('isRead', '==', false)
  );

  const unsubscribe = onSnapshot(
    unreadQuery,
    (snapshot) => {
      onUpdate(snapshot.docs.length);
    },
    onError
  );

  return { unsubscribe };
} 