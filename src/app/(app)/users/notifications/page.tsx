"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Bell } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isWithinInterval, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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
      
      if (isToday(notificationDate)) {
        today.push(notification);
      } else if (isYesterday(notificationDate)) {
        yesterday.push(notification);
      } else if (isWithinInterval(notificationDate, { start: subDays(now, 7), end: subDays(now, 2) })) {
        // Last 7 days, but exclude today and yesterday
        last7Days.push(notification);
      } else if (isWithinInterval(notificationDate, { start: subDays(now, 30), end: subDays(now, 8) })) {
        // Last 30 days, but exclude the last 7 days
        last30Days.push(notification);
      }
    });

    return { today, yesterday, last7Days, last30Days };
  }, [otherNotifications]);

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

  // Fetch other notifications from database
  useEffect(() => {
    const fetchOtherNotifications = async () => {
      if (!user) return;
      setIsLoadingOtherNotifications(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/notifications/get', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out friend requests (handled in the requests tab)
          const filteredNotifications = data.notifications.filter((notification: any) => 
            notification.type !== 'friend_request'
          );
          setOtherNotifications(filteredNotifications);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoadingOtherNotifications(false);
      }
    };
    fetchOtherNotifications();
  }, [user]);

  // Approve/Deny handlers
  const handleApproveRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/approve-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
  };
  const handleDenyRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/deny-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
  };

  const handleBack = () => {
    router.back();
  };

  const renderRequestItem = (request: PendingFollowRequest) => (
    <li key={request.id} className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* User Avatar with Action Overlay */}
        <div className="relative">
          {request.requesterAvatarUrl ? (
            <img
              src={request.requesterAvatarUrl}
              alt={request.requesterUsername || request.fromUserId}
              className="w-10 h-10 rounded-full object-cover border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
              {(request.requesterUsername || request.fromUserId)[0]?.toUpperCase()}
            </div>
          )}
          {/* Friend Request Overlay Icon */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
            <div className="w-2.5 h-2.5 text-purple-500">👥</div>
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">{request.requesterUsername || request.fromUserId}</span>
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
        <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90" onClick={() => handleApproveRequest(request.fromUserId)}>Approve</Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleDenyRequest(request.fromUserId)}>Deny</Button>
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

  const renderOtherNotificationItem = (notification: any) => (
    <li key={notification.id} className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* User Avatar with Action Overlay */}
        <div className="relative">
          {notification.type !== 'system' && notification.avatarUrl ? (
            <img
              src={notification.avatarUrl}
              alt={notification.userName || 'User'}
              className="w-10 h-10 rounded-full object-cover border"
            />
          ) : notification.type !== 'system' ? (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
              {(notification.userName || 'U')[0]?.toUpperCase()}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
              ⚙️
            </div>
          )}
          
          {/* Action Overlay Icon */}
          {notification.type !== 'system' && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
              {notification.type === 'post_interaction' && notification.action === 'like' ? (
                <div className="w-2.5 h-2.5 text-red-500">❤️</div>
              ) : notification.type === 'post_interaction' && notification.action === 'comment' ? (
                <div className="w-2.5 h-2.5 text-blue-500">💬</div>
              ) : notification.type === 'plan_share' ? (
                <div className="w-2.5 h-2.5 text-blue-500">📋</div>
              ) : notification.type === 'plan_invitation' ? (
                <div className="w-2.5 h-2.5 text-green-500">📅</div>
              ) : notification.type === 'plan_completion' ? (
                <div className="w-2.5 h-2.5 text-green-500">✅</div>
              ) : notification.type === 'friend_request' ? (
                <div className="w-2.5 h-2.5 text-purple-500">👥</div>
              ) : (
                <div className="w-2.5 h-2.5 text-muted-foreground">🔔</div>
              )}
            </div>
          )}
        </div>
        
        {/* User Info and Action */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium">
              {notification.type === 'system' ? notification.title : (notification.userName || 'Unknown User')}
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
            {notification.type === 'plan_share' ? 'shared a plan with you' :
             notification.type === 'plan_invitation' ? 'invited you to a plan' :
             notification.type === 'post_interaction' ? 'interacted with your post' :
             notification.type === 'plan_completion' ? 'marked a plan as completed' :
             notification.type === 'system' ? 'system notification' :
             notification.description}
          </span>
        </div>
      </div>
      
      {/* Right side - Visual preview and actions */}
      <div className="flex items-center gap-2">
        {/* Visual preview of the interacted item */}
        {notification.type !== 'system' && (
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
        
        {/* Unread indicator and action button */}
        <div className="flex flex-col items-end gap-1">
          {!notification.isRead && (
            <div className="w-2 h-2 rounded-full bg-primary"></div>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="rounded-full h-6 px-2 text-xs"
            onClick={async () => {
              if (!user) return;
              try {
                const idToken = await user.getIdToken();
                const response = await fetch('/api/notifications/mark-as-read', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ notificationId: notification.id })
                });
                if (response.ok) {
                  // Update local state
                  setOtherNotifications(prev => 
                    prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                  );
                }
              } catch (error) {
                console.error('Error marking notification as read:', error);
              }
            }}
          >
            Mark Read
          </Button>
        </div>
      </div>
    </li>
  );

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

  return (
    <div className="fixed inset-0 z-30 bg-background w-full h-full pb-16">
      <div className="flex items-center p-4">
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
      
      {/* Tab Switcher - aligned left with icons */}
      <div className="flex items-center justify-start px-4 pt-2 pb-4 mb-6">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab('requests')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-2",
              activeTab === 'requests'
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Pending Requests
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
          </button>
        </div>
      </div>
      
      {/* Mark All as Read button for Other tab */}
      {activeTab === 'other' && otherNotifications.some(n => !n.isRead) && (
        <div className="flex justify-center px-4 pb-4">
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-full"
            onClick={async () => {
              if (!user) return;
              try {
                const idToken = await user.getIdToken();
                const response = await fetch('/api/notifications/mark-as-read', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ markAll: true })
                });
                if (response.ok) {
                  // Update local state
                  setOtherNotifications(prev => 
                    prev.map(n => ({ ...n, isRead: true }))
                  );
                }
              } catch (error) {
                console.error('Error marking all notifications as read:', error);
              }
            }}
          >
            Mark All as Read
          </Button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'requests' && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {isLoadingPendingRequests ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Loading requests...</h3>
                  <p className="text-muted-foreground text-sm">Checking for pending follow requests</p>
                </div>
              </div>
            ) : pendingFollowRequests.length === 0 ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">No pending requests</h3>
                  <p className="text-muted-foreground text-sm">All clear! 🎉 Your friend requests are up to date.</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                {renderGroup('Today', groupedRequests.today)}
                {renderGroup('Yesterday', groupedRequests.yesterday)}
                {renderGroup('Last 7 days', groupedRequests.last7Days)}
                {renderGroup('Last 30 days', groupedRequests.last30Days)}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'other' && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
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
            ) : otherNotifications.length === 0 ? (
              <div className="text-center space-y-4 mt-32">
                <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <Bell className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">No notifications yet</h3>
                  <p className="text-muted-foreground text-sm">Stay tuned! 🔔 We'll notify you when something exciting happens.</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                {renderOtherGroup('Today', groupedOtherNotifications.today)}
                {renderOtherGroup('Yesterday', groupedOtherNotifications.yesterday)}
                {renderOtherGroup('Last 7 days', groupedOtherNotifications.last7Days)}
                {renderOtherGroup('Last 30 days', groupedOtherNotifications.last30Days)}
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