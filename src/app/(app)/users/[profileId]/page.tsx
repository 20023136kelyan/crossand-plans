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
  RotateCcw, EyeOff, Phone, Video, LayoutGrid, Calendar, Users
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

        {/* Enhanced Profile Header */}
        <div className="relative bg-gradient-to-br from-background via-background/95 to-muted/20 border-b border-border/30">
          <div className="px-6 pt-8 pb-6">
            <div className="flex items-start gap-6">
              <div className="relative group">
                <Avatar className={cn("h-20 w-20 sm:h-24 sm:w-24 text-xl sm:text-2xl ring-2 ring-border/40 shadow-lg flex-shrink-0 transition-all duration-300 group-hover:ring-primary/50 group-hover:shadow-xl", avatarPreviewUrl && "ring-2 ring-offset-2 ring-offset-background ring-primary")}
                  key={avatarPreviewUrl || userProfile.avatarUrl || 'default'}>
                  <AvatarImage 
                    src={avatarPreviewUrl || userProfile.avatarUrl || undefined} 
                    alt={userProfile.username || userProfile.name || "User Avatar"} 
                    data-ai-hint="person portrait"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground font-semibold">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-2 border-background shadow-sm"></div>
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

              <div className="flex-1 min-w-0 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">@{userProfile.username || "user"}</h1>
                    <VerificationBadgeInline role={userProfile.role} isVerified={userProfile.isVerified} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {isOwnProfile ? (
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200" asChild>
                        <Link href="/users/edit-profile">
                          <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                          Edit Profile
                        </Link>
                      </Button>
                    ) : (
                      <>
                        {/* Chat Button */}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200" 
                          onClick={handleInitiateChat}
                          disabled={actionLoading || isInitiatingChat}
                        >
                          {isInitiatingChat ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Chat
                        </Button>
                        
                        {/* Friend Action Button */}
                        {friendshipStatusWithViewer === 'friends' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-3 text-xs font-medium rounded-lg border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200" 
                            onClick={() => handleFriendRequestButtonAction('remove')}
                            disabled={followActionLoading}
                          >
                            {followActionLoading ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <XIcon className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Remove Friend
                          </Button>
                        )}
                        
                        {friendshipStatusWithViewer === 'pending_sent' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-destructive/50 hover:bg-destructive/5 transition-all duration-200" 
                            onClick={() => handleFriendRequestButtonAction('cancel')}
                            disabled={followActionLoading}
                          >
                            {followActionLoading ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <XIcon className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Cancel Request
                          </Button>
                        )}
                        
                        {friendshipStatusWithViewer === 'pending_received' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="h-8 px-3 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm" 
                              onClick={() => handleFriendRequestButtonAction('accept')}
                              disabled={followActionLoading}
                            >
                              {followActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Accept
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-destructive/50 hover:bg-destructive/5 transition-all duration-200" 
                              onClick={() => handleFriendRequestButtonAction('decline')}
                              disabled={followActionLoading}
                            >
                              {followActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <XIcon className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Decline
                            </Button>
                          </>
                        )}
                        
                        {friendshipStatusWithViewer !== 'friends' && friendshipStatusWithViewer !== 'pending_sent' && friendshipStatusWithViewer !== 'pending_received' && (
                          <Button 
                            size="sm" 
                            variant="default" 
                            className="h-8 px-3 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm" 
                            onClick={() => handleFriendRequestButtonAction('send')}
                            disabled={followActionLoading}
                          >
                            {followActionLoading ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Send Friend Request
                          </Button>
                        )}
                        
                        {/* More Options Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200">
                              <MoreVertical className="h-3.5 w-3.5" />
                              <span className="sr-only">More options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg rounded-lg">
                            <DropdownMenuItem onSelect={() => handleReportUser()} className="text-xs cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                              Report User
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleBlockUser()} className="text-xs cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                              Block User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
              </div>
              {userProfile.name && (
                <h2 className="text-lg font-semibold text-foreground tracking-tight mt-4">{userProfile.name}</h2>
              )}
              {userProfile.bio && (
                <p className="text-sm text-muted-foreground/90 leading-relaxed mt-3 max-w-md">
                  {userProfile.bio}
                </p>
              )}
            </div>
          </div>
        </div>
          
        <div className="px-4 pb-4">
          {avatarPreviewUrl && isOwnProfile && (
            <div className="flex gap-2 mb-3">
              <Button onClick={handleSaveAvatarToServer} disabled={isUploadingAvatar} className="flex-1 h-8 text-sm font-medium">
                {isUploadingAvatar ? <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" /> : "Save Avatar"}
              </Button>
              <Button variant="outline" onClick={handleCancelAvatarChangeOnProfile} disabled={isUploadingAvatar} className="flex-1 h-8 text-sm font-medium">
                Cancel
              </Button>
            </div>
          )}


        </div>

        <div className="mt-0">
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-16 bg-transparent p-0 border-b border-border/20">
              <TabsTrigger 
                value="posts" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <span className="text-lg font-bold text-foreground">{userPostsArray?.length ?? 0}</span>
                <div className="flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-medium leading-tight">Posts</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <span className="text-lg font-bold text-foreground">{userStats?.plansCreatedCount ?? 0}</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-medium leading-tight">Plans</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="followers" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <span className="text-lg font-bold text-foreground">{userStats?.followersCount ?? 0}</span>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium leading-tight">Followers</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <span className="text-lg font-bold text-foreground">{userStats?.followingCount ?? 0}</span>
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs font-medium leading-tight">Following</span>
                </div>
              </TabsTrigger>
            </TabsList>
            
            {/* Posts Tab Content */}
            <TabsContent value="posts" className="mt-6 p-0">
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
            </TabsContent>
            
            {/* Plans Tab Content */}
            <TabsContent value="plans" className="mt-6 p-0">
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="mx-auto h-16 w-16 opacity-30 mb-3" />
                <p className="font-semibold text-lg">Plans</p>
                <p className="text-sm">Created plans will be displayed here</p>
                <p className="text-xs mt-1">Privacy settings will control visibility</p>
              </div>
            </TabsContent>
            
            {/* Followers Tab Content */}
            <TabsContent value="followers" className="mt-6 p-0">
              <div className="text-center py-12 text-muted-foreground">
                <Users className="mx-auto h-16 w-16 opacity-30 mb-3" />
                <p className="font-semibold text-lg">Followers</p>
                <p className="text-sm">Followers list will be displayed here</p>
                <p className="text-xs mt-1">Privacy settings will control visibility</p>
              </div>
            </TabsContent>
            
            {/* Following Tab Content */}
            <TabsContent value="following" className="mt-6 p-0">
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="mx-auto h-16 w-16 opacity-30 mb-3" />
                <p className="font-semibold text-lg">Following</p>
                <p className="text-sm">Following list will be displayed here</p>
                <p className="text-xs mt-1">Privacy settings will control visibility</p>
              </div>
            </TabsContent>
          </Tabs>
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
    </div>
  );
}
