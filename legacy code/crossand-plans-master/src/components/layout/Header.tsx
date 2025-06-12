
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import { Bell, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { getFriendships } from '@/services/userService';
import { getPendingPlanSharesForUser, getPendingPlanInvitationsCount } from '@/services/planService';
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
  type: 'friend_request' | 'plan_share' | 'plan_invitation' | 'plan_completion' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
  avatarUrl?: string;
}

export function Header({ messagesNotificationCount }: HeaderProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isOnFeedOrExplore = pathname === '/feed' || pathname === '/explore';
  
  const siteName = settings?.siteName || 'Macaroom';
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }
    
    const unsubscribers: (() => void)[] = [];
    
    // Listen for friend requests
    const unsubFriendRequests = getFriendships(
      user.uid,
      (allFriendships) => {
        const pendingRequests = allFriendships.filter(f => f.status === 'pending_received');
        const friendRequestNotifications: NotificationItem[] = pendingRequests.map(request => ({
          id: `friend_request_${request.uid}`,
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
      (error) => console.error('Error listening to friend requests:', error)
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
      const unsubPlanCompletions = getCompletedPlansForParticipant(user.uid, (completedPlans) => {
        const planCompletionNotifications: NotificationItem[] = completedPlans
          .filter(plan => !plan.completionConfirmedBy?.includes(user.uid))
          .map(plan => ({
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
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user?.uid]);
  
  const updateNotifications = (type: string, newNotifications: NotificationItem[]) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.type !== type);
      const updated = [...filtered, ...newNotifications];
      const unreadCount = updated.filter(n => !n.isRead).length;
      setNotificationCount(unreadCount);
      return updated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
  };
  
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };
  
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setNotificationCount(0);
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request': return '👥';
      case 'plan_share': return '📋';
      case 'plan_invitation': return '📅';
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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
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
                  For you
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 ml-auto mr-2 md:space-x-4 md:mr-4">
          {/* Notifications */}
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <div className="relative">
                  <Bell className="h-6 w-6 text-foreground/80 hover:text-primary transition-colors" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {notificationCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-96">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification, index) => (
                      <div key={notification.id}>
                        <div 
                          className={cn(
                            "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                            !notification.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
                          )}
                          onClick={() => {
                             markAsRead(notification.id);
                             if (notification.actionUrl) {
                               setIsNotificationsOpen(false);
                               router.push(notification.actionUrl);
                             }
                           }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {notification.avatarUrl ? (
                                <img 
                                  src={notification.avatarUrl} 
                                  alt="" 
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm">
                                  {getNotificationIcon(notification.type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {notification.title}
                                </p>
                                {!notification.isRead && (
                                  <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(notification.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Messages */}
          <Button variant="ghost" size="icon" asChild>
            <Link href="/messages" aria-label="Messages">
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-6 w-6 text-foreground/80 hover:text-primary transition-colors"
                >
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-5H6V9h12v2z"/>
                </svg>
                {messagesNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md"> 
                    {messagesNotificationCount > 9 ? '9+' : messagesNotificationCount}
                  </span>
                )}
              </div>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
