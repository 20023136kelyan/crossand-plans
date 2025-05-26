'use client';

import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { usePathname, useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Label } from "@/components/ui/label"; // Explicit import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import NextImage from 'next/image';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getFriendships } from '@/services/userService';
import { getUserCompletedPlans, getPendingPlanSharesForUser, getPendingPlanInvitationsCount } from '@/services/planService';
import { getUserChats } from '@/services/chatService';
import type { Chat, Plan, UserProfile, AppTimestamp, FeedPostVisibility, FeedPost, UserRoleType } from '@/types/user';
import { isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { addPhotoHighlightAction } from '@/app/actions/planActions';
import { createFeedPostAction } from '@/app/actions/feedActions';
import { cn, commonImageExtensions } from '@/lib/utils';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Link from 'next/link';
import {
  Loader2, PlusCircle, Share2, Globe, Lock as LockIcon, Edit3, Sparkles, X as XIcon, UploadCloud,
  MessageSquare, User as UserIcon, Search, LayoutGrid, LayoutList, Wallet as WalletIcon, ChevronLeft
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';

// Canvas preview helper function for image cropping (for posts)
async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  fileName: string = 'cropped_highlight.png'
): Promise<File | null> {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('Failed to get 2D context from canvas for post highlight');
    return null;
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  ctx.drawImage(
    image,
    cropX,
    cropY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    crop.width * scaleX,
    crop.height * scaleY
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas to Blob conversion failed for post highlight');
        reject(new Error('Canvas to Blob conversion failed'));
        return;
      }
      resolve(new File([blob], fileName, { type: blob.type || 'image/png' }));
    }, 'image/png', 0.9);
  });
}

