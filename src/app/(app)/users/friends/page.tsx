'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useTheme } from 'next-themes';
import { ChevronLeft, Loader2, UserPlus, UserMinus, EyeOff, Users, UserCheck, Search, Circle, Heart } from 'lucide-react';
import { ArrowUpDown, Filter, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { followUserAction, unfollowUserAction, fetchPublicUserProfileDataAction } from '@/app/actions/userActions';
import type { UserProfile } from '@/types/user';
import Fuse from 'fuse.js';
import { useDebounce } from '@/hooks/use-debounce';
import { usePaginatedUsers } from '@/hooks/use-paginated-users';
import { useInView } from 'react-intersection-observer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const VerificationBadgeInline = ({ role, isVerified }: { role: UserProfile['role'], isVerified: UserProfile['isVerified'] }) => {
  if (!role && !isVerified) return null;
  if (role === 'admin') {
    return <div className="ml-1.5 h-4 w-4 text-amber-400 dark:from-amber-500" aria-label="Admin" />;
  }
  if (isVerified) {
    return <div className="ml-1.5 h-4 w-4 text-blue-500 dark:from-blue-200" aria-label="Verified User" />;
  }
  return null;
};

// Add this helper for the Friend tag
function FriendTag() {
  return (
    <span className="ml-2 px-1.5 py-0 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-500 border border-orange-400/30 align-middle select-none leading-tight">
      Friend
    </span>
  );
}

// Helper to group users by first letter
function groupUsersByFirstLetter(users: UserProfile[]) {
  const groups: { [letter: string]: UserProfile[] } = {};
  users.forEach(user => {
    const first = (user.name || user.username || '').charAt(0).toUpperCase();
    if (!groups[first]) groups[first] = [];
    groups[first].push(user);
  });
  return groups;
}

interface UserCardProps {
  user: UserProfile;
  currentUser: any;
  onFollowToggle?: () => void;
  isFollowing?: boolean;
  isLoading?: boolean;
  isFriend?: boolean; // new prop
}

const UserCard = ({ user, currentUser, onFollowToggle, isFollowing, isLoading, isFriend }: UserCardProps) => {
  const { theme } = useTheme();
  
  return (
    <div className="flex items-center space-x-3 p-3 w-full">
      <Avatar className="h-12 w-12">
        <AvatarImage src={user.avatarUrl || ''} alt={user.name || user.username || ''} />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
          {(user.name || user.username)?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1">
          <p className="font-semibold text-sm truncate">{user.name || user.username}</p>
          {isFriend && <FriendTag />}
          <VerificationBadgeInline role={user.role} isVerified={user.isVerified} />
        </div>
        {user.username && user.name && (
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        )}
      </div>
      {onFollowToggle && currentUser && currentUser.uid !== user.uid && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFollowToggle();
          }}
          disabled={isLoading}
          className="shrink-0 rounded-full w-9 h-9 flex items-center justify-center"
          aria-label={isFollowing ? "Unfollow" : "Follow"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isFollowing ? (
            <UserMinus className="h-5 w-5" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
        </Button>
      )}
    </div>
  );
};

