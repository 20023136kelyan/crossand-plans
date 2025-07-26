"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Bell, Clock, Check, X, Mic, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

import { formatDistanceToNow, format, isToday, isYesterday, isWithinInterval, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { updateMyRSVPAction } from '@/app/actions/planActions';
import toast from 'react-hot-toast';

// Helper function to get preferred display name (username first, then first name)
const getPreferredDisplayName = (notification: any): string => {
  // For chat messages, prioritize username over full name (same as other notifications)
  if (notification.type === 'chat_message') {
    // The backend already sets senderName with priority: username > firstName > name
    // So we just need to handle full names by extracting first name
    if (notification.senderName && notification.senderName.includes(' ')) {
      return notification.senderName.split(' ')[0];
    }
    return notification.senderName || 'Unknown User';
  }
  
  // For follow requests from pendingFollowRequests
  if (notification.isPendingFollowRequest) {
    return notification.userName || 'Someone';
  }
  
  // For PendingFollowRequest objects (direct from API)
  if (notification.requesterUsername || notification.requesterName) {
    return notification.requesterUsername || notification.requesterName || 'Someone';
  }
  
  // For all other notifications, prioritize username over full name
  if (notification.userName) {
    // If userName contains a space, it might be a full name, so extract first name
    if (notification.userName.includes(' ')) {
      return notification.userName.split(' ')[0];
    }
    return notification.userName;
  }
  
  // Check for firstName field (from user document)
  if (notification.firstName) {
    return notification.firstName;
  }
  
  // For system notifications, use title as is
  if (notification.type === 'system') {
    return notification.title || 'System';
  }
  
  // Fallback for old notifications: try to extract name from title
  if (notification.title && notification.title.includes(' ')) {
    return notification.title.split(' ')[0];
  }
  
  return 'Someone';
};

export default function NotificationsPage() {
  const { user, currentUserProfile } = useAuth();
  const router = useRouter();
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'other'>('requests');
  
  // Update the type for pendingFollowRequests
  interface PendingFollowRequest {
    id: string;
    fromUserId: string;
    createdAt?: any; // Firestore Timestamp, string, or Date
    requesterName?: string;
    requesterAvatarUrl?: string | null;
    requesterUsername?: string | null;
  }
  const [pendingFollowRequests, setPendingFollowRequests] = useState<PendingFollowRequest[]>([]);
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(false);
  
  // Real notifications from database
  const [otherNotifications, setOtherNotifications] = useState<any[]>([]);
  const [isLoadingOtherNotifications, setIsLoadingOtherNotifications] = useState(false);

  // Group requests by date
  const groupedRequests = useMemo(() => {
    const today: PendingFollowRequest[] = [];
    const yesterday: PendingFollowRequest[] = [];
    const last7Days: PendingFollowRequest[] = [];
    const last30Days: PendingFollowRequest[] = [];

    pendingFollowRequests.forEach(request => {
      const requestDate = toDateSafe(request.createdAt);
      const now = new Date();
      
      if (isToday(requestDate)) {
        today.push(request);
      } else if (isYesterday(requestDate)) {
        yesterday.push(request);
      } else if (isWithinInterval(requestDate, { start: subDays(now, 7), end: subDays(now, 2) })) {
        // Last 7 days, but exclude today and yesterday
        last7Days.push(request);
      } else if (isWithinInterval(requestDate, { start: subDays(now, 30), end: subDays(now, 8) })) {
        // Last 30 days, but exclude the last 7 days
        last30Days.push(request);
      }
    });

    return { today, yesterday, last7Days, last30Days };
  }, [pendingFollowRequests]);

  // Group other notifications by date
  const groupedOtherNotifications = useMemo(() => {
    const today: typeof otherNotifications = [];
    const yesterday: typeof otherNotifications = [];
    const last7Days: typeof otherNotifications = [];
    const last30Days: typeof otherNotifications = [];

    otherNotifications.forEach(notification => {
      const notificationDate = notification.createdAt;
      
      const now = new Date();
      const parsedDate = toDateSafe(notificationDate);
      
      if (isToday(parsedDate)) {
        today.push(notification);
      } else if (isYesterday(parsedDate)) {
        yesterday.push(notification);
      } else if (isWithinInterval(parsedDate, { start: subDays(now, 7), end: subDays(now, 2) })) {
        // Last 7 days, but exclude today and yesterday
        last7Days.push(notification);
      } else if (isWithinInterval(parsedDate, { start: subDays(now, 30), end: subDays(now, 8) })) {
        // Last 30 days, but exclude the last 7 days
        last30Days.push(notification);
      }
    });
    return { today, yesterday, last7Days, last30Days };
  }, [otherNotifications]);

  // Helper to get initials for fallback
  const isActionable = (n: any) =>
    (n.type === 'friend_request' || n.type === 'plan_invitation' || (n.type === 'plan_share' && n.status))
    && n.handled === false;

  // Combine actionable notifications from Firestore with pending follow requests
  const actionableNotifications = useMemo(() => {
    // Map pendingFollowRequests to notification-like objects for unified rendering
    const mappedFollowRequests = pendingFollowRequests.map(req => ({
      id: req.id,
      type: 'follow_request',
      fromUserId: req.fromUserId,
      createdAt: req.createdAt,
      userName: req.requesterUsername || req.requesterName || req.fromUserId,
      avatarUrl: req.requesterAvatarUrl,
      handled: false,
      isPendingFollowRequest: true, // custom flag
    }));
    
    // Get actionable notifications from Firestore, but exclude follow_request if we have pendingFollowRequests
    const actionableFromFirestore = otherNotifications
      .filter(isActionable)
      .filter(n => {
        // Always exclude follow_request notifications from Firestore since we handle them via pendingFollowRequests
        // This prevents duplicates and ensures we use the better user info from pendingFollowRequests
        if (n.type === 'follow_request') {
          return false;
        }
        return true;
      })
      .map(n => ({ ...n, isPendingFollowRequest: false }));
    
    return [...mappedFollowRequests, ...actionableFromFirestore];
  }, [pendingFollowRequests, otherNotifications]);

  // Group actionable notifications by date
  const groupedActionable = useMemo(() => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const last7Days: any[] = [];
    const last30Days: any[] = [];
    actionableNotifications.forEach(n => {
      const date = toDateSafe(n.createdAt);
      const now = new Date();
      if (isToday(date)) {
        today.push(n);
      } else if (isYesterday(date)) {
        yesterday.push(n);
      } else if (isWithinInterval(date, { start: subDays(now, 7), end: subDays(now, 2) })) {
        last7Days.push(n);
      } else if (isWithinInterval(date, { start: subDays(now, 30), end: subDays(now, 8) })) {
        last30Days.push(n);
      }
    });
    return { today, yesterday, last7Days, last30Days };
  }, [actionableNotifications]);

  useEffect(() => {
    if (currentUserProfile && typeof currentUserProfile.isPrivate === 'boolean') {
      setIsPrivate(currentUserProfile.isPrivate);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!user || !isPrivate) return;
      setIsLoadingPendingRequests(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/users/pending-follow-requests', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPendingFollowRequests(data.pendingFollowRequests || []);
        }
      } catch (error) {
        // Optionally show error
      } finally {
        setIsLoadingPendingRequests(false);
      }
    };
    fetchPendingRequests();
  }, [user, isPrivate]);

  // Fetch all notifications (not just filter out friend_request)
  useEffect(() => {
    const fetchAllNotifications = async () => {
      if (!user) return;
      setIsLoadingOtherNotifications(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/notifications/get', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setOtherNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoadingOtherNotifications(false);
      }
    };
    fetchAllNotifications();
  }, [user]);

  // Mark informational notifications as read when they're viewed
  useEffect(() => {
    if (activeTab === 'other' && otherNotifications.length > 0) {
      const unreadInformationalNotifications = otherNotifications.filter(
        notification => !notification.isRead && !isActionable(notification)
      );
      
      // Mark informational notifications as read when viewed (including chat messages)
      unreadInformationalNotifications.forEach(notification => {
        markNotificationAsRead(notification.id);
      });
    }
  }, [activeTab, otherNotifications]);

  // Approve/Deny handlers
  const handleApproveRequest = async (requesterId: string, notificationId?: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/approve-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
    if (notificationId) await markNotificationAsRead(notificationId, true);
  };
  const handleDenyRequest = async (requesterId: string, notificationId?: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/deny-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
    if (notificationId) await markNotificationAsRead(notificationId, true);
  };

  const handleBack = () => {
    router.back();
  };

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationId: string, handled?: boolean) => {
    if (!user) return;
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
      if (response.ok) {
        // Update local state
        setOtherNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true, ...(handled ? { handled: true } : {}) } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const renderRequestItem = (request: PendingFollowRequest) => (
    <li key={request.id} className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* User Avatar with Action Overlay */}
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={request.requesterAvatarUrl || undefined}
              alt={request.requesterUsername || request.fromUserId}
            />
            <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
              {(request.requesterUsername || request.fromUserId)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Friend Request Overlay Icon */}
          <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
            <span className="text-base">👥</span>
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">{getPreferredDisplayName(request)}</span>
            {request.createdAt && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground" title={format(
                  toDateSafe(request.createdAt),
                  'PPpp')
                }>
                  {formatCompactTime(toDateSafe(request.createdAt))}
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">wants to be your friend</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90" onClick={() => handleApproveRequest(request.fromUserId, request.id)}>Approve</Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleDenyRequest(request.fromUserId, request.id)}>Deny</Button>
      </div>
    </li>
  );

  const renderGroup = (title: string, requests: PendingFollowRequest[]) => {
    if (requests.length === 0) return null;
    
    return (
      <div key={title} className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{title}</h3>
        <ul className="space-y-2">
          {requests.map(renderRequestItem)}
                </ul>
      </div>
    );
  };

  const renderActionableItem = (n: any) => {
    if (n.type === 'follow_request' && n.isPendingFollowRequest) {
      // Render as before for pendingFollowRequests
      return renderRequestItem(n);
    }
    // RSVP handlers for plan invitations
    if (n.type === 'plan_invitation') {
      const handleRSVP = async (status: 'accepted' | 'declined') => {
        if (!user || !n.metadata?.planId) return;
        try {
          const idToken = await user.getIdToken();
          const rsvpStatus = status === 'accepted' ? 'going' : 'not-going';
          const result = await updateMyRSVPAction(n.metadata.planId, idToken, rsvpStatus);
          if (result.success) {
            toast.success(`RSVP updated to ${status === 'accepted' ? 'Going' : 'Not Going'}`);
            if (n.id) await markNotificationAsRead(n.id, true);
          } else {
            toast.error(result.error || 'Failed to update RSVP');
          }
        } catch (error) {
          console.error('Error handling RSVP:', error);
          toast.error('Failed to update RSVP');
        }
      };
      // Render plan invitation with RSVP buttons
      return (
        <li key={n.id} className="flex items-center justify-between rounded-lg transition bg-muted/10 p-3 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={n.avatarUrl || undefined} alt={getPreferredDisplayName(n)} />
                <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
                  {getPreferredDisplayName(n)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
                <span className="text-base">📨</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">{getPreferredDisplayName(n)}</span>
                {n.createdAt && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground" title={format(
                      toDateSafe(n.createdAt),
                      'PPpp')
                    }>
                      {formatCompactTime(toDateSafe(n.createdAt))}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                invited you to <span className="font-semibold text-foreground">{n.description || n.planName || 'a plan'}</span>
              </span>
            </div>
          </div>
          {/* RSVP Icon Buttons */}
          <div className="flex gap-2 ml-2">
            <Button size="icon" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90" aria-label="Accept invitation" onClick={() => handleRSVP('accepted')}>
              <Check className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="outline" className="rounded-full" aria-label="Decline invitation" onClick={() => handleRSVP('declined')}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </li>
      );
    }
    // Render other actionable notifications (e.g., future types)
    return (
      <li key={n.id} className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg transition"
        onClick={async () => {
          if (!user) return;
          try {
            if (!n.isRead && n.id) await markNotificationAsRead(n.id);
          } catch (error) {
            console.error('Error handling actionable notification click:', error);
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={n.avatarUrl || undefined} alt={getPreferredDisplayName(n)} />
              <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
                {getPreferredDisplayName(n)[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
              <span className="text-base">👋</span>
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate font-medium">{getPreferredDisplayName(n)}</span>
              {n.createdAt && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground" title={format(
                    toDateSafe(n.createdAt),
                    'PPpp')
                  }>
                    {formatCompactTime(toDateSafe(n.createdAt))}
                  </span>
                </>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {n.title || n.description}
            </span>
          </div>
        </div>
      </li>
    );
  };

  const renderOtherNotificationItem = (notification: any) => {
    // Chat message notification special handling
    if (notification.type === 'chat_message') {
      return (
        <li key={notification.id} className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg transition"
          onClick={async () => {
            if (!user) return;
            try {
              // Navigate to chat (marking as read is handled automatically when viewed)
              router.push(notification.actionUrl || `/messages/${notification.chatId}`);
            } catch (error) {
              console.error('Error handling chat notification click:', error);
            }
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={notification.senderAvatarUrl || undefined} alt={getPreferredDisplayName(notification)} />
                <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
                  {getPreferredDisplayName(notification)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
                <span className="text-base">💬</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">{getPreferredDisplayName(notification)}</span>
                {notification.createdAt && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground" title={format(
                      toDateSafe(notification.createdAt),
                      'PPpp')
                    }>
                      {formatCompactTime(toDateSafe(notification.createdAt))}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                {notification.mediaType === 'voice' ? (
                  <>
                    <Mic className="h-3 w-3 flex-shrink-0" />
                    <span>Voice message</span>
                  </>
                ) : notification.mediaType === 'image' || notification.mediaType === 'gif' ? (
                  <>
                    <ImageIcon className="h-3 w-3 flex-shrink-0" />
                    <span>Photo</span>
                  </>
                ) : (
                  notification.messagePreview || notification.description
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary"></div>
            )}
          </div>
        </li>
      );
    }
    // RSVP response notifications (accepted/declined)
    if (notification.type === 'plan_rsvp_response') {
      return (
        <li key={notification.id} className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg transition"
          onClick={async () => {
            if (!user) return;
            try {
              if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
              }
              // Optionally, navigate to plan details
              if (notification.actionUrl) {
                router.push(notification.actionUrl);
              }
            } catch (error) {
              console.error('Error handling RSVP response notification click:', error);
            }
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={notification.avatarUrl || undefined} alt={getPreferredDisplayName(notification)} />
                <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
                  {getPreferredDisplayName(notification)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
                <span className="text-base">{notification.metadata?.status === 'going' ? '🤝' : '❌'}</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">{getPreferredDisplayName(notification)}</span>
                {notification.createdAt && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground" title={format(
                      toDateSafe(notification.createdAt),
                      'PPpp')
                    }>
                      {formatCompactTime(toDateSafe(notification.createdAt))}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {getNotificationDisplayText(notification)}
              </span>
            </div>
          </div>
          {/* Unread indicator */}
          <div className="flex flex-col items-end gap-1">
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary"></div>
            )}
          </div>
        </li>
      );
    }
    // Actionable notification types
    if (notification.type === 'friend_request' || notification.type === 'follow_request' || notification.type === 'plan_invitation' || (notification.type === 'plan_share' && notification.status)) {
      return (
        <li key={notification.id} className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded-lg transition"
          onClick={async () => {
            if (!user) return;
            try {
              // Mark as read if not already
              if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
              }
              // Handle specific actions if needed
              if (notification.type === 'friend_request') {
                handleApproveRequest(notification.requesterId);
              } else if (notification.type === 'plan_invitation') {
                // Navigate to plan details or invite page
                router.push(`/plans/${notification.planId}`);
              } else if (notification.type === 'plan_share' && notification.status === 'pending') {
                // Navigate to plan details or manage shares
                router.push(`/plans/${notification.planId}`);
              }
            } catch (error) {
              console.error('Error handling actionable notification click:', error);
            }
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* User Avatar with Action Overlay */}
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={notification.avatarUrl || undefined} alt={getPreferredDisplayName(notification)} />
                <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
                  {getPreferredDisplayName(notification)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Action Overlay Icon */}
              {notification.type !== 'system' && (
                <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
                  {notification.type === 'post_interaction' ? (
                    <span className="text-base">{notification.metadata?.interactionType === 'like' ? '❤️' : '💬'}</span>
                  ) : notification.type === 'plan_share' ? (
                    <span className="text-base">📝</span>
                  ) : notification.type === 'plan_invitation' ? (
                    <span className="text-base">📨</span>
                  ) : notification.type === 'plan_completion' ? (
                    <span className="text-base">🎉</span>
                  ) : notification.type === 'friend_request' || notification.type === 'follow_request' ? (
                    <span className="text-base">👋</span>
                  ) : notification.type === 'chat_message' ? (
                    <span className="text-base">💬</span>
                  ) : (
                    <span className="text-base">🔔</span>
                  )}
                </div>
              )}
            </div>
            
            {/* User Info and Action */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">
                  {notification.type === 'system' ? notification.title : getPreferredDisplayName(notification)}
                </span>
                {notification.createdAt && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground" title={format(
                      toDateSafe(notification.createdAt),
                      'PPpp')
                    }>
                      {formatCompactTime(toDateSafe(notification.createdAt))}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {notification.type === 'system' ? notification.description :
                 notification.description || notification.title}
              </span>
            </div>
          </div>
          
          {/* Right side - Visual preview and actions */}
          <div className="flex items-center gap-2">
            {/* Visual preview of the interacted item */}
            {notification.type !== 'system' &&
              notification.type !== 'follow_request' &&
              notification.type !== 'follow_notice' &&
              notification.type !== 'friend_request' && (
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {notification.type === 'plan_share' || notification.type === 'plan_invitation' || notification.type === 'plan_completion' ? (
                  notification.planImageUrl ? (
                    <img
                      src={notification.planImageUrl}
                      alt="Plan"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">
                      📋
                    </div>
                  )
                ) : notification.type === 'post_interaction' ? (
                  notification.postImageUrl ? (
                    <img
                      src={notification.postImageUrl}
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xs">
                      📷
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                    📄
                  </div>
                )}
              </div>
            )}
            
            {/* Unread indicator */}
            <div className="flex flex-col items-end gap-1">
              {!notification.isRead && (
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              )}
            </div>
          </div>
        </li>
      );
    }
    // Informational notifications
    return (
    <li key={notification.id} className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* User Avatar with Action Overlay */}
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={notification.avatarUrl || undefined} alt={getPreferredDisplayName(notification)} />
            <AvatarFallback className="text-xs font-bold text-muted-foreground border bg-muted">
              {notification.type !== 'system'
                ? getPreferredDisplayName(notification)[0]?.toUpperCase()
                : '⚙️'}
            </AvatarFallback>
          </Avatar>
          
          {/* Action Overlay Icon */}
          {notification.type !== 'system' && (
            <div className="absolute" style={{ bottom: '-10px', right: '-6px' }}>
              {notification.type === 'post_interaction' ? (
                <span className="text-base">{notification.metadata?.interactionType === 'like' ? '❤️' : '💬'}</span>
              ) : notification.type === 'plan_share' ? (
                <span className="text-base">📝</span>
              ) : notification.type === 'plan_invitation' ? (
                <span className="text-base">📨</span>
              ) : notification.type === 'plan_completion' ? (
                <span className="text-base">🎉</span>
              ) : notification.type === 'friend_request' || notification.type === 'follow_request' || notification.type === 'follow_notice' ? (
                <span className="text-base">👋</span>
              ) : notification.type === 'chat_message' ? (
                <span className="text-base">💬</span>
              ) : (
                <span className="text-base">🔔</span>
              )}
            </div>
          )}
        </div>
        
        {/* User Info and Action */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">
                {notification.type === 'system' ? notification.title : getPreferredDisplayName(notification)}
            </span>
            {notification.createdAt && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground" title={format(
                  toDateSafe(notification.createdAt),
                  'PPpp')
                }>
                  {formatCompactTime(toDateSafe(notification.createdAt))}
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {notification.type === 'system' ? notification.description :
             notification.description || notification.title}
          </span>
        </div>
      </div>
      
      {/* Right side - Visual preview and actions */}
      <div className="flex items-center gap-2">
        {/* Visual preview of the interacted item */}
        {notification.type !== 'system' &&
          notification.type !== 'follow_request' &&
          notification.type !== 'follow_notice' &&
          notification.type !== 'friend_request' && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {notification.type === 'plan_share' || notification.type === 'plan_invitation' || notification.type === 'plan_completion' ? (
                notification.planImageUrl ? (
                  <img
                    src={notification.planImageUrl}
                    alt="Plan"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">
                    📋
                  </div>
                )
              ) : notification.type === 'post_interaction' ? (
                notification.postImageUrl ? (
                  <img
                    src={notification.postImageUrl}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xs">
                    📷
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                  📄
                </div>
              )}
            </div>
        )}
        
        {/* Unread indicator */}
        <div className="flex flex-col items-end gap-1">
          {!notification.isRead && (
            <div className="w-2 h-2 rounded-full bg-primary"></div>
          )}
        </div>
      </div>
    </li>
  );
    
    // Fallback for any notification that doesn't match the above patterns
    console.warn('Unhandled notification type:', notification);
    return (
      <li key={notification.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
            🔔
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate font-medium">{getPreferredDisplayName(notification)}</span>
            <span className="text-xs text-muted-foreground truncate">
              {notification.description || `Unknown notification type: ${notification.type}`}
            </span>
          </div>
        </div>
        {!notification.isRead && (
          <div className="w-2 h-2 rounded-full bg-primary"></div>
        )}
      </li>
    );
  };

  const renderOtherGroup = (title: string, notifications: any[]) => {
    if (notifications.length === 0) return null;
    
    return (
      <div key={title} className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{title}</h3>
        <ul className="space-y-2">
          {notifications.map(renderOtherNotificationItem)}
        </ul>
      </div>
    );
  };

  // Helper: informational types (show all, not just unread)
  const isInformational = (n: any) =>
    !isActionable(n);
  // Helper: unread informational types (for badge count)
  const isUnreadInformational = (n: any) =>
    !isActionable(n) && !n.isRead;

  // For type-safe group mapping
  const notificationGroups: [string, keyof typeof groupedOtherNotifications][] = [
    ['Today', 'today'],
    ['Yesterday', 'yesterday'],
    ['Last 7 days', 'last7Days'],
    ['Last 30 days', 'last30Days'],
  ];

  // Compute actionable and informational notification counts
  const actionableCount = otherNotifications.filter(isActionable).length + pendingFollowRequests.length;
  const informationalCount = otherNotifications.filter(isUnreadInformational).length;

  return (
    <div className="fixed inset-0 z-30 bg-background w-full h-full pb-16">
              <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
        </div>
      
      {/* Tab Switcher - aligned left with icons */}
      <div className="flex items-center justify-start px-4 pt-2 pb-4 mb-6">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab('requests')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-2",
              activeTab === 'requests'
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground"
            )}
          >
            <Clock className="h-4 w-4" />
            Pending
            {actionableCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary text-white">
                {actionableCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('other')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-2",
              activeTab === 'other'
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-4 w-4" />
            Other
            {informationalCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 min-w-[1.5em]">{informationalCount}</span>
            )}
          </button>

        </div>
      </div>
      

      
      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'requests' && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {isLoadingPendingRequests && isLoadingOtherNotifications ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Loading requests...</h3>
                  <p className="text-muted-foreground text-sm">Checking for pending requests</p>
                </div>
              </div>
            ) : actionableNotifications.length === 0 ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">No pending requests</h3>
                  <p className="text-muted-foreground text-sm">All clear! 🎉 Your requests are up to date.</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                {Object.entries(groupedActionable).map(([label, group]) =>
                  group.length > 0 && (
                    <div key={label} className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{label.charAt(0).toUpperCase() + label.slice(1)}</h3>
                      <ul className="space-y-2">
                        {group.map(renderActionableItem)}
                      </ul>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'other' && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Show all notifications */}
            {isLoadingOtherNotifications ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Loading notifications...</h3>
                  <p className="text-muted-foreground text-sm">Fetching your latest notifications</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                {notificationGroups.map(([label, key]) =>
                  renderOtherGroup(label, groupedOtherNotifications[key])
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function toDateSafe(ts: any): Date {
  if (!ts) return new Date('Invalid');
  if (typeof ts === 'string' || ts instanceof Date) return new Date(ts);
  if (typeof ts.toDate === 'function') return ts.toDate(); // Firestore Timestamp
  if (ts._seconds) return new Date(ts._seconds * 1000); // plain object from Firestore
  return new Date('Invalid');
}

function formatCompactTime(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 43200) return `${Math.floor(diffInMinutes / 1440)}d`;
  return `${Math.floor(diffInMinutes / 43200)}mo`;
} 

// Helper to get initials for fallback
function getInitials(name?: string, username?: string, email?: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  if (username) return username[0]?.toUpperCase();
  if (email) return email[0]?.toUpperCase();
  return 'U';
} 

function getNotificationDisplayText(notification: any): string {
  if (notification.type === 'plan_rsvp_response') {
    const status = notification.metadata?.status;
    if (status === 'going') {
      return `${getPreferredDisplayName(notification)} accepted your RSVP to the plan.`;
    } else if (status === 'not-going') {
      return `${getPreferredDisplayName(notification)} declined your RSVP to the plan.`;
    }
  }
  return notification.description || notification.title || 'a notification';
} 