const SIDEBAR_MARGIN_CLASS_MD = "md:ml-[60px]";
const SIDEBAR_MARGIN_CLASS_LG = "lg:ml-[64px]";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, currentUserProfile, profileExists, refreshProfileStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [plansNotificationCount, setPlansNotificationCount] = useState(0);
  const [messagesNotificationCount, setMessagesNotificationCount] = useState(0);
  const [profileNotificationCount, setProfileNotificationCount] = useState(0);

  const currentUserId = user?.uid;

  // ---- Notification Counts Effect ----
  useEffect(() => {
    const logPrefix = "[AppLayout Notifications Effect]";
    // console.log(`${logPrefix} Running. UserID: ${currentUserId}, ProfileExists: ${profileExists}, AuthLoading: ${authLoading}`);

    if (authLoading || !currentUserId || profileExists === false || profileExists === null) {
      // console.log(`${logPrefix} Conditions not met. Resetting counts.`);
      setPlansNotificationCount(0);
      setMessagesNotificationCount(0);
      setProfileNotificationCount(0);
      return () => {};
    }

    // console.log(`${logPrefix} User authenticated & profile exists. Setting up listeners for UserID: ${currentUserId}`);
    let unsubFriendRequests: (() => void) | undefined;
    let unsubPlanShares: (() => void) | undefined;
    let unsubPlanInvitations: (() => void) | undefined;
    let unsubChats: (() => void) | undefined;

    // Friend Requests for Profile Badge
    unsubFriendRequests = getFriendships(
      currentUserId,
      (allFriendships) => {
        const pendingReceivedCount = allFriendships.filter(f => f.status === 'pending_received').length;
        // console.log(`${logPrefix} Pending Friend Requests: ${pendingReceivedCount}`);
        setProfileNotificationCount(pendingReceivedCount);
      },
      (error) => console.error(`${logPrefix} Error fetching friendships:`, error)
    );

    // Plan Shares & Invitations for Plans Badge
    let currentPlanSharesCount = 0;
    let currentPlanInvitesCount = 0;

    const updatePlansTotal = () => {
      setPlansNotificationCount(currentPlanSharesCount + currentPlanInvitesCount);
    };

    if (typeof getPendingPlanSharesForUser === 'function') {
        unsubPlanShares = getPendingPlanSharesForUser(currentUserId, (shares) => {
          currentPlanSharesCount = shares.length;
          updatePlansTotal();
        }, (error) => console.error(`${logPrefix} Error fetching plan shares:`, error));
    } else {
        console.warn(`${logPrefix} getPendingPlanSharesForUser is not a function or not imported.`);
    }
    
    if (typeof getPendingPlanInvitationsCount === 'function') {
        unsubPlanInvitations = getPendingPlanInvitationsCount(currentUserId, (invitesCount) => {
          currentPlanInvitesCount = invitesCount;
          updatePlansTotal();
        }, (error) => console.error(`${logPrefix} Error fetching plan invites:`, error));
    } else {
        console.warn(`${logPrefix} getPendingPlanInvitationsCount is not a function or not imported.`);
    }


    // Unread Messages for Messages Badge
    if (typeof getUserChats === 'function') {
        unsubChats = getUserChats(currentUserId, (fetchedChats: Chat[]) => {
          let unreadCount = 0;
          fetchedChats.forEach((chat) => {
            if (!chat.lastMessageTimestamp || !chat.lastMessageSenderId || chat.lastMessageSenderId === currentUserId) return;

            let lastMsgTime: number | null = null;
            if (chat.lastMessageTimestamp) {
               const parsedDate = parseISO(chat.lastMessageTimestamp as string);
               if (isValid(parsedDate)) lastMsgTime = parsedDate.getTime();
            }

            let userReadTime = 0;
            const userReadTsValue = chat.participantReadTimestamps?.[currentUserId];
            if (userReadTsValue) {
              const parsedReadDate = parseISO(userReadTsValue as string);
              if (isValid(parsedReadDate)) userReadTime = parsedReadDate.getTime();
            }

            if (lastMsgTime && lastMsgTime > userReadTime) {
              unreadCount++;
            }
          });
          setMessagesNotificationCount(unreadCount);
        }, (error) => console.error(`${logPrefix} Error fetching chats for notifications:`, error));
    } else {
        console.warn(`${logPrefix} getUserChats is not a function or not imported.`);
    }


    return () => {
      // console.log(`${logPrefix} Cleanup: Unsubscribing from all listeners for UserID: ${currentUserId}`);
      if (unsubFriendRequests) unsubFriendRequests();
      if (unsubPlanShares) unsubPlanShares();
      if (unsubPlanInvitations) unsubPlanInvitations();
      if (unsubChats) unsubChats();
    };
  }, [currentUserId, profileExists, authLoading, user?.uid]);


  // ---- Page Transition Animation Logic ----
  const [pageAnimationClass, setPageAnimationClass] = useState('');
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    const currentPath = pathname;
    const prevPath = previousPathnameRef.current;
    let animationClass = '';

    const mainBottomNavDestinations = ['/feed', '/explore', '/plans', `/users/${user?.uid}`, '/wallet'];
    const isMessagesPage = currentPath.startsWith('/messages/') && currentPath !== '/messages';

    if (currentPath.startsWith('/messages/') && currentPath !== '/messages' && prevPath !== '/messages') {
        animationClass = 'animate-slide-in-messages';
    } else if (mainBottomNavDestinations.includes(currentPath) && currentPath !== prevPath) {
        const wasOnMainBottomNavDest = mainBottomNavDestinations.includes(prevPath) || (prevPath.startsWith('/messages/') && prevPath !== '/messages');
        if (wasOnMainBottomNavDest || prevPath === '/') {
            animationClass = 'animate-slide-in-from-bottom';
        }
    }


    setPageAnimationClass(animationClass);
    if (currentPath !== prevPath) {
      previousPathnameRef.current = currentPath;
    }
  }, [pathname, user?.uid]);

  // ---- Create Post Dialog Logic ----
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);
  const [userCompletedPlans, setUserCompletedPlans] = useState<Plan[]>([]);
  const [loadingCompletedPlans, setLoadingCompletedPlans] = useState(false);
  const [selectedPlanIdForPost, setSelectedPlanIdForPost] = useState<string | undefined>(undefined);

  const [imageSrcForPostCropper, setImageSrcForPostCropper] = useState<string | null>(null);
  const [postCrop, setPostCrop] = useState<Crop>();
  const imgRefPostCropperDialog = useRef<HTMLImageElement>(null);
  const [completedPostCrop, setCompletedPostCrop] = useState<PixelCrop | null>(null);
  const [isPostCropperModalOpen, setIsPostCropperModalOpen] = useState(false);
  const [croppedHighlightFileForPost, setCroppedHighlightFileForPost] = useState<File | null>(null);
  const [finalHighlightPreviewUrl, setFinalHighlightPreviewUrl] = useState<string | null>(null);

  const [postCaptionForDialog, setPostCaptionForDialog] = useState('');
  const [postVisibilityForDialog, setPostVisibilityForDialog] = useState<FeedPostVisibility>('public');
  const [isSubmittingPostFromDialog, setIsSubmittingPostFromDialog] = useState(false);
  const highlightFileInputRefDialog = useRef<HTMLInputElement>(null);

  const resetCreatePostDialogStates = useCallback(() => {
    setSelectedPlanIdForPost(undefined);
    setCroppedHighlightFileForPost(null);
    if (finalHighlightPreviewUrl) URL.revokeObjectURL(finalHighlightPreviewUrl);
    setFinalHighlightPreviewUrl(null);
    setImageSrcForPostCropper(null);
    setPostCrop(undefined);
    setCompletedPostCrop(null);
    setPostCaptionForDialog('');
    setPostVisibilityForDialog('public');
    if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
    setIsPostCropperModalOpen(false);
    setLoadingCompletedPlans(false);
    setIsSubmittingPostFromDialog(false);
  }, [finalHighlightPreviewUrl]);

  const handleOpenCreatePostDialog = useCallback(async () => {
    if (!user || !currentUserProfile) {
      toast({ title: "Login Required", description: "Please log in to create a post.", variant: "destructive" });
      return;
    }
    resetCreatePostDialogStates();
    setIsQuickAddOpen(false);
    setIsCreatePostDialogOpen(true);

    setLoadingCompletedPlans(true);
    try {
      const completedPlans = await getUserCompletedPlans(user.uid);
      setUserCompletedPlans(completedPlans);
      if (completedPlans.length === 0) {
        toast({ title: "No Completed Plans", description: "You need to have completed a plan to share highlights.", variant: "default", duration: 4000 });
      }
    } catch (error: any) {
      toast({ title: "Error Fetching Plans", description: error.message || "Could not fetch your completed plans.", variant: "destructive" });
    } finally {
      setLoadingCompletedPlans(false);
    }
  }, [user, currentUserProfile, toast, resetCreatePostDialogStates]);

  const handleHighlightFileChangeForDialog = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image size should not exceed 5MB.", variant: "destructive" });
        if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
        return;
      }
      let isValidClientSide = false;
      const clientMimeType = file.type;
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (clientMimeType && clientMimeType.startsWith('image/')) {
          isValidClientSide = true;
      } else if (fileExtension && commonImageExtensions.includes(fileExtension)) {
          isValidClientSide = true;
      }

      if (!isValidClientSide) {
         toast({ title: "Invalid file type", description: `Please select an image. Detected: ${clientMimeType || 'unknown'}. File: ${fileName}`, variant: "destructive" });
         if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
         return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrcForPostCropper(reader.result?.toString() || null);
        setPostCrop(undefined);
        setCompletedPostCrop(null);
        setCroppedHighlightFileForPost(null);
        if (finalHighlightPreviewUrl) URL.revokeObjectURL(finalHighlightPreviewUrl);
        setFinalHighlightPreviewUrl(null);
        setIsPostCropperModalOpen(true);
      });
      reader.readAsDataURL(file);
      if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
    }
  };

  const onPostImageLoadInCropperDialog = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRefPostCropperDialog.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 4 / 3, width, height), width, height);
    setPostCrop(initialCrop);
  }, []);

  const handlePostImageCropAndSaveDialog = async () => {
    if (!imageSrcForPostCropper || !completedPostCrop || !imgRefPostCropperDialog.current) {
      toast({ title: "Crop Error", description: "Please select and crop an area for your post image.", variant: "destructive" });
      return;
    }
    try {
      const originalFileName = `macaroom_post_highlight_${Date.now()}.png`;
      const croppedFileResult = await canvasPreview(imgRefPostCropperDialog.current, document.createElement('canvas'), completedPostCrop, originalFileName);
      if (croppedFileResult) {
        setCroppedHighlightFileForPost(croppedFileResult);
        if (finalHighlightPreviewUrl) URL.revokeObjectURL(finalHighlightPreviewUrl);
        setFinalHighlightPreviewUrl(URL.createObjectURL(croppedFileResult));
      } else {
        toast({ title: "Crop Failed", description: "Could not process the cropped image.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Crop Error", description: e.message || "An unexpected error occurred during cropping.", variant: "destructive" });
    }
    setIsPostCropperModalOpen(false);
  };

  const handleCancelPostImageCropDialog = () => {
    setIsPostCropperModalOpen(false);
    setImageSrcForPostCropper(null);
    setPostCrop(undefined);
    setCompletedPostCrop(null);
  };

  const handleCreatePostSubmit = async () => {
    if (!user || !currentUserProfile) { toast({ title: "Auth Error", description: "User not authenticated.", variant: "destructive" }); return; }
    if (!selectedPlanIdForPost) { toast({ title: "Validation Error", description: "Please select a plan.", variant: "destructive" }); return; }
    if (!croppedHighlightFileForPost) { toast({ title: "Validation Error", description: "Please select and crop an image highlight.", variant: "destructive" }); return; }
    if (!postCaptionForDialog.trim()) { toast({ title: "Validation Error", description: "Please enter a caption.", variant: "destructive" }); return; }

    setIsSubmittingPostFromDialog(true);
    let idToken: string | null = null;
    try {
      await user.getIdToken(true);
      idToken = await user.getIdToken();
      if (!idToken) throw new Error("Failed to retrieve authentication token.");

      const highlightFormData = new FormData();
      highlightFormData.append('highlightImage', croppedHighlightFileForPost);

      const highlightResult = await addPhotoHighlightAction(selectedPlanIdForPost, highlightFormData, idToken);

      if (!highlightResult.success || !highlightResult.updatedPlan?.photoHighlights || highlightResult.updatedPlan.photoHighlights.length === 0) {
        throw new Error(highlightResult.error || "Could not upload highlight image or retrieve its URL.");
      }
      const latestHighlightUrl = highlightResult.updatedPlan.photoHighlights[highlightResult.updatedPlan.photoHighlights.length - 1];
      if (!latestHighlightUrl) throw new Error("Could not retrieve the new highlight URL after upload.");

      const selectedPlanDetails = userCompletedPlans.find(p => p.id === selectedPlanIdForPost) || { id: selectedPlanIdForPost, name: "Selected Plan" };

      const postDataForAction = {
        planId: selectedPlanDetails.id,
        planName: selectedPlanDetails.name || 'A Plan',
        highlightImageUrl: latestHighlightUrl,
        postText: postCaptionForDialog,
        visibility: postVisibilityForDialog,
      };

      const postResult = await createFeedPostAction(postDataForAction, idToken);

      if (postResult.success) {
        toast({ title: "Post Shared!", description: "Your highlight has been shared to the feed." });
        setIsCreatePostDialogOpen(false);
        resetCreatePostDialogStates();
        console.log('Refreshing route. Current pathname:', pathname);
        router.refresh();
        // FeedPage will re-fetch on its own or via revalidatePath
      } else {
        throw new Error(postResult.error || "Could not share to feed.");
      }
    } catch (error: any) {
      console.error("Error creating post from AppLayout dialog:", error);
      toast({ title: "Error Creating Post", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmittingPostFromDialog(false);
    }
  };

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const openQuickAddMenu = useCallback(() => setIsQuickAddOpen(true), []);


  // ---- Hiding Bottom Nav Logic ----
  const isOnboardingPage = pathname === '/onboarding';
  const isIndividualChatPage = pathname.startsWith('/messages/') && pathname !== '/messages';
  const isPlanDetailPage = pathname.startsWith('/plans/') && pathname.split('/').length > 3 && !pathname.includes('/create') && !pathname.includes('/generate') && !pathname.includes('/category/') && !pathname.includes('/city/');
  const isPlanCategoryPage = pathname.startsWith('/plans/category/');
  const isPlanCityPage = pathname.startsWith('/plans/city/');
  const isPlanGeneratePage = pathname === '/plans/generate';
  const isPlanCreatePage = pathname === '/plans/create';
  const isCollectionDetailPage = pathname.startsWith('/collections/') && pathname !== '/collections';
  const isUserSettingsPage = pathname === '/profile';
  const isUserProfilePage = pathname.startsWith('/users/'); // New public profile page

  const hideBottomNav =
    isOnboardingPage ||
    isIndividualChatPage ||
    isPlanDetailPage ||
    isPlanCategoryPage ||
    isPlanCityPage ||
    isPlanGeneratePage ||
    isPlanCreatePage ||
    isCollectionDetailPage ||
    isUserSettingsPage;

  const showHeader = pathname === '/feed';
  const useFullWidthLayout = isIndividualChatPage || isPlanGeneratePage;

  const mainContentWrapperClasses = cn(
    "flex-1 flex flex-col",
    !isMobile && "md:ml-[240px] lg:ml-[256px]"
  );

  const mainContentContainerClasses = cn(
    "flex-1",
    useFullWidthLayout ? "h-full" : (hideBottomNav ? "py-6" : "py-6 mb-16 md:mb-0"),
    !useFullWidthLayout && "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    pageAnimationClass
  );


  if (authLoading && !user) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex h-full">
      {!isMobile && user && currentUserProfile && (
        <Sidebar
          plansNotificationCount={plansNotificationCount}
          profileNotificationCount={profileNotificationCount}
          handleOpenCreatePostDialog={handleOpenCreatePostDialog}
        />
      )}

      <div className={mainContentWrapperClasses}>
        {showHeader && user && (
          <Header
            messagesNotificationCount={messagesNotificationCount}
          />
        )}
        <main className={mainContentContainerClasses}>
          {children}
        </main>
      </div>

      {isMobile && !hideBottomNav && user && (
        <BottomNav
          plansNotificationCount={plansNotificationCount}
          profileNotificationCount={profileNotificationCount}
          openQuickAddMenu={openQuickAddMenu}
          handleOpenCreatePostDialog={handleOpenCreatePostDialog}
        />
      )}

      {/* Global Quick Add Popover */}
      <Popover open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <PopoverTrigger asChild>
          {/* Dummy trigger, actual opening handled by openQuickAddMenu from Nav/Sidebar */}
          {/* This div can be styled if needed, or kept minimal if trigger is purely programmatic */}
          <div />
        </PopoverTrigger>
        <PopoverContent
          side={isMobile ? "top" : "right"}
          align={isMobile ? "center" : "start"}
          className={cn(
            "w-56 p-2 shadow-xl rounded-xl border-border/50 bg-card/95 backdrop-blur-sm",
            isMobile ? "mb-2 fixed bottom-16 left-1/2 -translate-x-1/2" : "ml-2"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="grid gap-1">
            <Button variant="ghost" className="w-full justify-start text-sm h-9" asChild onClick={() => setIsQuickAddOpen(false)}>
              <Link href="/plans/generate">
                <Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => {handleOpenCreatePostDialog(); setIsQuickAddOpen(false); }}>
              <Edit3 className="mr-2 h-4 w-4" /> New Post
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Global "Create New Feed Post" Dialog */}
      <Dialog open={isCreatePostDialogOpen} onOpenChange={(open) => {
          setIsCreatePostDialogOpen(open);
          if (!open) resetCreatePostDialogStates();
        }}>
        <DialogContent className="sm:max-w-sm rounded-xl bg-card shadow-2xl p-6 border-transparent">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-xl font-semibold text-foreground">Create New Feed Post</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Share a highlight from one of your completed plans.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <FormItem className="space-y-1.5">
                <Label htmlFor="completed-plan-select-dialog-applayout" className="text-sm font-medium">Select Completed Plan</Label>
                {loadingCompletedPlans ? (
                  <div className="flex items-center text-sm text-muted-foreground h-9"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading plans...</div>
                ) : userCompletedPlans.length === 0 ? (
                  <div className="text-sm text-muted-foreground h-auto flex flex-col items-start py-1">
                    <span>No completed plans found to share.</span>
                    <Link href="/plans" className="text-xs text-primary hover:underline mt-0.5" onClick={() => setIsCreatePostDialogOpen(false)}>View your plans.</Link>
                  </div>
                ) : (
                <Select
                    value={selectedPlanIdForPost}
                    onValueChange={setSelectedPlanIdForPost}
                    disabled={isSubmittingPostFromDialog || loadingCompletedPlans}
                >
                    <SelectTrigger id="completed-plan-select-dialog-applayout" className="text-sm h-9 bg-muted border-border/30 focus:border-primary placeholder:text-muted-foreground/70">
                      <SelectValue placeholder="Choose a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                    {userCompletedPlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id} className="text-sm">{plan.name}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                )}
            </FormItem>

            <FormItem className="space-y-1.5">
              <Label htmlFor="highlight-image-upload-dialog-applayout" className="text-sm font-medium">Upload New Highlight</Label>
              <Input
                id="highlight-image-upload-dialog-applayout"
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp, image/*"
                onChange={handleHighlightFileChangeForDialog}
                ref={highlightFileInputRefDialog}
                className="text-sm h-10 file:mr-2 file:text-xs file:font-semibold file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 bg-muted border-border/30 focus:border-primary"
                disabled={isSubmittingPostFromDialog || !selectedPlanIdForPost || isPostCropperModalOpen}
              />
              {finalHighlightPreviewUrl && (
                <div className="mt-3 relative w-full aspect-video sm:aspect-square sm:w-40 sm:h-40 max-h-60 rounded-lg overflow-hidden border border-border/50 shadow-sm group mx-auto">
                  <NextImage src={finalHighlightPreviewUrl} alt="Highlight preview" fill style={{ objectFit: 'contain' }} data-ai-hint="upload preview" unoptimized/>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute top-1 right-1 h-7 w-7 bg-black/60 hover:bg-black/80 text-white/90 hover:text-white rounded-full backdrop-blur-sm shadow-md"
                    onClick={() => {
                      setCroppedHighlightFileForPost(null);
                      if (finalHighlightPreviewUrl) URL.revokeObjectURL(finalHighlightPreviewUrl);
                      setFinalHighlightPreviewUrl(null);
                      setImageSrcForPostCropper(null);
                      if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
                    }}
                    aria-label="Remove selected image"
                    disabled={isSubmittingPostFromDialog}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {!finalHighlightPreviewUrl && !imageSrcForPostCropper && (
                <button type="button" onClick={() => highlightFileInputRefDialog.current?.click()}
                  className={cn(
                    "mt-1 w-full aspect-video sm:w-full sm:h-40 max-h-60 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors mx-auto",
                    (!selectedPlanIdForPost || isPostCropperModalOpen) && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!selectedPlanIdForPost || isSubmittingPostFromDialog || isPostCropperModalOpen}
                  aria-label="Upload highlight image"
                >
                  <UploadCloud className="h-8 w-8 mb-1" />
                  <span className="text-xs">Click to upload</span>
                </button>
              )}
            </FormItem>

            <FormItem className="space-y-1.5">
              <Label htmlFor="post-caption-dialog-applayout" className="text-sm font-medium">Caption</Label>
              <Textarea
                id="post-caption-dialog-applayout"
                placeholder="Write something about this highlight..."
                value={postCaptionForDialog}
                onChange={(e) => setPostCaptionForDialog(e.target.value)}
                className="text-sm min-h-[100px] bg-muted border-border/30 focus:border-primary placeholder:text-muted-foreground/70"
                disabled={isSubmittingPostFromDialog || !croppedHighlightFileForPost}
                rows={4}
              />
            </FormItem>

            <FormItem className="space-y-1.5">
              <Label htmlFor="post-visibility-dialog-applayout" className="text-sm font-medium">Visibility</Label>
              <RadioGroup
                id="post-visibility-dialog-applayout"
                value={postVisibilityForDialog}
                onValueChange={(value: string) => setPostVisibilityForDialog(value as FeedPostVisibility)}
                className="flex items-center gap-6 pt-1"
                disabled={isSubmittingPostFromDialog}
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="public" id="visibility-public-dialog-applayout" />
                  <Label htmlFor="visibility-public-dialog-applayout" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"><Globe className="w-4 h-4"/>Public</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="private" id="visibility-private-dialog-applayout" />
                  <Label htmlFor="visibility-private-dialog-applayout" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"><LockIcon className="w-4 h-4"/>Private</Label>
                </div>
              </RadioGroup>
            </FormItem>
          </div>

          <DialogFooter className="flex flex-col gap-3 pt-6">
             <Button
              type="button"
              onClick={handleCreatePostSubmit}
              disabled={isSubmittingPostFromDialog || loadingCompletedPlans || !selectedPlanIdForPost || !croppedHighlightFileForPost || !postCaptionForDialog.trim()}
              className="w-full h-10"
            >
              {isSubmittingPostFromDialog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Share
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {setIsCreatePostDialogOpen(false); resetCreatePostDialogStates();}}
                disabled={isSubmittingPostFromDialog}
                className="w-full h-10 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Image Cropper Dialog for AppLayout */}
      <Dialog open={isPostCropperModalOpen} onOpenChange={(open) => {if(!open) handleCancelPostImageCropDialog(); }}>
        <DialogContent className="sm:max-w-md p-4 bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Crop Your Highlight Image</DialogTitle>
            <DialogDescription className="text-sm">Adjust the selection for your post image. Recommended aspect ratio: 4:3.</DialogDescription>
          </DialogHeader>
          {imageSrcForPostCropper && (
            <div className="my-4 max-h-[60vh] overflow-hidden flex justify-center items-center">
              <ReactCrop
                crop={postCrop}
                onChange={(_, percentCrop) => setPostCrop(percentCrop)}
                onComplete={(c) => setCompletedPostCrop(c)}
                aspect={4/3}
                minWidth={100}
                minHeight={75}
                // circularCrop={false} // Rectangular crop for posts
              >
                <NextImage
                  ref={imgRefPostCropperDialog}
                  alt="Crop me"
                  src={imageSrcForPostCropper}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ display: 'block', maxHeight: '50vh', width: 'auto', height: 'auto', objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
                  onLoad={onPostImageLoadInCropperDialog}
                  unoptimized={true}
                />
              </ReactCrop>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleCancelPostImageCropDialog} size="sm" disabled={isSubmittingPostFromDialog}>Cancel</Button>
            <Button onClick={handlePostImageCropAndSaveDialog} disabled={!completedPostCrop || isSubmittingPostFromDialog} size="sm">Crop & Use Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
