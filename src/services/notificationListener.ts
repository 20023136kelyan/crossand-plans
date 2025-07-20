import { onSnapshot, collection, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createListenerWithRetry, getCollectionFallback } from '@/lib/firebaseListenerUtils';

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

  const listener = createListenerWithRetry(
    () => onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      onUpdate(notifications);
      }
    ),
    onUpdate,
    onError,
    () => getCollectionFallback(`users/${userId}/notifications`, [orderBy('createdAt', 'desc')])
  );

  return { unsubscribe: listener.unsubscribe };
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

  const listener = createListenerWithRetry(
    () => onSnapshot(
    unreadQuery,
    (snapshot) => {
      onUpdate(snapshot.docs.length);
      }
    ),
    onUpdate,
    onError,
    async () => {
      const docs = await getCollectionFallback(`users/${userId}/notifications`, [where('isRead', '==', false)]);
      return docs.length;
    }
  );

  return { unsubscribe: listener.unsubscribe };
} 