const FollowersTabContent = ({ searchTerm = '', sortAsc }: { searchTerm?: string, sortAsc: boolean }) => {
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingMap, setLoadingMap] = useState<{ [uid: string]: boolean }>({});
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const userId = currentUser?.uid;
  if (!userId) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Fetch the full following array for the current user
  useEffect(() => {
    if (!userId || !db) return;
    getDoc(doc(db, 'users', userId as string)).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFollowingSet(new Set(data.following || []));
      } else {
        setFollowingSet(new Set());
      }
    });
  }, [userId]);
  const { users, loading, hasMore, fetchNextPage } = usePaginatedUsers({ userType: 'followers', userId, searchTerm, sortAsc, pageSize: 20 });
  const [ref, inView] = useInView({ triggerOnce: false, threshold: 0 });
  useEffect(() => { if (inView && hasMore && !loading) fetchNextPage(); }, [inView, hasMore, loading, fetchNextPage]);
  const grouped = groupUsersByFirstLetter(users);

  // Centralized follow/unfollow handler
  const handleFollowToggle = useCallback(async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) return;
    setLoadingMap(prev => ({ ...prev, [targetUserId]: true }));
    // Optimistic update
    setFollowingSet(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyFollowing) {
        newSet.delete(targetUserId);
      } else {
        newSet.add(targetUserId);
      }
      return newSet;
    });
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/users/follow-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUserId,
          action: isCurrentlyFollowing ? 'unfollow' : 'follow'
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Unknown error');
      toast({
        title: isCurrentlyFollowing ? 'Unfollowed' : 'Followed',
        description: isCurrentlyFollowing ? 'You unfollowed this user.' : 'You are now following this user.',
        variant: 'default',
      });
    } catch (error: any) {
      // Revert optimistic update
      setFollowingSet(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyFollowing) {
          newSet.add(targetUserId);
        } else {
          newSet.delete(targetUserId);
        }
        return newSet;
      });
      toast({
        title: 'Action Failed',
        description: error?.message || 'Failed to update follow status.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMap(prev => ({ ...prev, [targetUserId]: false }));
    }
  }, [currentUser, toast]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading followers...</p>
      </div>
    );
  }

  if (!loading && users.length === 0 && searchTerm) {
    return (
      <>
        <div className="mb-1">
          <span className="text-xs text-muted-foreground font-medium select-none">
            0 followers
          </span>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-16 w-16" />
          <p className="font-semibold text-lg">No Matches Found</p>
          <p className="text-sm">No followers match your search for "{searchTerm}"</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-1">
        <span className="text-xs text-muted-foreground font-medium select-none">
          {users.length} follower{users.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="w-full">
        {Object.entries(grouped).map(([letter, groupUsers]) => (
          <div key={letter + '-' + (groupUsers[0]?.uid || '')} className="flex w-full items-start gap-2 mt-4 first:mt-0">
            <div className="w-6 flex-shrink-0 text-xs text-muted-foreground font-bold pt-2 text-right select-none">
              {letter}
            </div>
            <div className="flex-1 space-y-3">
              {groupUsers.map(user => {
                const isFollowing = followingSet.has(user.uid);
                const isFriend = isFollowing;
                return (
                  <Link key={user.uid} href={`/users/${user.uid}`} className="block">
                    <UserCard
                      user={user}
                      currentUser={currentUser}
                      onFollowToggle={() => handleFollowToggle(user.uid, isFollowing)}
                      isFollowing={isFollowing}
                      isLoading={!!loadingMap[user.uid]}
                      isFriend={isFriend}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={ref} className="flex justify-center py-4">
            <span className="text-muted-foreground text-xs">{loading ? 'Loading more...' : 'Scroll to load more'}</span>
          </div>
        )}
      </div>
    </>
  );
};

const FollowingTabContent = ({ searchTerm = '', sortAsc }: { searchTerm?: string, sortAsc: boolean }) => {
  const [followersSet, setFollowersSet] = useState<Set<string>>(new Set());
  const [loadingMap, setLoadingMap] = useState<{ [uid: string]: boolean }>({});
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const userId = currentUser?.uid;
  if (!userId) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Fetch the full followers array for the current user
  useEffect(() => {
    if (!userId || !db) return;
    getDoc(doc(db, 'users', userId as string)).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFollowersSet(new Set(data.followers || []));
      } else {
        setFollowersSet(new Set());
      }
    });
  }, [userId]);
  const { users, loading, hasMore, fetchNextPage } = usePaginatedUsers({ userType: 'following', userId, searchTerm, sortAsc, pageSize: 20 });
  const [ref, inView] = useInView({ triggerOnce: false, threshold: 0 });
  useEffect(() => { if (inView && hasMore && !loading) fetchNextPage(); }, [inView, hasMore, loading, fetchNextPage]);
  const grouped = groupUsersByFirstLetter(users);

  // Centralized unfollow handler (always unfollow in following tab)
  const handleUnfollow = useCallback(async (targetUserId: string) => {
    if (!currentUser) return;
    setLoadingMap(prev => ({ ...prev, [targetUserId]: true }));
    // Optimistic update
    // (In following tab, user is always following these users)
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/users/follow-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUserId,
          action: 'unfollow'
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Unknown error');
      setFollowersSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
      toast({
        title: 'Unfollowed',
        description: 'You unfollowed this user.',
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Action Failed',
        description: error?.message || 'Failed to unfollow user.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMap(prev => ({ ...prev, [targetUserId]: false }));
    }
  }, [currentUser, toast]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading following...</p>
      </div>
    );
  }

  if (!loading && users.length === 0 && searchTerm) {
    return (
      <>
        <div className="mb-1">
          <span className="text-xs text-muted-foreground font-medium select-none">
            0 following
          </span>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-16 w-16" />
          <p className="font-semibold text-lg">No Matches Found</p>
          <p className="text-sm">No following users match your search for "{searchTerm}"</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-1">
        <span className="text-xs text-muted-foreground font-medium select-none">
          {users.length} following
        </span>
      </div>
      <div className="w-full">
        {Object.entries(grouped).map(([letter, groupUsers]) => (
          <div key={letter + '-' + (groupUsers[0]?.uid || '')} className="flex w-full items-start gap-2 mt-4 first:mt-0">
            <div className="w-6 flex-shrink-0 text-xs text-muted-foreground font-bold pt-2 text-right select-none">
              {letter}
            </div>
            <div className="flex-1 space-y-3">
              {groupUsers.map(user => {
                const isFriend = followersSet.has(user.uid);
                return (
                  <Link key={user.uid} href={`/users/${user.uid}`} className="block">
                    <UserCard 
                      user={user} 
                      currentUser={currentUser}
                      onFollowToggle={() => handleUnfollow(user.uid)}
                      isFollowing={true}
                      isLoading={!!loadingMap[user.uid]}
                      isFriend={isFriend}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={ref} className="flex justify-center py-4">
            <span className="text-muted-foreground text-xs">{loading ? 'Loading more...' : 'Scroll to load more'}</span>
          </div>
        )}
      </div>
    </>
  );
};

const FriendsTabContent = ({ searchTerm = '', sortAsc }: { searchTerm?: string, sortAsc: boolean }) => {
  const { user: currentUser } = useAuth();
  const userId = currentUser?.uid;
  if (!userId) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const { users, loading, hasMore, fetchNextPage } = usePaginatedUsers({ userType: 'friends', userId, searchTerm, sortAsc, pageSize: 20 });
  const [ref, inView] = useInView({ triggerOnce: false, threshold: 0 });
  useEffect(() => { if (inView && hasMore && !loading) fetchNextPage(); }, [inView, hasMore, loading, fetchNextPage]);
  const grouped = groupUsersByFirstLetter(users);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading friends...</p>
      </div>
    );
  }

  if (!loading && users.length === 0 && searchTerm) {
    return (
      <>
        <div className="mb-1">
          <span className="text-xs text-muted-foreground font-medium select-none">
            0 friends
          </span>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-16 w-16" />
          <p className="font-semibold text-lg">No Matches Found</p>
          <p className="text-sm">No friends match your search for "{searchTerm}"</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-1">
        <span className="text-xs text-muted-foreground font-medium select-none">
          {users.length} friend{users.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="w-full">
        {Object.entries(grouped).map(([letter, groupUsers]) => (
          <div key={letter + '-' + (groupUsers[0]?.uid || '')} className="flex w-full items-start gap-2 mt-4 first:mt-0">
            <div className="w-6 flex-shrink-0 text-xs text-muted-foreground font-bold pt-2 text-right select-none">
              {letter}
            </div>
            <div className="flex-1 space-y-3">
              {groupUsers.map(user => (
                <Link key={user.uid} href={`/users/${user.uid}`} className="block">
                  <UserCard user={user} currentUser={currentUser} isFriend={true} />
                </Link>
              ))}
            </div>
          </div>
        ))}
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={ref} className="flex justify-center py-4">
            <span className="text-muted-foreground text-xs">{loading ? 'Loading more...' : 'Scroll to load more'}</span>
          </div>
        )}
      </div>
    </>
  );
};

const GroupsTabContent = () => {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Users className="mx-auto h-16 w-16" />
      <p className="font-semibold text-lg">Circles Coming Soon</p>
      <p className="text-sm">Circle functionality will be available in a future update</p>
    </div>
  );
};

const FriendsPage = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('followers');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [sortAsc, setSortAsc] = useState(true);
  const handleSortToggle = () => setSortAsc((prev) => !prev);
  
  // Set initial tab based on URL parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['followers', 'following', 'friends', 'groups'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchTerm(''); // Reset search when changing tabs
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className={`mr-2 ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}> 
          My Links
        </h1>
      </div>

      {/* Custom Tab Selector */}
      <div className="flex items-center w-full mb-4">
        {[
          { id: 'followers', label: 'Followers', icon: Users },
          { id: 'following', label: 'Following', icon: UserPlus },
          { id: 'friends', label: 'Friends', icon: Heart },
          { id: 'groups', label: 'Circles', icon: Circle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              className={
                `flex-1 py-2 text-sm font-medium transition-colors relative cursor-pointer flex items-center justify-center gap-2 ` +
                (isActive
                  ? 'text-foreground font-semibold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-amber-400 after:rounded-full'
                  : 'text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground')
              }
              onClick={() => handleTabChange(tab.id)}
              style={{ minWidth: 0 }}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate">{tab.label}</span>
            </div>
          );
        })}
      </div>

      {/* Search Bar below tabs */}
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search users by username..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 rounded-full border border-border/40 bg-input"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className={`rounded-full ${sortAsc ? '' : 'rotate-180'}`}
          aria-label="Sort"
          onClick={handleSortToggle}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Filter" disabled>
          <Filter className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="More options" disabled>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'followers' && (
          <FollowersTabContent searchTerm={debouncedSearchTerm} sortAsc={sortAsc} />
        )}
        {activeTab === 'following' && (
          <FollowingTabContent searchTerm={debouncedSearchTerm} sortAsc={sortAsc} />
        )}
        {activeTab === 'friends' && (
          <FriendsTabContent searchTerm={debouncedSearchTerm} sortAsc={sortAsc} />
        )}
        {activeTab === 'groups' && (
          <GroupsTabContent />
        )}
      </div>
    </div>
  );
};

export default FriendsPage;