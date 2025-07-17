import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendFCMToUser, getFcmTokensForUser } from './fcmService.server';

export interface NotificationData {
  id?: string;
  type:
    | 'friend_request'
    | 'follow_request'
    | 'plan_share'
    | 'plan_invitation'
    | 'plan_completion'
    | 'post_interaction'
    | 'plan_join'
    | 'system'
    | 'chat_message';
  title: string;
  description?: string; // Made optional since not all notifications need it
  actionUrl?: string;
  avatarUrl?: string;
  planImageUrl?: string;
  postImageUrl?: string;
  userName?: string; // User who performed the action
  chatId?: string; // for chat_message
  senderId?: string; // for chat_message
  senderName?: string; // for chat_message
  senderAvatarUrl?: string; // for chat_message
  messagePreview?: string; // for chat_message
  metadata?: Record<string, any>;
  createdAt?: any;
  isRead?: boolean;
  readAt?: any;
  // Actionable notification fields
  status?: 'pending' | 'approved' | 'denied' | 'accepted' | 'declined';
  handled?: boolean;
}

export async function createNotification(
  userId: string,
  notificationData: NotificationData
): Promise<string> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const notificationRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc();

  // Set default fields based on type
  let notification: any = {
    ...notificationData,
    id: notificationRef.id,
    createdAt: FieldValue.serverTimestamp(),
  };
  // Remove undefined fields (especially avatarUrl)
  Object.keys(notification).forEach(key => {
    if (notification[key] === undefined) {
      delete notification[key];
    }
  });
  if (
    notificationData.type === 'friend_request' ||
    notificationData.type === 'follow_request' ||
    notificationData.type === 'plan_invitation' ||
    (notificationData.type === 'plan_share' && notificationData.status)
  ) {
    notification.status = notificationData.status || 'pending';
    notification.handled = false;
    notification.isRead = false;
  } else {
    notification.isRead = false;
  }

  await notificationRef.set(notification);

  // Send push notification via FCM
  await sendFCMToUser(userId, {
    notification: {
      title: notificationData.title,
      body: notificationData.description || notificationData.title,
      image: notificationData.avatarUrl || notificationData.planImageUrl,
    },
    data: {
      actionUrl: notificationData.actionUrl || '',
      type: notificationData.type,
      notificationId: notificationRef.id,
    }
  }, getFcmTokensForUser);

  return notificationRef.id;
}

export async function createNotificationForMultipleUsers(
  userIds: string[],
  notificationData: NotificationData
): Promise<string[]> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const batch = firestoreAdmin!.batch();
  const notificationIds: string[] = [];

  userIds.forEach(userId => {
    const notificationRef = firestoreAdmin!
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc();

    let notification: any = {
      ...notificationData,
      id: notificationRef.id,
      createdAt: FieldValue.serverTimestamp(),
    };
    // Remove undefined fields
    Object.keys(notification).forEach(key => {
      if (notification[key] === undefined) {
        delete notification[key];
      }
    });
    if (
      notificationData.type === 'friend_request' ||
      notificationData.type === 'follow_request' ||
      notificationData.type === 'plan_invitation' ||
      (notificationData.type === 'plan_share' && notificationData.status)
    ) {
      notification.status = notificationData.status || 'pending';
      notification.handled = false;
      notification.isRead = false;
    } else {
      notification.isRead = false;
    }
    batch.set(notificationRef, notification);
    notificationIds.push(notificationRef.id);
  });

  await batch.commit();
  return notificationIds;
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const notificationRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc(notificationId);

  await notificationRef.update({
    isRead: true,
    readAt: FieldValue.serverTimestamp(),
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const notificationsRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications');

  const unreadNotifications = await notificationsRef
    .where('isRead', '==', false)
    .get();

  const batch = firestoreAdmin.batch();
  unreadNotifications.docs.forEach(doc => {
    batch.update(doc.ref, {
      isRead: true,
      readAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const notificationsRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications');

  const snapshot = await notificationsRef
    .where('isRead', '==', false)
    .count()
    .get();

  return snapshot.data().count;
}

export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const notificationRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc(notificationId);

  await notificationRef.delete();
}

export async function deleteOldNotifications(
  userId: string,
  daysOld: number = 30
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const notificationsRef = firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('notifications');

  const oldNotifications = await notificationsRef
    .where('createdAt', '<', cutoffDate)
    .get();

  const batch = firestoreAdmin.batch();
  oldNotifications.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
} 