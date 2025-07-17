'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useTheme } from 'next-themes';
import { ChevronLeft, Loader2, UserPlus, UserMinus, EyeOff, Users, UserCheck, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { followUserAction, unfollowUserAction, fetchPublicUserProfileDataAction } from '@/app/actions/userActions';
import type { UserProfile } from '@/types/user';

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

interface UserCardProps {
  user: UserProfile;
  currentUser: any;
  onFollowToggle?: () => void;
  isFollowing?: boolean;
  isLoading?: boolean;
}

const UserCard = ({ user, currentUser, onFollowToggle, isFollowing, isLoading }: UserCardProps) => {
  const { theme } = useTheme();
  
  return (
    <div className="flex items-center space-x-3 p-3 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
      <Avatar className="h-12">
        <AvatarImage src={user.avatarUrl || ''} alt={user.name || user.username || ''} />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
          {(user.name || user.username)?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1">
          <p className="font-semibold text-sm truncate">{user.name || user.username}</p>
          <VerificationBadgeInline role={user.role} isVerified={user.isVerified} />
        </div>
        {user.username && user.name && (
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        )}
      </div>
      {onFollowToggle && currentUser && currentUser.uid !== user.uid && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          onClick={onFollowToggle}
          disabled={isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus className="h-4 w-4 mr-1" />
              Unfollow
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-1" />            Follow
            </>
          )}
        </Button>
      )}
    </div>
  );
};

const FollowersTabContent = ({ searchTerm = '' }: { searchTerm?: string }) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || currentUser?.uid;

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/followers?userId=${userId}`, {
          headers: currentUser ? {
            Authorization: `Bearer ${await currentUser.getIdToken()}`
          } : {}
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setFollowers(data.followers || []);
        } else {
          setError(data.error || 'Failed to load followers');
        }
      } catch (err: any) {
        setError('An error occurred while loading followers');
        console.error('Error fetching followers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [userId, currentUser]);

  const handleFollowToggle = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) return;
    
    try {
      const idToken = await currentUser.getIdToken();
      const actionToCall = isCurrentlyFollowing ? unfollowUserAction : followUserAction;
      const actionResult = await actionToCall(targetUserId, idToken);
      
      if (actionResult.success) {
        toast({ title: actionResult.message || (isCurrentlyFollowing ? "Unfollowed successfully" : "Followed successfully") });
        // Refresh the list
        const refreshResponse = await fetch(`/api/users/followers?userId=${userId}`, {
          headers: {
            Authorization: `Bearer ${await currentUser.getIdToken()}`
          }
        });
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok) {
          setFollowers(refreshData.followers || []);
        }
      } else {
        toast({ title: "Error", description: actionResult.error || "Action failed.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading followers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">Followers Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">No Followers</p>
        <p className="text-sm">No followers to display</p>
      </div>
    );
  }

  // Filter followers based on search term
  const filteredFollowers = followers.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.name?.toLowerCase() || '').includes(searchLower) ||
      (user.username?.toLowerCase() || '').includes(searchLower)
    );
  });

  // If we have followers but none match the search
  if (followers.length > 0 && filteredFollowers.length === 0 && searchTerm) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">No Matches Found</p>
        <p className="text-sm">No followers match your search for "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      {filteredFollowers.map((user) => (
        <Link key={user.uid} href={`/users/${user.uid}`} className="block">
          <UserCard 
            user={user} 
            currentUser={currentUser}
            onFollowToggle={() => handleFollowToggle(user.uid, false)}
            isFollowing={false}
          />
        </Link>
      ))}
    </div>
  );
};

const FollowingTabContent = ({ searchTerm = '' }: { searchTerm?: string }) => {
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || currentUser?.uid;

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/following?userId=${userId}`, {
          headers: currentUser ? {
            Authorization: `Bearer ${await currentUser.getIdToken()}`
          } : {}
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setFollowing(data.following || []);
        } else {
          setError(data.error || 'Failed to load following');
        }
      } catch (err: any) {
        setError('An error occurred while loading following');
        console.error('Error fetching following:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [userId, currentUser]);

  const handleFollowToggle = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) return;
    
    try {
      const idToken = await currentUser.getIdToken();
      const actionToCall = isCurrentlyFollowing ? unfollowUserAction : followUserAction;
      const actionResult = await actionToCall(targetUserId, idToken);
      
      if (actionResult.success) {
        toast({ title: actionResult.message || (isCurrentlyFollowing ? "Unfollowed successfully" : "Followed successfully") });
        // Refresh the list
        const refreshResponse = await fetch(`/api/users/following?userId=${userId}`, {
          headers: {
            Authorization: `Bearer ${await currentUser.getIdToken()}`
          }
        });
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok) {
          setFollowing(refreshData.following || []);
        }
      } else {
        toast({ title: "Error", description: actionResult.error || "Action failed.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading following...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">Following Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UserPlus className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">Not Following Anyone</p>
        <p className="text-sm">Discover and follow interesting people!</p>
      </div>
    );
  }

  // Filter following based on search term
  const filteredFollowing = following.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.name?.toLowerCase() || '').includes(searchLower) ||
      (user.username?.toLowerCase() || '').includes(searchLower)
    );
  });

  // If we have following but none match the search
  if (following.length > 0 && filteredFollowing.length === 0 && searchTerm) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">No Matches Found</p>
        <p className="text-sm">No following users match your search for "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      {filteredFollowing.map((user) => (
        <Link key={user.uid} href={`/users/${user.uid}`} className="block">
          <UserCard 
            user={user} 
            currentUser={currentUser}
            onFollowToggle={() => handleFollowToggle(user.uid, true)}
            isFollowing={true}
          />
        </Link>
      ))}
    </div>
  );
};

