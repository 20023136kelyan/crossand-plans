'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Edit3, MessageSquare, ShieldCheck as AdminIcon, CheckCircle, Settings,
  UserPlus, XCircle as XIcon, Check, MoreVertical, Camera, ChevronLeft, Users as UsersIconIcon,
  RotateCcw, EyeOff, Phone, Video, LayoutGrid, Calendar, Users, Eye, Upload, UserMinus, Instagram, X
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  fetchPublicUserProfileDataAction,
  followUserAction,
  unfollowUserAction,
  sendFriendRequestAction,
  acceptFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  updateUserAvatarAction,
} from '@/app/actions/userActions';
import { initiateDirectChatAction } from '@/app/actions/chatActions';
import type { UserProfile, FeedPost, UserStats, FriendStatus, UserRoleType, FriendEntry } from "@/types/user";
import { cn, commonImageExtensions } from "@/lib/utils";
import { FileValidators } from '@/lib/fileValidation';
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getFriendships } from '@/services/clientServices';
import type { User } from 'firebase/auth';

const VerificationBadgeInline = ({ role, isVerified }: { role: UserProfile['role'], isVerified: UserProfile['isVerified'] }) => {
  if (!role && !isVerified) return null;
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-5 w-5 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-5 w-5 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified User" />;
  }
  return null;
};

// Tab Content Components
interface TabContentProps {
  profileId: string;
  isOwnProfile: boolean;
  currentUser: User | null;
}

