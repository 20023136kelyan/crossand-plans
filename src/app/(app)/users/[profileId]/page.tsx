'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Edit3, MessageSquare, ShieldCheck as AdminIcon, CheckCircle, Settings as SettingsIcon,
  UserPlus, XCircle as XIcon, Check, MoreVertical, Camera, ChevronLeft, Users as UsersIconIcon,
  RotateCcw, EyeOff, Phone, Video
} from "lucide-react";
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
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getFriendships } from '@/services/userService';

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
      if (file.size > 2 * 1024 * 1024) { 
        toast({ title: "File Too Large", description: "Avatar image should not exceed 2MB.", variant: "destructive" });
        if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
        return;
      }
      let isValidType = false;
      const clientMimeType = file.type;
      if (clientMimeType && clientMimeType.startsWith('image/')) {
        isValidType = true;
      } else {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && commonImageExtensions.includes(extension)) {
          isValidType = true;
        }
      }
      if (!isValidType) {
        toast({ title: "Invalid File Type", description: "Please select a valid image file (PNG, JPG, GIF, WEBP).", variant: "destructive" });
        if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
        return;
      }

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
    <>
      <div className="min-h-screen bg-background text-foreground">
         <header className="sticky top-0 z-30 flex items-center justify-between p-3 bg-background/80 backdrop-blur-sm border-b border-muted-foreground/30">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground" aria-label="Go back">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-md font-semibold text-foreground/90 truncate">{userProfile.name || "Profile"}</h2>
            {isOwnProfile ? (
                 <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground" aria-label="My Settings">
                    <Link href="/users/settings"><SettingsIcon className="h-5 w-5" /></Link>
                 </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground hover:bg-foreground/10" aria-label="More options">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => toast({ title: "Coming Soon!", description: "Report user functionality will be added later." })} className="text-xs cursor-pointer">Report User</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast({ title: "Coming Soon!", description: "Block user functionality will be added later." })} className="text-xs cursor-pointer">Block User</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </header>

        <div className="flex flex-col items-center px-4 md:px-0 py-6">
          <div className="relative group">
            <Avatar className={cn("h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 text-4xl border-2 border-primary/30 shadow-lg", avatarPreviewUrl && "ring-2 ring-offset-2 ring-offset-background ring-primary")}
              key={avatarPreviewUrl || userProfile.avatarUrl || 'default'}>
              <AvatarImage 
                src={avatarPreviewUrl || userProfile.avatarUrl || undefined} 
                alt={userProfile.name || "User Avatar"} 
                data-ai-hint="person portrait"
              />
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            {isOwnProfile && !avatarPreviewUrl && (
              <button
                onClick={() => avatarFileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-card p-1.5 rounded-full shadow-md hover:bg-secondary transition-colors cursor-pointer border border-border/50 opacity-80 group-hover:opacity-100"
                aria-label="Change profile picture"
                disabled={isUploadingAvatar || isCropperModalOpen}
              >
                <Camera className="h-4 w-4 text-primary" />
              </button>
            )}
            <input type="file" accept="image/png, image/jpeg, image/gif, image/webp, image/*" ref={avatarFileInputRef} onChange={handleAvatarFileSelect} className="hidden" />
          </div>

          <h1 className="text-xl md:text-2xl font-bold mt-3 flex items-center text-center">
            {userProfile.name || "Macaroom User"}
            <VerificationBadgeInline role={userProfile.role} isVerified={userProfile.isVerified} />
          </h1>
          
          {userProfile.bio && (
            <p className="text-sm text-center text-muted-foreground max-w-md mt-1 mb-4 leading-relaxed px-2">
              {userProfile.bio}
            </p>
          )}
          
          <div className="flex justify-around w-full max-w-sm my-4 text-sm">
            <div className="text-center"><p className="font-bold text-base sm:text-lg text-foreground">{userStats?.postCount ?? 0}</p><p className="text-xs text-muted-foreground">Posts</p></div>
            <div className="text-center"><p className="font-bold text-base sm:text-lg text-foreground">{userStats?.followersCount ?? 0}</p><p className="text-xs text-muted-foreground">Followers</p></div>
            <div className="text-center"><p className="font-bold text-base sm:text-lg text-foreground">{userStats?.followingCount ?? 0}</p><p className="text-xs text-muted-foreground">Following</p></div>
            <div className="text-center"><p className="font-bold text-base sm:text-lg text-foreground">{userStats?.plansCreatedCount ?? 0}</p><p className="text-xs text-muted-foreground">Plans</p></div>
            <div className="text-center"><p className="font-bold text-base sm:text-lg text-foreground">{userStats?.plansSharedOrExperiencedCount ?? 0}</p><p className="text-xs text-muted-foreground">Shared</p></div>
          </div>
          
          {avatarPreviewUrl && isOwnProfile && (
            <div className="flex gap-2 my-3 w-full max-w-xs justify-center">
              <Button onClick={handleSaveAvatarToServer} disabled={isUploadingAvatar} size="sm" className="text-xs h-8 flex-1">
                {isUploadingAvatar ? <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />} Save Avatar
              </Button>
              <Button variant="ghost" onClick={handleCancelAvatarChangeOnProfile} disabled={isUploadingAvatar} size="sm" className="text-xs h-8 flex-1">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          )}

         {!avatarPreviewUrl && (
          <div className="flex flex-row gap-2 mt-4 w-full max-w-xs justify-center">
            {isOwnProfile ? (
              <Button variant="outline" className="w-full h-9 text-sm" asChild>
                <Link href="/onboarding">
                  <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
                </Link>
              </Button>
            ) : (
              <>
                {friendshipStatusWithViewer === 'friends' ? (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1 h-9 text-sm" onClick={handleInitiateChat} disabled={actionLoading || isInitiatingChat}>
                      {isInitiatingChat ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />} Message
                    </Button>
                    <Button 
                      variant="outline" 
                      className={cn("flex-1 h-9 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30")} 
                      disabled={actionLoading || followActionLoading} 
                      onClick={() => handleFriendRequestButtonAction('remove')}
                    >
                      {(actionLoading) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4"/>} 
                      Unfriend
                    </Button>
                  </div>
                ) : friendshipStatusWithViewer === 'pending_sent' ? (
                  <Button variant="outline" className="w-full h-9 text-sm" disabled={actionLoading || followActionLoading} onClick={() => handleFriendRequestButtonAction('cancel')}>
                    {(actionLoading) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <XIcon className="mr-2 h-4 w-4" />} Request Sent
                  </Button>
                ) : friendshipStatusWithViewer === 'pending_received' ? (
                  <div className="flex gap-2 w-full">
                    <Button className="flex-1 h-9 text-sm" disabled={actionLoading || followActionLoading} onClick={() => handleFriendRequestButtonAction('accept')}>
                      {(actionLoading) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />} Accept
                    </Button>
                    <Button variant="outline" onClick={() => handleFriendRequestButtonAction('decline')} disabled={actionLoading || followActionLoading} className="flex-1 h-9 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      Decline
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="default" 
                      className="flex-1 h-9 text-sm"
                      disabled={followActionLoading || isFollowing === null} 
                      onClick={() => handleFriendRequestButtonAction('send')}
                    >
                      {(followActionLoading) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      Add Friend
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 h-9 text-sm" 
                      onClick={handleInitiateChat} 
                      disabled={actionLoading || isInitiatingChat}
                    >
                      {isInitiatingChat ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />} Message
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </div>

        <div className="border-t border-border/20 pt-1">
          {userPostsArray.length > 0 && (
            <h2 className="text-center text-sm font-semibold uppercase text-muted-foreground tracking-wider my-4 pt-2 border-t border-border/20">Posts</h2>
          )}
          {userPostsArray.length === 0 && !loadingProfile ? (
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="mx-auto h-16 w-16 opacity-30 mb-3" />
              <p className="font-semibold text-lg">No Posts Yet</p>
              {isOwnProfile && <p className="text-sm">Share your first plan highlight!</p>}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 sm:gap-1 px-0.5 sm:px-1 pb-4">
              {userPostsArray.map((post, index) => (
                <button
                  key={post.id}
                  onClick={() => openPostModal(index)}
                  className="aspect-square relative bg-muted overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md"
                  aria-label={`View post: ${post.text?.substring(0, 30) || 'Image post'}`}
                >
                  {post.mediaUrl ? (
                    <Image
                      src={post.mediaUrl}
                      alt={post.text || `Post by ${userProfile.name}`}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, 250px"
                      style={{ objectFit: 'cover' }}
                      className="group-hover:opacity-80 transition-opacity"
                      data-ai-hint="user generated content"
                      unoptimized={!post.mediaUrl?.startsWith('http') || post.mediaUrl.includes('placehold.co')}
                      priority={index < 3}
                      loading={index < 3 ? 'eager' : 'lazy'}
                    />
                  ) : (
                       <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1">No Image</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPost && isPostModalOpen && userProfile && (
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
                  src={imageSrcForCropper}
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
    </>
  );
}