const FriendsTabContent = ({ searchTerm = '' }: { searchTerm?: string }) => {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || currentUser?.uid;

  useEffect(() => {
    const fetchFriends = async () => {
      if (!userId || !currentUser) return;
      try {
        setLoading(true);
        setError(null);
        // Use the action to get the profile and mutual friends
        const profileResult = await fetchPublicUserProfileDataAction(userId, await currentUser.getIdToken());
        if (profileResult.error || !profileResult.userProfile) {
          throw new Error(profileResult.error || 'User profile not found');
        }
        const userProfile = profileResult.userProfile;
        const following = userProfile.following || [];
        const followers = userProfile.followers || [];
        const mutualFriendIds = following.filter((id: string) => followers.includes(id));
        if (mutualFriendIds.length === 0) {
          setFriends([]);
          return;
        }
        // Fetch friend profiles using the action
        const friendProfiles = await Promise.all(
          mutualFriendIds.map(async (friendId: string) => {
            try {
              const friendResult = await fetchPublicUserProfileDataAction(friendId, await currentUser.getIdToken());
              return friendResult.userProfile;
            } catch (error) {
              console.error(`Error fetching friend profile for ${friendId}:`, error);
              return null;
            }
          })
        );
        setFriends(friendProfiles.filter((profile): profile is UserProfile => Boolean(profile)));
      } catch (err: any) {
        setError('An error occurred while loading friends');
        console.error('Error fetching friends:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading friends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">Friends Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UserCheck className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">No Friends Yet</p>
        <p className="text-sm">Start following people to build your network!</p>
      </div>
    );
  }

  // Filter friends based on search term
  const filteredFriends = friends.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.name?.toLowerCase() || '').includes(searchLower) ||
      (user.username?.toLowerCase() || '').includes(searchLower)
    );
  });

  // If we have friends but none match the search
  if (friends.length > 0 && filteredFriends.length === 0 && searchTerm) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-16 w-16" />
        <p className="font-semibold text-lg">No Matches Found</p>
        <p className="text-sm">No friends match your search for "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      {filteredFriends.map((user) => (
        <Link key={user.uid} href={`/users/${user.uid}`} className="block">
          <UserCard user={user} currentUser={currentUser} />
        </Link>
      ))}
    </div>
  );
};

const GroupsTabContent = () => {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Users className="mx-auto h-16 w-16" />
      <p className="font-semibold text-lg">Groups Coming Soon</p>
      <p className="text-sm">Group functionality will be available in a future update</p>
    </div>
  );
};

const FriendsPage = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('followers');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
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
          Connections
        </h1>
      </div>
      
      <div className="mb-6 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              type="text"
              placeholder="Search users by username..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </div>

      <Tabs 
        defaultValue={activeTab} 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="followers">Followers</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        
        <TabsContent value="followers" className="mt-6">
          <FollowersTabContent searchTerm={searchTerm} />
        </TabsContent>
        
        <TabsContent value="following" className="mt-6">
          <FollowingTabContent searchTerm={searchTerm} />
        </TabsContent>
        
        <TabsContent value="friends" className="mt-6">
          <FriendsTabContent searchTerm={searchTerm} />
        </TabsContent>
        
        <TabsContent value="groups" className="mt-6">
          <GroupsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FriendsPage;