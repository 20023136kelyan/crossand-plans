'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import { Bell, X } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { getFriendships, getPendingPlanSharesForUser, getPendingPlanInvitationsCount, getCompletedPlansForParticipant, getPostInteractionsForUser } from '@/services/clientServices';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notificationService.client';
import { listenToNotifications } from '@/services/notificationListener';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { FriendEntry, PlanShare } from '@/types/user';

interface HeaderProps {
  messagesNotificationCount: number;
}

interface NotificationItem {
  id: string;
  type: 'friend_request' | 'follow_request' | 'plan_share' | 'plan_invitation' | 'plan_completion' | 'system' | 'post_interaction' | 'chat_message';
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
  avatarUrl?: string;
  handled?: boolean; // Added for new logic
  status?: string; // Added for new logic
}

interface PendingFollowRequest {
  id: string;
  fromUserId: string;
  createdAt?: any;
  requesterName?: string;
  requesterAvatarUrl?: string | null;
  requesterUsername?: string | null;
}

export function Header({ messagesNotificationCount }: HeaderProps) {
  const { user, authLoading } = useAuth();
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isOnFeedOrExplore = pathname === '/feed' || pathname === '/explore';
  
  const siteName = settings?.siteName || 'Crossand';
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<PendingFollowRequest[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  
  useEffect(() => {
    if (!user?.uid || authLoading) {
      setNotifications([]);
      setPendingFollowRequests([]);
      return;
    }
    
    // Listen for all notifications and handle unread count ourselves
    const notificationsListener = listenToNotifications(
      user.uid,
      (updatedNotifications: NotificationItem[]) => {
        setNotifications(updatedNotifications);
      },
      (error: any) => {
        console.error('Error listening to notifications:', error);
        setNotifications([]);
      }
    );
    
    const unsubscribers: (() => void)[] = [notificationsListener.unsubscribe];
    
    // Listen for friend requests
    
    const unsubFriendRequests = getFriendships(
      user.uid,
      (allFriendships) => {
        const pendingRequests = allFriendships.filter(f => f.status === 'pending_received');
        const friendRequestNotifications: NotificationItem[] = pendingRequests.map(request => ({
          id: `friend_request_${request.friendUid}`,
          type: 'friend_request',
          title: 'New Friend Request',
          description: `${request.name} wants to be your friend`,
          timestamp: new Date(),
          isRead: false,
          actionUrl: '/messages',
          avatarUrl: request.avatarUrl || undefined
        }));
        
        updateNotifications('friend_request', friendRequestNotifications);
      },
      (error) => {
        console.error('Error listening to friend requests:', error);
        // Clear friend request notifications on error
        updateNotifications('friend_request', []);
      }
    );
    unsubscribers.push(unsubFriendRequests);
    
    // Listen for plan shares
    if (typeof getPendingPlanSharesForUser === 'function') {
      const unsubPlanShares = getPendingPlanSharesForUser(user.uid, (shares: PlanShare[]) => {
        const planShareNotifications: NotificationItem[] = shares.map(share => ({
          id: `plan_share_${share.id}`,
          type: 'plan_share',
          title: 'Plan Shared With You',
          description: `${share.sharedByName} shared "${share.originalPlanName}" with you`,
          timestamp: share.createdAt instanceof Date ? share.createdAt : new Date(),
          isRead: false,
          actionUrl: `/plans/${share.originalPlanId}`,
          avatarUrl: share.sharedByAvatarUrl || undefined
        }));
        
        updateNotifications('plan_share', planShareNotifications);
      }, (error) => {
        console.error('Error listening to plan shares:', error);
        // Clear plan share notifications on error
        updateNotifications('plan_share', []);
      });
      unsubscribers.push(unsubPlanShares);
    }
    
    // Listen for plan invitations
    if (typeof getPendingPlanInvitationsCount === 'function') {
      const unsubPlanInvitations = getPendingPlanInvitationsCount(user.uid, (invitesCount) => {
        if (invitesCount > 0) {
          const planInviteNotifications: NotificationItem[] = [{
            id: 'plan_invitations',
            type: 'plan_invitation',
            title: 'Plan Invitations',
            description: `You have ${invitesCount} pending plan invitation${invitesCount > 1 ? 's' : ''}`,
            timestamp: new Date(),
            isRead: false,
            actionUrl: '/plans'
          }];
          
          updateNotifications('plan_invitation', planInviteNotifications);
        } else {
          updateNotifications('plan_invitation', []);
        }
      });
      unsubscribers.push(unsubPlanInvitations);
    }
    
    // Listen for plan completions where user is a participant
    if (typeof getCompletedPlansForParticipant === 'function') {
      const unsubPlanCompletions = getCompletedPlansForParticipant(user.uid, (completedPlans: any[]) => {
        const planCompletionNotifications: NotificationItem[] = completedPlans
          .filter((plan: any) => !plan.completionConfirmedBy?.includes(user.uid))
          .map((plan: any) => ({
            id: `plan_completion_${plan.id}`,
            type: 'plan_completion',
            title: 'Plan Completed!',
            description: `"${plan.name}" has been marked as completed. Confirm your participation!`,
            timestamp: new Date(plan.updatedAt),
            isRead: false,
            actionUrl: `/plans/${plan.id}`,
            avatarUrl: plan.hostAvatarUrl || undefined
          }));
        
        updateNotifications('plan_completion', planCompletionNotifications);
      });
      unsubscribers.push(unsubPlanCompletions);
    }
    
    // Listen for post interactions (likes and comments on user's posts)
    if (typeof getPostInteractionsForUser === 'function') {
      const unsubPostInteractions = getPostInteractionsForUser(user.uid, (interactions: any[]) => {
        const postInteractionNotifications: NotificationItem[] = interactions.map(interaction => {
          if (interaction.type === 'post_like') {
            return {
              id: interaction.id,
              type: 'post_interaction',
              title: 'New Like',
              description: `Someone liked your post "${interaction.postTitle}"`,
              timestamp: new Date(interaction.timestamp),
              isRead: false,
              actionUrl: `/feed?post=${interaction.postId}`,
              avatarUrl: interaction.postMediaUrl || undefined
            };
          } else if (interaction.type === 'post_comment') {
            return {
              id: interaction.id,
              type: 'post_interaction',
              title: 'New Comment',
              description: `Someone commented on your post "${interaction.postTitle}"`,
              timestamp: new Date(interaction.timestamp),
              isRead: false,
              actionUrl: `/feed?post=${interaction.postId}`,
              avatarUrl: interaction.postMediaUrl || undefined
            };
          }
          return null;
        }).filter(Boolean) as NotificationItem[];
        
        updateNotifications('post_interaction', postInteractionNotifications);
      });
      unsubscribers.push(unsubPostInteractions);
    }
    
    // Clean up all listeners
    return () => {
      notificationsListener.unsubscribe();
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user?.uid, authLoading]);

  // Fetch follow requests separately (like notifications page does)
  useEffect(() => {
    const fetchPendingFollowRequests = async () => {
      if (!user) return;
      
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
        console.error('Error fetching pending follow requests:', error);
      }
    };
    
    fetchPendingFollowRequests();
  }, [user]);
  
  const updateNotifications = (type: string, newNotifications: NotificationItem[]) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.type !== type);
      const updated = [...filtered, ...newNotifications];
      return updated.sort((a, b) => {
        const timeA = a.timestamp?.getTime?.() || 0;
        const timeB = b.timestamp?.getTime?.() || 0;
        return timeB - timeA;
      });
    });
  };
  
  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      await markNotificationAsRead(idToken, notificationId);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      await markAllNotificationsAsRead(idToken);
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request': return '👥';
      case 'plan_share': return '📋';
      case 'plan_invitation': return '📅';
      case 'plan_completion': return '✅';
      case 'post_interaction': return '💬';
      case 'system': return '⚙️';
      default: return '🔔';
    }
  };
  
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Helper functions for notification counts
  const isActionable = (n: NotificationItem) =>
    (n.type === 'friend_request' || n.type === 'follow_request' || n.type === 'plan_invitation' || 
     (n.type === 'plan_share' && n.status)) && n['handled'] === false;
  
  // Get all unread notifications (both actionable and non-actionable)
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const pendingActionable = notifications.filter(isActionable);
  
  // Total count includes all unread notifications and pending follow requests
  const totalNotificationCount = unreadNotifications.length + pendingFollowRequests.length;
  
  // Debug logging (commented out in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Notifications:', {
      all: notifications,
      unread: unreadNotifications,
      pendingActionable,
      pendingFollowRequests,
      total: totalNotificationCount
    });
  }

  return (
    <header className="sticky md:fixed top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            {/* Crossand Logo */}
            <img src="/images/crossand-logo.svg" alt="Crossand Logo" className="h-7 w-7" />
            {/* Hide app name on mobile to save space */}
            {!isMobile && <span className="text-2xl font-bold text-gradient-primary font-redressed">Crossand</span>}
          </Link>
          
          {/* Feed/Explore toggle buttons for mobile when on feed or explore pages */}
          {isMobile && isOnFeedOrExplore && (
            <div className="flex items-center ml-4">
              <div className="flex items-center">
                <Link 
                  href="/feed" 
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors relative",
                    pathname === '/feed'
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Home
                </Link>
                <Link 
                  href="/explore" 
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors relative",
                    pathname === '/explore'
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Explore
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 ml-auto mr-2 md:space-x-4 md:mr-4">
          {/* Notifications */}
          <Link href="/users/notifications" aria-label="Notifications">
            <Button variant="ghost" size="icon">
              <div className="relative">
                <Bell className="h-6 w-6 text-foreground/80 hover:text-primary transition-colors" />
                {totalNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md"> 
                    {totalNotificationCount > 9 ? '9+' : totalNotificationCount}
                  </span>
                )}
              </div>
            </Button>
          </Link>
          {/* Removed Messages button here */}
        </div>
      </div>
    </header>
  );
}
