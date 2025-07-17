import type { NotificationData } from './notificationService.server';

export interface ClientNotification extends NotificationData {
  id: string;
  createdAt: Date;
  isRead: boolean;
  readAt?: Date;
  // Actionable notification fields
  status?: 'pending' | 'approved' | 'denied' | 'accepted' | 'declined';
  handled?: boolean;
  // User action fields
  userName?: string;
  // Chat message fields
  chatId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string;
  messagePreview?: string;
  // Description is now optional from NotificationData
}

export async function fetchNotifications(idToken: string): Promise<ClientNotification[]> {
  const response = await fetch('/api/notifications/get', {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  const data = await response.json();
  return data.notifications.map((notification: any) => ({
    ...notification,
    createdAt: new Date(notification.createdAt),
    readAt: notification.readAt ? new Date(notification.readAt) : undefined
  }));
}

export async function markNotificationAsRead(idToken: string, notificationId: string): Promise<void> {
  const response = await fetch('/api/notifications/mark-as-read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ notificationId })
  });

  if (!response.ok) {
    throw new Error('Failed to mark notification as read');
  }
}

export async function markAllNotificationsAsRead(idToken: string): Promise<void> {
  const response = await fetch('/api/notifications/mark-as-read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ markAll: true })
  });

  if (!response.ok) {
    throw new Error('Failed to mark all notifications as read');
  }
}

export async function getUnreadNotificationCount(idToken: string): Promise<number> {
  const notifications = await fetchNotifications(idToken);
  return notifications.filter(notification => !notification.isRead).length;
} 