const PlansTabContent = ({ profileId, isOwnProfile, currentUser }: TabContentProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/plans?userId=${profileId}`, {
          headers: currentUser ? {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          } : {}
        });
        
        const result = await response.json();
        
        if (response.ok) {
          setPlans(result.plans || []);
        } else {
          setError(result.error || 'Failed to load plans');
        }
      } catch (err: any) {
        setError('An error occurred while loading plans');
        console.error('Error fetching plans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [profileId, currentUser]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading plans...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">Plans Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">No Plans Yet</p>
        <p className="text-sm">{isOwnProfile ? 'Create your first plan!' : 'No plans to display'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      {plans.map((plan) => (
        <div key={plan.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-lg mb-2">{plan.name}</h3>
          {plan.description && (
            <p className="text-muted-foreground text-sm mb-2">{plan.description}</p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created {new Date(plan.createdAt).toLocaleDateString()}</span>
            <span className="text-primary">{plan.participantCount || 0} participants</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const FollowersTabContent = ({ profileId, isOwnProfile, currentUser }: TabContentProps) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/followers?userId=${profileId}`, {
          headers: currentUser ? {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          } : {}
        });
        
        const result = await response.json();
        
        if (response.ok) {
          setFollowers(result.followers || []);
        } else {
          setError(result.error || 'Failed to load followers');
        }
      } catch (err: any) {
        setError('An error occurred while loading followers');
        console.error('Error fetching followers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [profileId, currentUser]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading followers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">Followers Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">No Followers Yet</p>
        <p className="text-sm">{isOwnProfile ? 'Share your profile to gain followers!' : 'No followers to display'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      {followers.map((follower) => (
        <Link key={follower.uid} href={`/users/${follower.uid}`} className="block">
          <div className="flex items-center space-x-3 p-3 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
            <Avatar className="h-12 w-12">
              <AvatarImage src={follower.avatarUrl || ''} alt={follower.name || follower.username || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                {(follower.name || follower.username)?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                <p className="font-semibold text-sm truncate">{follower.name || follower.username}</p>
                <VerificationBadgeInline role={follower.role} isVerified={follower.isVerified} />
              </div>
              {follower.username && follower.name && (
                <p className="text-xs text-muted-foreground truncate">@{follower.username}</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

const FollowingTabContent = ({ profileId, isOwnProfile, currentUser }: TabContentProps) => {
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/following?userId=${profileId}`, {
          headers: currentUser ? {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          } : {}
        });
        
        const result = await response.json();
        
        if (response.ok) {
          setFollowing(result.following || []);
        } else {
          setError(result.error || 'Failed to load following');
        }
      } catch (err: any) {
        setError('An error occurred while loading following');
        console.error('Error fetching following:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [profileId, currentUser]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading following...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">Following Not Available</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UserPlus className="mx-auto h-16 w-16 opacity-30 mb-3" />
        <p className="font-semibold text-lg">Not Following Anyone</p>
        <p className="text-sm">{isOwnProfile ? 'Discover and follow interesting people!' : 'Not following anyone yet'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      {following.map((user) => (
        <Link key={user.uid} href={`/users/${user.uid}`} className="block">
          <div className="flex items-center space-x-3 p-3 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatarUrl || ''} alt={user.name || user.username || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
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
          </div>
        </Link>
      ))}
    </div>
  );
};

interface ProfilePageData {
  userProfile: UserProfile | null;
  userPosts: FeedPost[];
  userStats: UserStats | null;
  isViewerFollowing?: boolean | null;
  friendshipStatusWithViewer?: FriendStatus | 'not_friends' | 'is_self' | null;
}

interface RawBasicUserInfo {
  uid: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRoleType;
  isVerified: boolean;
}

// Canvas preview helper function (ensure this is robust)
async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  fileName: string = 'cropped_avatar.png'
): Promise<File | null> {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('Failed to get 2D context from canvas');
    return null;
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Use completedCrop for pixel dimensions directly
  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  // Set canvas to desired output size (e.g., 256x256 for avatar)
  // For simplicity, we'll use the crop dimensions, but you might want to scale to a fixed output.
  const outputWidth = crop.width;
  const outputHeight = crop.height;

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas to Blob conversion failed');
        reject(new Error('Canvas to Blob conversion failed'));
        return;
      }
      resolve(new File([blob], fileName, { type: blob.type || 'image/png' }));
    }, 'image/png', 0.92); // Adjust quality if needed
  });
}


export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, currentUserProfile: authenticatedUserProfile, loading: authLoading, refreshProfileStatus } = useAuth();
  const { toast } = useToast();
  
  const profileId = params.profileId as string;

  const [profileData, setProfileData] = useState<ProfilePageData>({
    userProfile: null,
    userPosts: [],
    userStats: null,
    isViewerFollowing: null,
    friendshipStatusWithViewer: null
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [friendshipStatusWithViewer, setFriendshipStatusWithViewer] = useState<FriendStatus | 'not_friends' | 'is_self' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [followActionLoading, setFollowActionLoading] = useState(false);
  const [isInitiatingChat, setIsInitiatingChat] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isProfilePictureModalOpen, setIsProfilePictureModalOpen] = useState(false);

  const [imageSrcForCropper, setImageSrcForCropper] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
  const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const [unsubFriendships, setUnsubFriendships] = useState<(() => void) | null>(null);

  const fetchProfileData = useCallback(async () => {
    console.log('[UserProfilePage] fetchProfileData called for profileId:', profileId, 'Current user:', currentUser?.uid);
    if (!profileId) {
      setLoadingProfile(false);
      toast({ title: "Error", description: "Profile ID missing.", variant: "destructive" });
      setProfileData({
        userProfile: null,
        userPosts: [],
        userStats: null,
        isViewerFollowing: null,
        friendshipStatusWithViewer: null
      });
      return;
    }

    try {
      const result = await fetchPublicUserProfileDataAction(profileId, currentUser?.uid || null);

      if (result.error || !result.userProfile) {
        toast({ title: "Profile Not Found", description: result.error || "This user's profile could not be loaded.", variant: "destructive" });
        setProfileData({
          userProfile: null,
          userPosts: [],
          userStats: null,
          isViewerFollowing: null,
          friendshipStatusWithViewer: null
        });
      } else {
        setProfileData(result);
        setIsFollowing(result.isViewerFollowing === undefined ? null : result.isViewerFollowing);
        setFriendshipStatusWithViewer(result.friendshipStatusWithViewer === undefined ? 'not_friends' : result.friendshipStatusWithViewer);
      }
    } catch (error: any) {
      console.error("[UserProfilePage] Error in fetchProfileData:", error);
      toast({ title: "Error Loading Profile", description: error.message || "Could not load profile.", variant: "destructive" });
      setProfileData({
        userProfile: null,
        userPosts: [],
        userStats: null,
        isViewerFollowing: null,
        friendshipStatusWithViewer: null
      });
    } finally {
      setLoadingProfile(false);
    }
  }, [profileId, currentUser?.uid, toast]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (currentUser?.uid && profileId) {
      // Set up real-time listener for friendships
      const unsubscribe = getFriendships(
        currentUser.uid,
        (friendships: FriendEntry[]) => {
          const friendEntry = friendships.find(f => f.friendUid === profileId);
          setFriendshipStatusWithViewer(friendEntry ? friendEntry.status : 'not_friends');
        },
        (error: Error) => {
          console.error("Error in friendships listener:", error);
          toast({ title: "Error", description: "Could not update friendship status.", variant: "destructive" });
        }
      );
      setUnsubFriendships(() => unsubscribe);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [currentUser?.uid, profileId, toast]);

  const userProfile = profileData.userProfile;
  const userStats = profileData.userStats;
  const isOwnProfile = currentUser?.uid === userProfile?.uid;

  const userPostsArray = useMemo(() => {
    if (profileData && Array.isArray(profileData.userPosts)) {
      return profileData.userPosts;
    }
    return [];
  }, [profileData]);

  const handleFollowToggle = useCallback(async () => {
    if (!currentUser || !userProfile || isOwnProfile || isFollowing === null) {
      toast({ title: "Action Failed", description: "Cannot perform follow/unfollow action.", variant: "destructive"});
      return;
    }
    setFollowActionLoading(true);
    const originalIsFollowing = isFollowing;
    
    // Optimistic UI update
    setIsFollowing(!originalIsFollowing);
    
    // Update local counts optimistically
    setProfileData(prev => {
      if (!prev || !prev.userProfile || !prev.userStats) return prev;
      const currentFollowers = prev.userStats.followersCount || 0;
      return {
        ...prev,
        userStats: {
          ...prev.userStats,
          followersCount: !originalIsFollowing ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
        }
      };
    });

    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) throw new Error("Authentication token not available.");

      const actionToCall = originalIsFollowing ? unfollowUserAction : followUserAction;
      const result = await actionToCall(userProfile.uid, idToken);

      if (result.success) {
        toast({ title: result.message || (originalIsFollowing ? "Unfollowed successfully" : "Followed successfully") });
        // Re-fetch to get authoritative data, this will also update friendshipStatus
        await fetchProfileData(); 
      } else {
        // Revert optimistic updates
        setIsFollowing(originalIsFollowing);
        setProfileData(prev => {
          if (!prev || !prev.userProfile || !prev.userStats) return prev;
          const currentFollowers = prev.userStats.followersCount || 0;
          return {
            ...prev,
            userStats: {
              ...prev.userStats,
              followersCount: originalIsFollowing ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
            }
          };
        });
        toast({ title: "Error", description: result.error || "Action failed.", variant: "destructive" });
      }
    } catch (error: any) {
      // Revert optimistic updates
      setIsFollowing(originalIsFollowing);
      setProfileData(prev => {
        if (!prev || !prev.userProfile || !prev.userStats) return prev;
        const currentFollowers = prev.userStats.followersCount || 0;
        return {
          ...prev,
          userStats: {
            ...prev.userStats,
            followersCount: originalIsFollowing ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
          }
        };
      });
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    } finally {
      setFollowActionLoading(false);
    }
  }, [currentUser, userProfile, isOwnProfile, isFollowing, toast, fetchProfileData]);

  const handleFriendRequestButtonAction = useCallback(async (actionType: 'accept' | 'decline' | 'cancel' | 'send' | 'remove') => {
    if (!currentUser || !profileData.userProfile || isOwnProfile) {
      toast({ title: "Action Failed", description: "User data missing or not logged in.", variant: "destructive" });
      if (!currentUser) router.push('/login');
      return;
    }
    setActionLoading(true);
    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        toast({ title: "Auth Error", description: "Could not get authentication token.", variant: "destructive" });
        setActionLoading(false);
        return;
      }

      let result: { success: boolean; error?: string; message?: string };

      switch (actionType) {
        case 'send':
          result = await sendFriendRequestAction(profileData.userProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatusWithViewer('pending_sent');
            setIsFollowing(true);
          }
          break;
        case 'accept':
          result = await acceptFriendRequestAction(profileData.userProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatusWithViewer('friends');
            setIsFollowing(true);
          }
          break;
        case 'decline':
        case 'cancel':
          result = await declineFriendRequestAction(profileData.userProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatusWithViewer('not_friends');
          }
          break;
        case 'remove':
          result = await removeFriendAction(profileData.userProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatusWithViewer('not_friends');
            setIsFollowing(false);
          }
          break;
        default:
          setActionLoading(false);
          return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || `Action successful.` });
        // Update local counts optimistically
        if (actionType === 'send' || actionType === 'accept') {
          setProfileData(prev => ({
            ...prev,
            userStats: prev.userStats ? {
              ...prev.userStats,
              followersCount: (prev.userStats.followersCount || 0) + 1
            } : null
          }));
        } else if (actionType === 'remove') {
          setProfileData(prev => ({
            ...prev,
            userStats: prev.userStats ? {
              ...prev.userStats,
              followersCount: Math.max(0, (prev.userStats.followersCount || 0) - 1)
            } : null
          }));
        }
      } else {
        toast({ title: "Error", description: result.error || "Could not complete action.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [currentUser, profileData.userProfile, isOwnProfile, toast, router]);

  const handleInitiateChat = useCallback(async () => {
    if (!currentUser || !authenticatedUserProfile || !userProfile || isOwnProfile) {
      toast({ title: "Action Failed", description: "Cannot start chat. User data missing or not logged in.", variant: "destructive" });
      if (!currentUser) router.push('/login');
      return;
    }
    setIsInitiatingChat(true);
    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) throw new Error("Authentication token not available for chat.");

      const chatUserInfo: RawBasicUserInfo = {
        uid: userProfile.uid,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        role: userProfile.role || 'user',
        isVerified: userProfile.isVerified
      };

      const currentUserInfo: RawBasicUserInfo = {
        uid: currentUser.uid,
        name: authenticatedUserProfile.name,
        avatarUrl: authenticatedUserProfile.avatarUrl,
        role: authenticatedUserProfile.role || 'user',
        isVerified: authenticatedUserProfile.isVerified
      };

      const result = await initiateDirectChatAction(chatUserInfo, currentUserInfo);

      if (result.success && result.chatId) {
        router.push(`/messages/${result.chatId}`);
      } else {
        toast({ title: "Chat Error", description: result.error || "Could not start chat.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Chat Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsInitiatingChat(false);
    }
  }, [currentUser, authenticatedUserProfile, userProfile, isOwnProfile, router, toast]);

  const handleAvatarFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      // Use centralized validation
      const validation = FileValidators.avatar(file);
      if (!validation.valid) {
        toast({ title: "File Validation Error", description: validation.error, variant: "destructive" });
        if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
        return;
      }
      
      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('Avatar file validation warnings:', validation.warnings);
      }
      
      // Validation passed, proceed with file selection

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrcForCropper(reader.result?.toString() || null);
        setCrop(undefined); 
        setCompletedCrop(null);
        setIsCropperModalOpen(true);
      });
      reader.readAsDataURL(file);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = ""; 
    }
  };

  const onImageLoadInCropper = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { width, height } = img;
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1 / 1, width, height), width, height));
  }, []);

  const handleCropAndSaveFromModal = async () => {
    if (!imageSrcForCropper || !completedCrop || !imgRef.current) {
      toast({ title: "Crop Error", description: "Please select and crop an area.", variant: "destructive" });
      return;
    }
    try {
      const originalFileName = `macaroom_avatar_${Date.now()}.png`; 
      const croppedFileResult = await canvasPreview(imgRef.current, document.createElement('canvas'), completedCrop, originalFileName);
      
      if (croppedFileResult) {
        setCroppedImageFile(croppedFileResult);
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl); 
        setAvatarPreviewUrl(URL.createObjectURL(croppedFileResult));
      } else {
        toast({ title: "Crop Failed", description: "Could not process the cropped image.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Crop Error", description: e.message || "An unexpected error occurred during cropping.", variant: "destructive" });
    }
    setIsCropperModalOpen(false);
    setImageSrcForCropper(null); 
  };

  const handleCancelCropModal = () => {
    setIsCropperModalOpen(false);
    setImageSrcForCropper(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setCurrentImage(null);
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
  };

  const handleReportUser = async () => {
    if (!currentUser || !userProfile || isOwnProfile) {
      return;
    }
    
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/reports/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: userProfile.uid,
          reason: 'inappropriate_behavior',
          description: 'Reported from user profile'
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({ title: "User Reported", description: "Thank you for your report. We'll review it shortly." });
      } else {
        toast({ title: "Report Failed", description: result.error || "Could not report user", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Report Error", description: "An error occurred while reporting the user", variant: "destructive" });
      console.error('Error reporting user:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!currentUser || !userProfile || isOwnProfile) {
      return;
    }
    
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: userProfile.uid
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({ title: "User Blocked", description: "You have successfully blocked this user." });
        // Optionally redirect or update UI
        router.back();
      } else {
        toast({ title: "Block Failed", description: result.error || "Could not block user", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Block Error", description: "An error occurred while blocking the user", variant: "destructive" });
      console.error('Error blocking user:', error);
    }
  };

  const handleSaveAvatarToServer = async () => {
    if (!croppedImageFile || !currentUser) {
      toast({ title: "Save Error", description: "No cropped image to save or user not authenticated.", variant: "destructive" });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) throw new Error("Authentication token not available for avatar upload.");

      const formData = new FormData();
      formData.append('avatarImage', croppedImageFile);

      const result = await updateUserAvatarAction(formData, idToken);
      if (result.success && result.newAvatarUrl) {
        toast({ title: "Avatar Updated!" });

        // Optimistic update for the current page's display if it's the user's own profile
        if (isOwnProfile && profileData.userProfile) {
          setProfileData((prev: ProfilePageData) => {
            if (!prev || !prev.userProfile) return prev;
            return {
              ...prev,
              userProfile: {
                ...prev.userProfile,
                avatarUrl: result.newAvatarUrl || null
              }
            };
          });
        }

        // Refresh global AuthContext state
        await refreshProfileStatus(); 
        
        // Re-fetch full profile data for the page for consistency
        await fetchProfileData();

        handleCancelAvatarChangeOnProfile(); // Clear local preview states
      } else {
        toast({ title: "Avatar Update Failed", description: result.error || "Could not update avatar.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update avatar.", variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCancelAvatarChangeOnProfile = () => {
    setCroppedImageFile(null);
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(null);
    setImageSrcForCropper(null); 
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
  };

  const selectedPost = useMemo(() => {
    if (selectedPostIndex !== null && userPostsArray && userPostsArray[selectedPostIndex]) {
      return userPostsArray[selectedPostIndex];
    }
    return null;
  }, [selectedPostIndex, userPostsArray]);

  const openPostModal = (index: number) => { setSelectedPostIndex(index); setIsPostModalOpen(true); };
  const closePostModal = () => { setIsPostModalOpen(false); setSelectedPostIndex(null); };
  const handleNextPostInModal = () => { if (userPostsArray && selectedPostIndex !== null && selectedPostIndex < userPostsArray.length - 1) setSelectedPostIndex(selectedPostIndex + 1); };
  const handlePreviousPostInModal = () => { if (selectedPostIndex !== null && selectedPostIndex > 0) setSelectedPostIndex(selectedPostIndex - 1); };

  if (loadingProfile || (authLoading && !profileData.userProfile)) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center p-6 bg-background text-foreground">
        <UsersIconIcon className="h-20 w-20 text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-semibold mb-2">User Not Found</h1>
        <p className="text-muted-foreground">The profile you are looking for does not exist or could not be loaded.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/explore">Go to Explore</Link>
        </Button>
      </div>
    );
  }
  
  const userInitial = userProfile.name ? userProfile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (userProfile.email ? userProfile.email[0].toUpperCase() : 'U');

  return (
    <div className="min-h-screen bg-background text-foreground">
         <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground" aria-label="Go back">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1"></div>
        </header>

        {/* Sleek Mobile Profile Header */}
        <div className="relative bg-gradient-to-br from-gray-900 via-black/90 to-black text-white rounded-b-3xl md:rounded-t-3xl">


          <div className="flex flex-col items-center justify-center px-6 pt-20 pb-12">
            {/* Large Profile Picture */}
            <div className="relative mb-6">
              <button 
                onClick={() => setIsProfilePictureModalOpen(true)}
                className="group relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-full"
              >
                {isOwnProfile && avatarPreviewUrl ? (
                  <Avatar className="h-32 w-32 border-4 border-white/20 shadow-2xl group-hover:shadow-blue-500/25 transition-all duration-300 group-hover:scale-105">
                    <AvatarImage src={avatarPreviewUrl} alt={userProfile.name || userProfile.username || ''} />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {(userProfile.name || userProfile.username)?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-32 w-32 border-4 border-white/20 shadow-2xl group-hover:shadow-blue-500/25 transition-all duration-300 group-hover:scale-105">
                    <AvatarImage src={userProfile.avatarUrl || ''} alt={userProfile.name || userProfile.username || ''} />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {(userProfile.name || userProfile.username)?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </button>
              
              {/* Verification badge */}
              <div className="absolute bottom-2 right-2">
                {userProfile.role === 'admin' && (
                  <AdminIcon className="h-6 w-6 text-amber-400 fill-amber-500 shrink-0 drop-shadow-lg" aria-label="Admin" />
                )}
                {userProfile.role !== 'admin' && userProfile.isVerified && (
                  <CheckCircle className="h-6 w-6 text-blue-500 fill-blue-200 shrink-0 drop-shadow-lg" aria-label="Verified" />
                )}
              </div>
              
              <input type="file" accept="image/png, image/jpeg, image/gif, image/webp, image/*" ref={avatarFileInputRef} onChange={handleAvatarFileSelect} className="hidden" />
            </div>
            
            {/* Name and Username */}
            <div className="text-center mb-4">
              <h1 className="text-base font-bold text-white mb-1">
                {userProfile.name || userProfile.username}
              </h1>
              <p className="text-gray-400 text-base">
                {userProfile.bio || 'No bio available'}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 mb-6 text-center">
              <div>
                <span className="text-white font-semibold text-lg">{userStats?.followersCount || 0}</span>
                <span className="text-gray-400 ml-1">Followers</span>
              </div>
              <div className="w-px h-8 bg-gray-600/30"></div>
              <div>
                <span className="text-white font-semibold text-lg">{userStats?.postCount || 0}</span>
                <span className="text-gray-400 ml-1">Posts</span>
              </div>
              <div className="w-px h-8 bg-gray-600/30"></div>
              <div>
                <span className="text-green-400 font-semibold text-lg">{userStats?.plansCreatedCount || 0}</span>
                <span className="text-gray-400 ml-1">Plans</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-xs">
              {isOwnProfile ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200"
                    onClick={() => router.push('/users/settings')}
                  >
                    Edit Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-10 h-10 p-0 bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200"
                    onClick={() => router.push('/users/settings')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {/* Friend Request Button */}
                  {friendshipStatusWithViewer === 'not_friends' && (
                    <Button 
                      variant="default" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleFriendRequestButtonAction('send')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Add Friend
                    </Button>
                  )}
                  {friendshipStatusWithViewer === 'pending_sent' && (
                    <Button 
                      variant="outline" 
                      className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                      onClick={() => handleFriendRequestButtonAction('cancel')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Cancel Request
                    </Button>
                  )}
                  {friendshipStatusWithViewer === 'pending_received' && (
                    <>
                      <Button 
                        variant="default" 
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleFriendRequestButtonAction('accept')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                        onClick={() => handleFriendRequestButtonAction('decline')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Decline
                      </Button>
                    </>
                  )}
                  {friendshipStatusWithViewer === 'friends' && (
                    <Button 
                      variant="outline" 
                      className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                      onClick={() => handleFriendRequestButtonAction('remove')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <UserMinus className="h-4 w-4 mr-2" />
                      )}
                      Remove Friend
                    </Button>
                  )}
                  
                  {/* Message Button */}
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={handleInitiateChat}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-2" />
                    )}
                    Message
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="bg-background rounded-t-[3rem] -mt-8 relative z-10 pt-4">
          {/* Tabs Section */}
          <div className="px-0">
            <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-16 bg-transparent p-0">
              <TabsTrigger 
                value="posts" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="text-sm font-medium">Posts</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Plans</span>
              </TabsTrigger>
              <TabsTrigger 
                value="followers" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Followers</span>
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-sm font-medium">Following</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Posts Tab Content */}
            <TabsContent value="posts" className="mt-6 p-0">
              {userPostsArray.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Camera className="mx-auto h-16 w-16 opacity-30 mb-3" />
                  <p className="font-semibold text-lg">No Posts Yet</p>
                  {isOwnProfile && <p className="text-sm">Share your first plan highlight!</p>}
                </div>
              ) : (
                <div className="columns-3 gap-0.5 sm:gap-1 px-0 pb-4 space-y-0.5 sm:space-y-1">
                  {userPostsArray.map((post, index) => (
                    <button 
                      key={post.id} 
                      onClick={() => openPostModal(index)}
                      className="relative bg-muted overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-sm w-full break-inside-avoid mb-0.5 sm:mb-1 block"
                      aria-label={`View post: ${post.text?.substring(0,30) || 'Image post'}`}
                    >
                      {post.mediaUrl ? (
                        <Image
                          src={post.mediaUrl}
                          alt={post.text || `Post by ${userProfile.name}`}
                          width={250}
                          height={250}
                          style={{ 
                            width: '100%', 
                            height: 'auto',
                            objectFit: 'cover'
                          }}
                          className="group-hover:opacity-80 transition-opacity w-full h-auto"
                          data-ai-hint="user generated content"
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, 250px"
                          unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                        />
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center text-xs text-muted-foreground p-1">No Image</div>
                      )}
                    </button>
                  ))}
                 </div>
               )}
             </TabsContent>
             
             {/* Plans Tab Content */}
             <TabsContent value="plans" className="mt-6 p-0">
               <PlansTabContent profileId={userProfile.uid} isOwnProfile={isOwnProfile} currentUser={currentUser} />
             </TabsContent>
             
             {/* Followers Tab Content */}
             <TabsContent value="followers" className="mt-6 p-0">
               <FollowersTabContent profileId={userProfile.uid} isOwnProfile={isOwnProfile} currentUser={currentUser} />
             </TabsContent>
             
             {/* Following Tab Content */}
             <TabsContent value="following" className="mt-6 p-0">
               <FollowingTabContent profileId={userProfile.uid} isOwnProfile={isOwnProfile} currentUser={currentUser} />
             </TabsContent>
           </Tabs>
         </div>
        </div>

        {/* Hidden file input for avatar upload */}
        <input type="file" accept="image/png, image/jpeg, image/gif, image/webp, image/*" ref={avatarFileInputRef} onChange={handleAvatarFileSelect} className="hidden" />
        
        {/* Avatar Save Controls */}
        {avatarPreviewUrl && isOwnProfile && (
          <div className="px-6 pb-6">
            <div className="flex gap-3 mt-6">
              <Button 
                 onClick={handleSaveAvatarToServer} 
                 disabled={isUploadingAvatar} 
                 className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-medium transition-all duration-200"
               >
                 {isUploadingAvatar ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Save Avatar"}
               </Button>
               <Button 
                 variant="outline" 
                 onClick={handleCancelAvatarChangeOnProfile} 
                 disabled={isUploadingAvatar} 
                 className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 rounded-xl py-3 font-medium transition-all duration-200"
               >
                 Cancel
               </Button>
             </div>
           </div>
         )}



        {/* Modals */}
        {selectedPost && isPostModalOpen && userProfile && selectedPostIndex !== null && (
        <PostDetailModal
          post={selectedPost}
          authorProfile={userProfile} // Pass the fetched userProfile of the profile being viewed
          isOpen={isPostModalOpen}
          onClose={closePostModal}
          onNext={userPostsArray && selectedPostIndex !== null && selectedPostIndex < userPostsArray.length - 1 ? handleNextPostInModal : undefined}
          onPrevious={selectedPostIndex !== null && selectedPostIndex > 0 ? handlePreviousPostInModal : undefined}
          hasNext={userPostsArray && selectedPostIndex !== null && selectedPostIndex < userPostsArray.length - 1}
          hasPrevious={selectedPostIndex !== null && selectedPostIndex > 0}
        />
      )}

      {/* Profile Picture Modal */}
      <Dialog open={isProfilePictureModalOpen} onOpenChange={setIsProfilePictureModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Profile Picture</DialogTitle>
            <DialogDescription>
              {isOwnProfile ? "View or change your profile picture" : `View ${userProfile?.name || userProfile?.username}'s profile picture`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-32 w-32 border-2 border-border/20 shadow-lg">
              <AvatarImage src={userProfile?.avatarUrl || ''} alt={userProfile?.name || userProfile?.username || ''} />
              <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                {(userProfile?.name || userProfile?.username)?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsProfilePictureModalOpen(false)} className="flex-1">
              Close
            </Button>
            {isOwnProfile ? (
              <Button className="flex-1" onClick={() => {
                setIsProfilePictureModalOpen(false);
                avatarFileInputRef.current?.click();
              }}>
                <Upload className="h-4 w-4 mr-2" />
                Change Picture
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={() => {
                // TODO: Implement full-screen view
              }}>
                <Eye className="h-4 w-4 mr-2" />
                View Full Size
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isCropperModalOpen} onOpenChange={(open) => { if (!open) handleCancelCropModal(); }}>
        <DialogContent className="sm:max-w-md p-4 bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Crop Your Avatar</DialogTitle>
            <DialogDescription>Adjust the selection for your new profile picture. Use a square aspect ratio.</DialogDescription>
          </DialogHeader>
          {imageSrcForCropper && (
            <div className="my-4 max-h-[60vh] overflow-hidden flex justify-center items-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
                circularCrop={true}
              >
                <Image
                  ref={imgRef}
                  alt="Crop me"
                  src={imageSrcForCropper || ''}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ display: 'block', maxHeight: '50vh', width: 'auto', height: 'auto', objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
                  onLoad={onImageLoadInCropper}
                  unoptimized={true}
                />
              </ReactCrop>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleCancelCropModal} size="sm" disabled={isUploadingAvatar}>Cancel</Button>
            <Button onClick={handleCropAndSaveFromModal} disabled={!completedCrop || isUploadingAvatar} size="sm">Crop & Use</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
