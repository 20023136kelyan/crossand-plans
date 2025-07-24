import { updateMyRSVPAction } from '@/app/actions/planActions';
import toast from 'react-hot-toast';

export interface NotificationItem {
  id: string;
  type: string;
  fromUserId?: string;
  createdAt: any;
  userName?: string;
  avatarUrl?: string;
  handled?: boolean;
  isRead?: boolean;
  metadata?: any;
  planName?: string;
  description?: string;
  status?: string;
  isPendingFollowRequest?: boolean;
}

export interface PendingFollowRequest {
  id: string;
  fromUserId: string;
  createdAt?: any;
  requesterName?: string;
  requesterAvatarUrl?: string | null;
  requesterUsername?: string | null;
}

// Helper to check if a notification is actionable
export const isActionable = (n: NotificationItem): boolean => {
  return (
    (n.type === 'friend_request' || 
     n.type === 'follow_request' || 
     n.type === 'plan_invitation' || 
     (n.type === 'plan_share' && n.status)) &&
    n.handled === false
  );
};

// Helper to check if a notification is informational
export const isInformational = (n: NotificationItem): boolean => {
  return !isActionable(n);
};

// Helper to check if a notification is unread and informational
export const isUnreadInformational = (n: NotificationItem): boolean => {
  return !isActionable(n) && !n.isRead;
};

// Mark notification as read and optionally handled
export const markNotificationAsRead = async (
  user: any,
  notificationId: string, 
  handled?: boolean
): Promise<boolean> => {
  if (!user) return false;
  
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/notifications/mark-as-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ notificationId, handled })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

// Handle follow request approval
export const handleFollowRequestApproval = async (
  user: any,
  requesterId: string,
  notificationId?: string
): Promise<boolean> => {
  if (!user) return false;
  
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/users/approve-follow-request', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify({ requesterId })
    });
    
    if (response.ok && notificationId) {
      await markNotificationAsRead(user, notificationId, true);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Error approving follow request:', error);
    return false;
  }
};

// Handle follow request denial
export const handleFollowRequestDenial = async (
  user: any,
  requesterId: string,
  notificationId?: string
): Promise<boolean> => {
  if (!user) return false;
  
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/users/deny-follow-request', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify({ requesterId })
    });
    
    if (response.ok && notificationId) {
      await markNotificationAsRead(user, notificationId, true);
    }
    
    return response.ok;
  } catch (error) {
    console.error('Error denying follow request:', error);
    return false;
  }
};

// Handle plan invitation RSVP
export const handlePlanInvitationRSVP = async (
  user: any,
  notification: NotificationItem,
  status: 'accepted' | 'declined'
): Promise<boolean> => {
  if (!user || !notification.metadata?.planId) return false;
  
  try {
    const idToken = await user.getIdToken();
    const rsvpStatus = status === 'accepted' ? 'going' : 'not-going';
    const result = await updateMyRSVPAction(notification.metadata.planId, idToken, rsvpStatus);
    
    if (result.success) {
      toast.success(`RSVP updated to ${status === 'accepted' ? 'Going' : 'Not Going'}`);
      if (notification.id) {
        await markNotificationAsRead(user, notification.id, true);
      }
      return true;
    } else {
      toast.error(result.error || 'Failed to update RSVP');
      return false;
    }
  } catch (error) {
    console.error('Error handling RSVP:', error);
    toast.error('Failed to update RSVP');
    return false;
  }
};

// Combine actionable notifications from different sources
export const combineActionableNotifications = (
  pendingFollowRequests: PendingFollowRequest[],
  otherNotifications: NotificationItem[]
): NotificationItem[] => {
  // Map pendingFollowRequests to notification-like objects
  const mappedFollowRequests: NotificationItem[] = pendingFollowRequests.map(req => ({
    id: req.id,
    type: 'follow_request',
    fromUserId: req.fromUserId,
    createdAt: req.createdAt,
    userName: req.requesterName || req.requesterUsername || req.fromUserId,
    avatarUrl: req.requesterAvatarUrl,
    handled: false,
    isPendingFollowRequest: true,
  }));
  
  // Get actionable notifications from Firestore
  const actionableFromFirestore: NotificationItem[] = otherNotifications
    .filter(isActionable)
    .map(n => ({ ...n, isPendingFollowRequest: false }));
  
  return [...mappedFollowRequests, ...actionableFromFirestore];
};

// Get notification display text based on type
export const getNotificationDisplayText = (notification: NotificationItem): string => {
  switch (notification.type) {
    case 'follow_request':
      return 'wants to follow you';
    case 'follow_notice':
      return 'started following you';
    case 'plan_invitation':
      return `invited you to ${notification.planName || notification.description || 'a plan'}`;
    case 'plan_share':
      return `shared a plan with you`;
    case 'friend_request':
      return 'wants to be your friend';
    case 'plan_rsvp_response':
      if (notification.metadata?.status === 'going') {
        return `accepted your invitation to ${notification.planName || notification.description || 'a plan'}`;
      } else if (notification.metadata?.status === 'declined') {
        return `declined your invitation to ${notification.planName || notification.description || 'a plan'}`;
      }
      return 'responded to your invitation';
    default:
      return notification.description || 'sent you a notification';
  }
};

// Get notification icon based on type
export const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'follow_request':
    case 'follow_notice':
      return '👥';
    case 'plan_invitation':
    case 'plan_share':
      return '📅';
    case 'friend_request':
      return '🤝';
    default:
      return '🔔';
  }
}; 