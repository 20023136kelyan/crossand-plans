
'use client';

import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar'; // Added SidebarProvider
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import { Switch } from '@/components/ui/switch';
import NextImage from 'next/image';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getFriendships } from '@/services/userService';
import { getUserCompletedPlans, getPendingPlanSharesForUser, getPendingPlanInvitationsCount } from '@/services/planService';
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
  MessageSquare, User as UserIcon, Search, LayoutGrid, LayoutList, Wallet as WalletIcon, ChevronLeft, ImageIcon, ImagePlus
} from 'lucide-react';
import { Label } from '@/components/ui/label'; // Keep this for radio button labels
import { useIsMobile } from '@/hooks/use-is-mobile';
import { auth } from '@/lib/firebase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

const createPostFormSchema = z.object({
  planId: z.string().min(1, "Please select a plan."),
  caption: z.string().min(1, "Caption cannot be empty.").max(2000, "Caption is too long."),
  isPublic: z.boolean().default(true),
});
type CreatePostFormValues = z.infer<typeof createPostFormSchema>;


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, currentUserProfile, profileExists, refreshProfileStatus, acknowledgeNewUserWelcome, isNewUserJustSignedUp } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [plansNotificationCount, setPlansNotificationCount] = useState(0);
  const [messagesNotificationCount, setMessagesNotificationCount] = useState(0);
  const [profileNotificationCount, setProfileNotificationCount] = useState(0);

  const currentUserId = user?.uid;

   useEffect(() => {
    const logPrefix = "[AppLayout Notifications Effect]";
    if (authLoading || !currentUserId || profileExists === false || profileExists === null) {
      setPlansNotificationCount(0);
      setMessagesNotificationCount(0);
      setProfileNotificationCount(0);
      return () => {};
    }
    let unsubFriendRequests: (() => void) | undefined;
    let unsubPlanShares: (() => void) | undefined;
    let unsubPlanInvitations: (() => void) | undefined;
    let unsubChats: (() => void) | undefined;
    unsubFriendRequests = getFriendships(
      currentUserId,
      (allFriendships) => {
        const pendingReceivedCount = allFriendships.filter(f => f.status === 'pending_received').length;
        setProfileNotificationCount(pendingReceivedCount);
      },
      (error) => console.error(`${logPrefix} Error fetching friendships:`, error)
    );
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
    }
    if (typeof getPendingPlanInvitationsCount === 'function') {
        unsubPlanInvitations = getPendingPlanInvitationsCount(currentUserId, (invitesCount) => {
          currentPlanInvitesCount = invitesCount;
          updatePlansTotal();
        }, (error) => console.error(`${logPrefix} Error fetching plan invites:`, error));
    }
    if (typeof (window as any).getUserChats === 'function') { 
        unsubChats = (window as any).getUserChats(currentUserId, (fetchedChats: Chat[]) => {
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
        }, (error: any) => console.error(`${logPrefix} Error fetching chats for notifications:`, error));
    } else {
        console.warn(`${logPrefix} getUserChats function not found. Messages notifications will not be available.`);
        setMessagesNotificationCount(0);
    }
    return () => {
      if (unsubFriendRequests) unsubFriendRequests();
      if (unsubPlanShares) unsubPlanShares();
      if (unsubPlanInvitations) unsubPlanInvitations();
      if (unsubChats) unsubChats();
    };
  }, [currentUserId, profileExists, authLoading, user?.uid]);

  useEffect(() => {
    if (authLoading) return; 
    const publicPaths = ['/login', '/signup', '/'];
    const isOnboardingRelated = pathname === '/onboarding';
    const isPublicDynamicRoute = pathname.startsWith('/p/') || pathname.startsWith('/u/'); 
    if (profileExists === null && user) return;
    if (user) { 
      if (profileExists === false && !isOnboardingRelated) router.push('/onboarding');
      else if (profileExists === true && (isOnboardingRelated || publicPaths.includes(pathname))) router.push('/feed');
    } else { 
      if (!isPublicDynamicRoute && !publicPaths.includes(pathname) && !isOnboardingRelated) router.push('/login');
    }
  }, [user, authLoading, profileExists, router, pathname]);

  const [pageAnimationClass, setPageAnimationClass] = useState('');
  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    const currentPath = pathname; const prevPath = previousPathnameRef.current;
    if (currentPath !== prevPath) {
      const mainTabs = ['/feed', '/explore']; const prevIndex = mainTabs.indexOf(prevPath); const currentIndex = mainTabs.indexOf(currentPath);
      if (prevIndex !== -1 && currentIndex !== -1) {
        if (currentIndex > prevIndex) setPageAnimationClass('animate-slide-in-from-right');
        else if (currentIndex < prevIndex) setPageAnimationClass('animate-slide-in-from-left');
        else setPageAnimationClass('');
      } else setPageAnimationClass('animate-fade-in'); 
      const timer = setTimeout(() => setPageAnimationClass(''), 500);
      previousPathnameRef.current = currentPath;
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);
  const [isPostCropperModalOpen, setIsPostCropperModalOpen] = useState(false); 
  const [userCompletedPlans, setUserCompletedPlans] = useState<Plan[]>([]);
  const [loadingCompletedPlans, setLoadingCompletedPlans] = useState(false);
  const [imageSrcForPostCropper, setImageSrcForPostCropper] = useState<string | null>(null);
  const [postCrop, setPostCrop] = useState<Crop>();
  const imgRefPostCropperDialog = useRef<HTMLImageElement>(null);
  const [completedPostCrop, setCompletedPostCrop] = useState<PixelCrop | null>(null);
  const [croppedHighlightFileForPost, setCroppedHighlightFileForPost] = useState<File | null>(null);
  const [finalHighlightPreviewUrl, setFinalHighlightPreviewUrl] = useState<string | null>(null);
  const finalHighlightPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => { finalHighlightPreviewUrlRef.current = finalHighlightPreviewUrl; }, [finalHighlightPreviewUrl]);
  const [isSubmittingPostFromDialog, setIsSubmittingPostFromDialog] = useState(false);
  const highlightFileInputRefDialog = useRef<HTMLInputElement>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);


  const formForPostCreation = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostFormSchema),
    defaultValues: { planId: '', caption: '', isPublic: true },
  });

  const resetCreatePostDialogStates = useCallback(() => {
    formForPostCreation.reset({ planId: '', caption: '', isPublic: true });
    setCroppedHighlightFileForPost(null);
    if (finalHighlightPreviewUrlRef.current) URL.revokeObjectURL(finalHighlightPreviewUrlRef.current);
    setFinalHighlightPreviewUrl(null); finalHighlightPreviewUrlRef.current = null; 
    setImageSrcForPostCropper(null); setPostCrop(undefined); setCompletedPostCrop(null);
    if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
    setIsPostCropperModalOpen(false); setLoadingCompletedPlans(false);
    setIsSubmittingPostFromDialog(false); setIsUploadingHighlight(false); setIsDraggingOver(false);
  }, [formForPostCreation]);

  const handleOpenCreatePostDialog = useCallback(async () => {
    const currentAuthUser = auth.currentUser; 
    if (!currentAuthUser || !currentUserProfile) { 
      toast({ title: "Login Required", description: "Please log in to create a post.", variant: "destructive" }); return;
    }
    resetCreatePostDialogStates(); setIsCreatePostDialogOpen(true); setLoadingCompletedPlans(true);
    try {
      const completedPlans = await getUserCompletedPlans(currentAuthUser.uid); setUserCompletedPlans(completedPlans);
      if (completedPlans.length === 0) toast({ title: "No Completed Plans", description: "You need to have completed a plan to share highlights.", variant: "default", duration: 4000 });
    } catch (error: any) { toast({ title: "Error Fetching Plans", description: error.message || "Could not fetch your completed plans.", variant: "destructive" });
    } finally { setLoadingCompletedPlans(false); }
  }, [currentUserProfile, resetCreatePostDialogStates, toast, auth]); 

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image size should not exceed 5MB.", variant: "destructive" }); return;
    }
    let isValidClientSide = false; const clientMimeType = file.type; const fileName = file.name; const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (clientMimeType && clientMimeType.startsWith('image/')) isValidClientSide = true;
    else if (fileExtension && commonImageExtensions.includes(fileExtension)) isValidClientSide = true;
    if (!isValidClientSide) {
       toast({ title: "Invalid file type", description: `Please select an image. Detected: ${clientMimeType || 'unknown'}. File: ${fileName}`, variant: "destructive" }); return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrcForPostCropper(reader.result?.toString() || null);
      setPostCrop(undefined); setCompletedPostCrop(null); setCroppedHighlightFileForPost(null);
      if (finalHighlightPreviewUrlRef.current) URL.revokeObjectURL(finalHighlightPreviewUrlRef.current);
      setFinalHighlightPreviewUrl(null); setIsPostCropperModalOpen(true);
    });
    reader.readAsDataURL(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(true);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      if (!formForPostCreation.getValues('planId')) {
        toast({ title: "Select a Plan First", description: "Please choose a plan before uploading an image.", variant: "default" }); return;
      }
      handleFileSelected(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
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
      toast({ title: "Crop Error", description: "Please select and crop an area for your post image.", variant: "destructive" }); return;
    }
    try {
      const originalFileName = `macaroom_post_highlight_${Date.now()}.png`;
      const croppedFileResult = await canvasPreview(imgRefPostCropperDialog.current, document.createElement('canvas'), completedPostCrop, originalFileName);
      if (croppedFileResult) {
        setCroppedHighlightFileForPost(croppedFileResult);
        if (finalHighlightPreviewUrlRef.current) URL.revokeObjectURL(finalHighlightPreviewUrlRef.current);
        const newPreviewUrl = URL.createObjectURL(croppedFileResult);
        setFinalHighlightPreviewUrl(newPreviewUrl); finalHighlightPreviewUrlRef.current = newPreviewUrl;
      } else toast({ title: "Crop Failed", description: "Could not process the cropped image.", variant: "destructive" });
    } catch (e: any) { toast({ title: "Crop Error", description: e.message || "An unexpected error occurred during cropping.", variant: "destructive" }); }
    setIsPostCropperModalOpen(false);
  };

  const handleCancelPostImageCropDialog = () => {
    setIsPostCropperModalOpen(false); setImageSrcForPostCropper(null); setPostCrop(undefined); setCompletedPostCrop(null);
  };

  const handleCreatePostSubmit = async (dataFromForm: CreatePostFormValues) => {
    const currentAuthUser = auth.currentUser; 
    if (!currentAuthUser || !currentUserProfile) { toast({ title: "Auth Error", description: "User not authenticated.", variant: "destructive" }); return; }
    if (!croppedHighlightFileForPost) { toast({ title: "Validation Error", description: "Please select and crop an image highlight.", variant: "destructive" }); return; }
    
    setIsSubmittingPostFromDialog(true); // Indicate overall submission start
    setIsUploadingHighlight(true); // Specific for image upload phase
    let idToken: string | null = null;
    let uploadedHighlightUrl: string | null = null;

    try {
      idToken = await currentAuthUser.getIdToken(true);
      if (!idToken) throw new Error("Failed to retrieve authentication token.");
      
      const highlightFormData = new FormData();
      highlightFormData.append('highlightImage', croppedHighlightFileForPost);
      const highlightResult = await addPhotoHighlightAction(dataFromForm.planId, highlightFormData, idToken);
      setIsUploadingHighlight(false); // Image upload phase ends
      
      if (!highlightResult.success || !highlightResult.updatedPlan?.photoHighlights || highlightResult.updatedPlan.photoHighlights.length === 0) {
        throw new Error(highlightResult.error || "Could not upload highlight image or retrieve its URL.");
      }
      uploadedHighlightUrl = highlightResult.updatedPlan.photoHighlights[highlightResult.updatedPlan.photoHighlights.length - 1];
      if (!uploadedHighlightUrl) throw new Error("Could not retrieve the new highlight URL after upload.");
      
      const selectedPlanDetails = userCompletedPlans.find(p => p.id === dataFromForm.planId) || { id: dataFromForm.planId, name: "Selected Plan" };
      const postDataForAction = {
        planId: selectedPlanDetails.id, planName: selectedPlanDetails.name || 'A Plan',
        highlightImageUrl: uploadedHighlightUrl, postText: dataFromForm.caption, 
        visibility: dataFromForm.isPublic ? 'public' : 'private' as FeedPostVisibility,
      };
      
      const postResult = await createFeedPostAction(postDataForAction, idToken);
      if (postResult.success) {
        toast({ title: "Post Shared!", description: "Your highlight has been shared to the feed." });
        setIsCreatePostDialogOpen(false); resetCreatePostDialogStates(); router.refresh();
      } else throw new Error(postResult.error || "Could not share to feed.");
    } catch (error: any) {
      console.error("Error creating post from AppLayout dialog:", error);
      toast({ title: "Error Creating Post", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setIsUploadingHighlight(false); // Ensure this is false if any error occurs
    } finally {
      setIsSubmittingPostFromDialog(false); // Overall submission ends
    }
  };

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const isOnboardingPage = pathname === '/onboarding';
  const isIndividualChatPage = pathname.startsWith('/messages/') && pathname !== '/messages';
  const isPlanDetailPage = pathname.startsWith('/plans/') && pathname.split('/').length > 3 && !pathname.includes('/create') && !pathname.includes('/generate') && !pathname.includes('/category/') && !pathname.includes('/city/');
  const isPlanCategoryPage = pathname.startsWith('/plans/category/');
  const isPlanCityPage = pathname.startsWith('/plans/city/');
  const isPlanGeneratePage = pathname === '/plans/generate';
  const isPlanCreatePage = pathname === '/plans/create';
  const isCollectionDetailPage = pathname.startsWith('/collections/') && pathname !== '/collections';
  const isUserSettingsPage = pathname === '/profile' || pathname === '/users/settings';
  const hideBottomNav = isOnboardingPage || isIndividualChatPage || isPlanDetailPage || isPlanCategoryPage || isPlanCityPage || isPlanGeneratePage || isPlanCreatePage || isCollectionDetailPage || isUserSettingsPage;
  const useFullWidthLayout = isIndividualChatPage || isPlanGeneratePage;
  const [isPageTabsVisible, setIsPageTabsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollThreshold = 50;
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold / 3) return;
      if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold && isPageTabsVisible) setIsPageTabsVisible(false);
      else if (currentScrollY < lastScrollY && !isPageTabsVisible) setIsPageTabsVisible(true);
      setLastScrollY(currentScrollY <= 0 ? 0 : currentScrollY);
    };
    if (pathname === '/feed' || pathname === '/explore') window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isPageTabsVisible, scrollThreshold, pathname]);
  const activePageTab = pathname === '/feed' ? '/feed' : (pathname === '/explore' ? '/explore' : '/feed');
  const handlePageTabChange = (value: string) => {
    if (value === '/feed' && pathname !== '/feed') router.push('/feed');
    else if (value === '/explore' && pathname !== '/explore') router.push('/explore');
  };
  const showPageTabs = pathname === '/feed' || pathname === '/explore';

  if (authLoading && !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (user && profileExists === null && !authLoading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {!isMobile && user && currentUserProfile && (
          <div className="fixed inset-y-0 left-0 z-30">
            <SidebarProvider> {/* ADDED SidebarProvider WRAPPER */}
              <Sidebar plansNotificationCount={plansNotificationCount} profileNotificationCount={profileNotificationCount} handleOpenCreatePostDialog={handleOpenCreatePostDialog} />
            </SidebarProvider>
          </div>
        )}
        <div className={cn("flex-1 min-h-screen", !isMobile && "md:pl-[240px] lg:pl-[256px]")}>
          <Header messagesNotificationCount={messagesNotificationCount} />
          {showPageTabs && (
            <div className={cn("sticky top-16 z-20 flex justify-center items-center transition-all duration-300 ease-in-out h-12 border-b border-border/30 bg-background/90 backdrop-blur-sm", isPageTabsVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none")}>
              <Tabs value={activePageTab} onValueChange={handlePageTabChange} className="w-full max-w-xs sm:max-w-sm"><TabsList className={cn("grid grid-cols-2 p-0.5 rounded-lg h-8 sm:h-9 w-full bg-card/70 shadow-md")}>
                  <TabsTrigger value="/feed" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded h-full px-3 py-1.5 transition-colors duration-150">For You</TabsTrigger>
                  <TabsTrigger value="/explore" className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded h-full px-3 py-1.5 transition-colors duration-150">Explore</TabsTrigger>
              </TabsList></Tabs>
            </div>
          )}
          <main className={cn("flex-1 mx-auto w-full", useFullWidthLayout ? "h-full" : (hideBottomNav ? "py-6" : "py-6 mb-16 md:mb-0"), !useFullWidthLayout && "max-w-5xl px-4 sm:px-6 lg:px-8", pageAnimationClass )}>
            {children}
          </main>
        </div>
      </div>
      {isMobile && !hideBottomNav && user && (
        <BottomNav plansNotificationCount={plansNotificationCount} profileNotificationCount={profileNotificationCount} openQuickAddMenu={() => setIsQuickAddOpen(true)} handleOpenCreatePostDialog={handleOpenCreatePostDialog} />
      )}
      <Popover open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <PopoverTrigger asChild><div /></PopoverTrigger>
        <PopoverContent side={isMobile ? "top" : "right"} align={isMobile ? "center" : "start"} className={cn("w-56 p-2 shadow-xl rounded-xl border-border/50 bg-card/95 backdrop-blur-sm", isMobile ? "mb-2 fixed bottom-16 left-1/2 -translate-x-1/2" : "ml-2")} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="grid gap-1">
            <Button variant="ghost" className="w-full justify-start text-sm h-9" asChild onClick={() => setIsQuickAddOpen(false)}><Link href="/plans/generate"><Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)</Link></Button>
            <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() =>{handleOpenCreatePostDialog(); setIsQuickAddOpen(false); }}><Edit3 className="mr-2 h-4 w-4" /> New Post</Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isCreatePostDialogOpen} onOpenChange={(open) => { setIsCreatePostDialogOpen(open); if (!open) resetCreatePostDialogStates(); }}>
        <DialogContent className="sm:max-w-md rounded-xl bg-card shadow-2xl p-0 border-transparent flex flex-col max-h-[90vh] sm:max-h-[85vh]">
          <DialogHeader className="text-left p-4 border-b border-border/30">
            <DialogTitle className="text-lg font-semibold text-foreground">Create New Post</DialogTitle>
            <DialogDescriptionComponent className="text-xs text-muted-foreground">Share a highlight from one of your completed plans.</DialogDescriptionComponent>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-3">
              <Form {...formForPostCreation}>
                <form className="space-y-3">
                  <FormItem>
                    <div 
                      onDragOver={handleDragOver} 
                      onDragLeave={handleDragLeave} 
                      onDrop={handleDrop}
                      className={cn(
                        "w-full rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground transition-colors duration-150 ease-in-out cursor-pointer relative overflow-hidden",
                        isDraggingOver && "border-primary bg-primary/10",
                        finalHighlightPreviewUrl ? "aspect-[4/3] p-0" : "h-28 p-3 hover:bg-muted/70 hover:border-primary/50"
                      )}
                      onClick={() => {
                        if (finalHighlightPreviewUrl && !isUploadingHighlight) return; 
                        if (!formForPostCreation.getValues('planId')) {
                          toast({ title: "Select a Plan First", description: "Please choose a plan before uploading an image.", variant: "default" }); return;
                        }
                        if (isUploadingHighlight || isSubmittingPostFromDialog) return;
                        highlightFileInputRefDialog.current?.click();
                      }}
                    >
                      {finalHighlightPreviewUrl ? (
                        <>
                          <NextImage src={finalHighlightPreviewUrl} alt="Highlight preview" fill style={{ objectFit: 'cover' }} data-ai-hint="upload preview" unoptimized />
                          {isUploadingHighlight && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                              <Loader2 className="h-6 w-6 animate-spin mb-1" />
                              <span className="text-xs">Uploading image...</span>
                            </div>
                          )}
                           {!isUploadingHighlight && (
                            <Button
                              type="button" variant="secondary" size="sm"
                              className="absolute top-1.5 right-1.5 text-xs h-7 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isUploadingHighlight || isSubmittingPostFromDialog) return;
                                setCroppedHighlightFileForPost(null); if (finalHighlightPreviewUrlRef.current) URL.revokeObjectURL(finalHighlightPreviewUrlRef.current);
                                setFinalHighlightPreviewUrl(null); finalHighlightPreviewUrlRef.current = null; setImageSrcForPostCropper(null);
                                if (highlightFileInputRefDialog.current) highlightFileInputRefDialog.current.value = "";
                                highlightFileInputRefDialog.current?.click();
                              }}
                              disabled={isUploadingHighlight || isSubmittingPostFromDialog}
                            >
                              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Change
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <UploadCloud className={cn("h-8 w-8 mb-1", isDraggingOver ? "text-primary" : "text-muted-foreground/70")} />
                          <span className="text-xs font-medium">{isDraggingOver ? "Drop image here" : "Drag & drop or click to upload"}</span>
                          <span className="text-[10px] text-muted-foreground/80 mt-0.5">(Max 5MB, 4:3 recommended)</span>
                        </>
                      )}
                    </div>
                     <Input 
                      id="highlight-image-upload-dialog-applayout-rhf" type="file" 
                      accept="image/png, image/jpeg, image/gif, image/webp, image/*" 
                      onChange={(e) => {
                          if (!formForPostCreation.getValues('planId')) {
                            toast({ title: "Select a Plan First", description: "Please choose a plan before uploading an image.", variant: "default" });
                            if (e.target) e.target.value = ""; return;
                          }
                          handleFileSelected(e.target.files ? e.target.files[0] : null);
                      }}
                      ref={highlightFileInputRefDialog} className="sr-only"
                      disabled={isSubmittingPostFromDialog || !formForPostCreation.getValues('planId') || isPostCropperModalOpen || isUploadingHighlight} 
                    />
                  </FormItem>
                  
                  <FormField
                    control={formForPostCreation.control}
                    name="planId"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-medium">Select Completed Plan</FormLabel>
                        {loadingCompletedPlans ? ( <div className="flex items-center text-sm text-muted-foreground h-9"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading plans...</div>
                        ) : userCompletedPlans.length === 0 ? (
                          <div className="text-sm text-muted-foreground h-auto flex flex-col items-start py-1">
                            <span>No completed plans found.</span>
                            <Link href="/plans" className="text-xs text-primary hover:underline mt-0.5" onClick={() => setIsCreatePostDialogOpen(false)}>View your plans.</Link>
                          </div>
                        ) : (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmittingPostFromDialog || loadingCompletedPlans || !croppedHighlightFileForPost}>
                            <FormControl><SelectTrigger className="text-sm h-9 bg-background border-border/30 focus:border-primary placeholder:text-muted-foreground/70"><SelectValue placeholder="Choose a plan..." /></SelectTrigger></FormControl>
                            <SelectContent>{userCompletedPlans.map(plan => (<SelectItem key={plan.id} value={plan.id} className="text-sm">{plan.name}</SelectItem>))}</SelectContent>
                        </Select>
                        )}
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={formForPostCreation.control} name="caption"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs font-medium">Caption</FormLabel>
                        <FormControl><Textarea placeholder="Write something about this highlight..." {...field} 
                          className="text-sm min-h-[60px] bg-background border-border/30 focus:border-primary placeholder:text-muted-foreground/70" 
                          disabled={isSubmittingPostFromDialog || !croppedHighlightFileForPost || isUploadingHighlight} rows={3} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={formForPostCreation.control} name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/30 p-2.5 bg-background">
                        <div className="space-y-0.5">
                          <FormLabel htmlFor="post-visibility-dialog-applayout" className="text-xs font-medium">Make Post Public</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">Anyone can see this post.</FormDescription>
                        </div>
                        <FormControl><Switch id="post-visibility-dialog-applayout" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmittingPostFromDialog || isUploadingHighlight} /></FormControl>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>
          </ScrollArea>
          <DialogFooter className="flex flex-row gap-2 p-3 border-t border-border/30">
            <Button type="button" variant="ghost" onClick={() => {setIsCreatePostDialogOpen(false); resetCreatePostDialogStates();}} disabled={isSubmittingPostFromDialog || isUploadingHighlight} className="w-full sm:w-auto h-9 text-xs text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button type="button" onClick={formForPostCreation.handleSubmit(handleCreatePostSubmit)} disabled={isSubmittingPostFromDialog || isUploadingHighlight || loadingCompletedPlans || !formForPostCreation.formState.isValid || !croppedHighlightFileForPost} className="w-full sm:w-auto h-9 text-xs">
              {(isSubmittingPostFromDialog || isUploadingHighlight) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPostCropperModalOpen} onOpenChange={(open) => {if(!open) handleCancelPostImageCropDialog(); }}>
        <DialogContent className="sm:max-w-md p-4 bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Crop Your Highlight Image</DialogTitle>
            <DialogDescriptionComponent className="text-xs">Adjust the selection for your post image. Recommended aspect ratio: 4:3.</DialogDescriptionComponent>
          </DialogHeader>
          {imageSrcForPostCropper && (
            <div className="my-4 max-h-[60vh] overflow-hidden flex justify-center items-center">
              <ReactCrop crop={postCrop} onChange={(_, percentCrop) => setPostCrop(percentCrop)} onComplete={(c) => setCompletedPostCrop(c)} aspect={4/3} minWidth={100} minHeight={75}>
                <NextImage ref={imgRefPostCropperDialog} alt="Crop me" src={imageSrcForPostCropper} width={0} height={0} sizes="100vw" style={{ display: 'block', maxHeight: '50vh', width: 'auto', height: 'auto', objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }} onLoad={onPostImageLoadInCropperDialog} unoptimized={true} />
              </ReactCrop>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end"><Button variant="outline" onClick={handleCancelPostImageCropDialog} size="sm" disabled={isUploadingHighlight || isSubmittingPostFromDialog}>Cancel</Button><Button onClick={handlePostImageCropAndSaveDialog} disabled={!completedPostCrop || isUploadingHighlight || isSubmittingPostFromDialog} size="sm">Crop & Use Image</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

