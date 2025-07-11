'use client';

import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { BottomNavFade } from '@/components/layout/BottomNavFade';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'; // Added useMemo
import type { Chat, Plan, UserProfile, AppTimestamp, FeedPostVisibility, FeedPost, UserRoleType } from '@/types/user';
import { isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { addPhotoHighlightAction } from '@/app/actions/planActions';
import { FileValidators } from '@/lib/fileValidation';
import { PlanSummaryCards } from '@/components/plans/PlanSummaryCards';
import { createFeedPostAction } from '@/app/actions/feedActions';
import { cn, commonImageExtensions } from '@/lib/utils';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Link from 'next/link';
import {
  Loader2, PlusCircle, Share2, Globe, Lock as LockIcon, Edit3, Camera, Sparkles, X as XIcon, UploadCloud,
  MessageSquare, User as UserIcon, Search, LayoutGrid, LayoutList, Wallet as WalletIcon, ChevronLeft, ImageIcon, ImagePlus, ArrowRight, ArrowLeft as BackArrowIcon, Check, ChevronsUpDown, Settings, LogOut, Crop as CropIcon, Square, RectangleVertical, Smartphone
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { auth } from '@/lib/firebase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GoogleMapsProvider } from '@/context/GoogleMapsContext';
import { getFriendUidsAdmin } from '@/services/userService.server';
import { getCompletedPlansAdmin } from '@/services/planService.server';
import { getPendingPlanSharesForUser, getPendingPlanInvitationsCount, getUserChats, getUserPlans } from '@/services/clientServices';
import { UpcomingPlansCalendar } from '@/components/plans/UpcomingPlansCalendar';

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
  // Limit pixel ratio to improve performance - use 1 for faster processing
  const pixelRatio = 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  // Use 'medium' quality for better performance
  ctx.imageSmoothingQuality = 'medium';

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
    }, 'image/jpeg', 0.8); // Use JPEG with 0.8 quality for faster processing
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
  const { user, loading: authLoading, currentUserProfile, profileExists, refreshProfileStatus, acknowledgeNewUserWelcome, isNewUserJustSignedUp, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Prevent hydration mismatch by ensuring client-side rendering
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Use stable values during SSR/hydration to prevent layout flash
  // Always return false during SSR and initial client render to ensure sidebar shows consistently
  const stableIsMobile = isClient && isMobile;

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
    
    // TODO: Replace with equivalent client-side functions or server actions
    // Temporarily commented out due to removed service files
    /*
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
        });
    }
    if (typeof getPendingPlanInvitationsCount === 'function') {
        unsubPlanInvitations = getPendingPlanInvitationsCount(currentUserId, (invitesCount) => {
          currentPlanInvitesCount = invitesCount;
          updatePlansTotal();
        });
    }
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
        });
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
    */
    
    // Temporarily set all notifications to 0
    setPlansNotificationCount(0);
    setMessagesNotificationCount(0);
    setProfileNotificationCount(0);
    
    return () => {};
  }, [currentUserId, profileExists, authLoading, user?.uid]);

  useEffect(() => {
    if (authLoading) return;
    const publicPaths = ['/login', '/signup', '/'];
    const isOnboardingRelated = pathname === '/onboarding';
    const isPublicDynamicRoute = pathname.startsWith('/p/') || pathname.startsWith('/u/'); 
    if (profileExists === null && user) return;
    
    if (user) { 
      // Check if email is verified, as it's required before onboarding
      const isEmailVerified = user.emailVerified;
      
      if (!isEmailVerified && !isPublicDynamicRoute && !publicPaths.includes(pathname)) {
        // If email is not verified, keep user on current page to allow verification
        // This prevents redirection loops and allows email verification UI to show
        return;
      }
      
      // Three cases for redirection:
      // 1. No profile exists and we're not on onboarding page -> go to onboarding
      // 2. Just signed up with verified email -> go to onboarding
      // 3. Has complete profile and is on public/onboarding page -> go to feed
      
      if (profileExists === false && !isOnboardingRelated) {
        // Profile doesn't exist - go to onboarding regardless of isNewUserJustSignedUp status
        // This ensures users who verify their email always go to onboarding next
        router.push('/onboarding');
      } else if (profileExists === true && (isOnboardingRelated || publicPaths.includes(pathname))) {
        // User has complete profile and is on a public page - send to feed
        router.push('/feed');
      }
    } else { 
      // No user logged in - redirect to login if not on public page
      if (!isPublicDynamicRoute && !publicPaths.includes(pathname)) router.push('/login');
    }
  }, [user, authLoading, profileExists, router, pathname, isNewUserJustSignedUp]);

  const [pageAnimationClass, setPageAnimationClass] = useState('');
  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    const currentPath = pathname; const prevPath = previousPathnameRef.current;
    if (currentPath !== prevPath) {
      // Simple fade-in animation for page transitions
      setPageAnimationClass('animate-fade-in'); 
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
  const [postAspectRatio, setPostAspectRatio] = useState<number>(3/4); // Default 3:4 portrait aspect ratio
  const [postAspectRatioLabel, setPostAspectRatioLabel] = useState<string>('3:4');
  const [croppedHighlightFileForPost, setCroppedHighlightFileForPost] = useState<File | null>(null);
  const [finalHighlightPreviewUrl, setFinalHighlightPreviewUrl] = useState<string | null>(null);
  const finalHighlightPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => { finalHighlightPreviewUrlRef.current = finalHighlightPreviewUrl; }, [finalHighlightPreviewUrl]);
  const [isSubmittingPostFromDialog, setIsSubmittingPostFromDialog] = useState(false);
  const highlightFileInputRefDialog = useRef<HTMLInputElement>(null);
  
  const [currentPostCreationStep, setCurrentPostCreationStep] = useState(1);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [planSearchTerm, setPlanSearchTerm] = useState('');
  const [isPlanPickerOpen, setIsPlanPickerOpen] = useState(false);

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
    setIsSubmittingPostFromDialog(false);
    setCurrentPostCreationStep(1); 
    setIsUploadingHighlight(false);
    setIsDraggingOver(false);
    setPlanSearchTerm('');
    setIsPlanPickerOpen(false);
    // Reset aspect ratio to default when closing entire dialog
    setPostAspectRatio(3/4);
    setPostAspectRatioLabel('3:4');
  }, [formForPostCreation]);

  const handleOpenCreatePostDialog = useCallback(async () => {
    const currentAuthUser = auth?.currentUser; 
    if (!currentAuthUser || !currentUserProfile) { 
      toast({ title: "Login Required", description: "Please log in to create a post.", variant: "destructive" }); return;
    }
    resetCreatePostDialogStates(); setIsCreatePostDialogOpen(true); setLoadingCompletedPlans(true);
    try {
      const userPlans = await getUserPlans(currentAuthUser.uid);
      const completedPlans = userPlans.filter(plan => plan.status === 'completed');
      setUserCompletedPlans(completedPlans);
      if (completedPlans.length === 0) toast({ title: "No Completed Plans", description: "You need to have completed a plan to share highlights.", variant: "default", duration: 4000 });
    } catch (error: any) { toast({ title: "Error Fetching Plans", description: error.message || "Could not fetch your completed plans.", variant: "destructive" });
    } finally { setLoadingCompletedPlans(false); }
  }, [currentUserProfile, resetCreatePostDialogStates, toast]); 

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    
    // Use centralized validation
    const validation = FileValidators.postHighlight(file);
    if (!validation.valid) {
      toast({ title: "File Validation Error", description: validation.error, variant: "destructive" });
      return;
    }
    
    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('File validation warnings:', validation.warnings);
    }
    if (currentPostCreationStep === 2 && !formForPostCreation.getValues('planId')) {
      toast({ title: "Plan Required", description: "A plan must be selected. Please go back to step 1.", variant: "default" });
      return;
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
      if (currentPostCreationStep === 2 && !formForPostCreation.getValues('planId')) {
        toast({ title: "Plan Required", description: "Please select a plan in Step 1 before uploading an image.", variant: "default" }); return;
      }
      handleFileSelected(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  const onPostImageLoadInCropperDialog = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, postAspectRatio, width, height), width, height);
    setPostCrop(initialCrop);
  }, [postAspectRatio]);

  const handlePostAspectRatioChange = useCallback((newAspectRatio: number, label: string) => {
    // Validate aspect ratio is a portrait or square ratio
    if (newAspectRatio > 1) {
      console.warn('Landscape aspect ratios are not allowed');
      return;
    }
    
    setPostAspectRatio(newAspectRatio);
    setPostAspectRatioLabel(label);
    
    // Update the crop when aspect ratio changes
    if (imgRefPostCropperDialog.current) {
      const { width, height } = imgRefPostCropperDialog.current;
      const newCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, newAspectRatio, width, height), width, height);
      setPostCrop(newCrop);
      // Convert PercentCrop to PixelCrop for completedPostCrop
      const pixelCrop: PixelCrop = {
        unit: 'px',
        x: (newCrop.x / 100) * width,
        y: (newCrop.y / 100) * height,
        width: (newCrop.width / 100) * width,
        height: (newCrop.height / 100) * height
      };
      setCompletedPostCrop(pixelCrop);
    }
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
        // Automatically advance to step 2 after successful cropping
        setCurrentPostCreationStep(2);
      } else toast({ title: "Crop Failed", description: "Could not process the cropped image.", variant: "destructive" });
    } catch (e: any) { toast({ title: "Crop Error", description: e.message || "An unexpected error occurred during cropping.", variant: "destructive" }); }
    setIsPostCropperModalOpen(false);
  };

  const handleCancelPostImageCropDialog = () => {
    setIsPostCropperModalOpen(false); setImageSrcForPostCropper(null); setPostCrop(undefined); setCompletedPostCrop(null);
    // Don't reset aspect ratio - preserve user's selection for next image
  };

  const handleCreatePostSubmit = async (dataFromForm: CreatePostFormValues) => {
    const currentAuthUser = auth?.currentUser; 
    if (!currentAuthUser || !currentUserProfile) { toast({ title: "Auth Error", description: "User not authenticated.", variant: "destructive" }); return; }
    if (!croppedHighlightFileForPost) { toast({ title: "Validation Error", description: "Please select and crop an image highlight.", variant: "destructive" }); return; }
    
    // Additional client-side file size check before submission
    const processedFileValidation = FileValidators.postHighlight(croppedHighlightFileForPost);
    if (!processedFileValidation.valid) {
      toast({ title: "Processed File Error", description: processedFileValidation.error, variant: "destructive" }); 
      return;
    }
    
    setIsSubmittingPostFromDialog(true); 
    setIsUploadingHighlight(true); 
    let idToken: string | null = null;
    let uploadedHighlightUrl: string | null = null;

    try {
      idToken = await currentAuthUser.getIdToken(true);
      if (!idToken) throw new Error("Failed to retrieve authentication token.");
      
      const highlightFormData = new FormData();
      highlightFormData.append('highlightImage', croppedHighlightFileForPost);
      const highlightResult = await addPhotoHighlightAction(dataFromForm.planId, highlightFormData, idToken);
      setIsUploadingHighlight(false); 
      
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
      setIsUploadingHighlight(false); 
    } finally {
      setIsSubmittingPostFromDialog(false); 
    }
  };

  const handleNextStep = () => setCurrentPostCreationStep(2);
  const handlePreviousStep = () => setCurrentPostCreationStep(1);
  const handleCancelDialog = () => {
    setIsCreatePostDialogOpen(false);
    resetCreatePostDialogStates();
  };

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const isOnboardingPage = pathname === '/onboarding';
  const isIndividualChatPage = pathname.startsWith('/messages/') && pathname !== '/messages';
  const isPlanDetailPage = pathname.startsWith('/plans/') && pathname.split('/').length === 3 && !pathname.includes('/create') && !pathname.includes('/generate') && !pathname.includes('/category/') && !pathname.includes('/city/');
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
    if (pathname === '/feed') window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isPageTabsVisible, scrollThreshold, pathname]);
  // Removed page tabs logic for explore/for you switch

  const filteredCompletedPlans = useMemo(() => {
    if (!planSearchTerm) return userCompletedPlans;
    return userCompletedPlans.filter(plan =>
      plan.name.toLowerCase().includes(planSearchTerm.toLowerCase())
    );
  }, [userCompletedPlans, planSearchTerm]);

  const dialogTitle = currentPostCreationStep === 1 ? "Select a Plan" : "Add Highlight Details";
  
  if (authLoading && !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (user && profileExists === null && !authLoading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <GoogleMapsProvider>
      <div className="min-h-screen bg-background">
        {/* Global Header - Only show on feed and explore pages on mobile */}
        {(stableIsMobile ? (pathname === '/feed' || pathname === '/explore') : true) && (
          <Header messagesNotificationCount={messagesNotificationCount} />
        )}
        
        {/* Three-column layout */}
        <div className={`flex ${(stableIsMobile ? (pathname === '/feed' || pathname === '/explore') : true) ? 'pt-8' : 'pt-0'}`}>
          {/* Left Sidebar */}
          {!stableIsMobile && user && currentUserProfile && (
            <div className={`fixed left-4 w-[200px] lg:w-[220px] xl:w-[240px] 2xl:w-[260px] z-30 space-y-3 ${(stableIsMobile ? (pathname === '/feed' || pathname === '/explore') : true) ? 'top-20' : 'top-4'}`}>
              {/* Main Navigation */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-4 h-fit">
                <Sidebar plansNotificationCount={plansNotificationCount} profileNotificationCount={profileNotificationCount} handleOpenCreatePostDialog={handleOpenCreatePostDialog} />
              </div>
              
              {/* Quick Settings */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-2">Quick Settings</h3>
                <div className="space-y-1">
                  <Link href="/users/settings" className="w-full flex items-center justify-start text-xs h-8 px-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <Settings className="mr-2 h-3 w-3" />
                    Settings
                  </Link>
                  <button 
                    onClick={async () => {
                      try {
                        await signOut();
                      } catch (error) {
                        console.error('Logout error:', error);
                      }
                    }}
                    className="w-full flex items-center justify-start text-xs h-8 px-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <LogOut className="mr-2 h-3 w-3" />
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Main Content */}
          <main className={cn(
            "flex-1 min-h-[calc(100vh-4rem)] md:pt-16",
            !stableIsMobile && user && currentUserProfile 
              ? pathname.startsWith('/admin') 
                ? "ml-[220px] lg:ml-[240px] xl:ml-[260px] 2xl:ml-[280px]" 
                : "ml-[220px] lg:ml-[240px] xl:ml-[260px] 2xl:ml-[280px] mr-[280px]"
              : "max-w-full"
          )}>          <div className={pathname.startsWith('/admin') ? "w-full" : "max-w-[600px] mx-auto"}>
            {/* Removed explore/for you switch tabs */}
            <div className={cn(
              "w-full", 
              useFullWidthLayout ? "h-full" : (hideBottomNav ? "py-1" : "py-1 mb-16 md:mb-0"), 
              !useFullWidthLayout && (!stableIsMobile && user && currentUserProfile ? (pathname.startsWith('/admin') ? "px-6" : "px-4 sm:px-6") : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"), 
              pageAnimationClass
            )}>
                {children}
              </div>
            </div>
          </main>
          
          {/* Right Sidebar - Quick Actions and Plans */}
          {!stableIsMobile && user && currentUserProfile && !pathname.startsWith('/admin') && (
            <div className="fixed right-4 top-16 w-64 z-30 space-y-4 mt-4">
              {/* Quick Actions Card */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-3">
                <h3 className="text-xs font-medium mb-2 text-muted-foreground">Quick Actions</h3>
                <div className="grid gap-1.5">
                  <Button variant="ghost" className="w-full justify-start text-sm h-10" asChild>
                    <Link href="/plans/generate"><Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)</Link>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm h-10" onClick={handleOpenCreatePostDialog}>
                    <Camera className="mr-2 h-4 w-4" /> New Post
                  </Button>
                </div>
              </div>
              
              {/* Calendar Card */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
                <UpcomingPlansCalendar />
              </div>
              
              {/* Plan Summary Cards */}
              <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
                <PlanSummaryCards />
              </div>
            </div>
          )}
        </div>
        {stableIsMobile && !hideBottomNav && user && (
          <BottomNav plansNotificationCount={plansNotificationCount} profileNotificationCount={profileNotificationCount} openQuickAddMenu={() => setIsQuickAddOpen(true)} handleOpenCreatePostDialog={handleOpenCreatePostDialog} />
        )}
        <Popover open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
          <PopoverTrigger asChild><div /></PopoverTrigger>
          <PopoverContent side={stableIsMobile ? "top" : "right"} align={stableIsMobile ? "center" : "start"} className={cn("w-56 p-2 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50", stableIsMobile ? "mb-2 fixed bottom-16 left-1/2 -translate-x-1/2" : "ml-2")} onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="grid gap-1">
              <Button variant="ghost" className="w-full justify-start text-sm h-9" asChild onClick={() => setIsQuickAddOpen(false)}><Link href="/plans/generate"><Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)</Link></Button>
              <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={()=>{handleOpenCreatePostDialog(); setIsQuickAddOpen(false); }}><Camera className="mr-2 h-4 w-4" /> New Post</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Dialog open={isCreatePostDialogOpen} onOpenChange={(open) => { if(!open) handleCancelDialog(); else setIsCreatePostDialogOpen(true); }}>
          <DialogContent className="sm:max-w-lg w-screen h-screen sm:w-full sm:mx-4 sm:rounded-3xl rounded-none bg-gradient-to-br from-background/98 via-background/95 to-background/90 backdrop-blur-xl shadow-2xl border border-border/20 p-0 flex flex-col max-h-screen sm:max-h-[88vh] overflow-hidden">
            <DialogHeader className="relative p-6 pb-4 border-b border-gradient-to-r from-border/10 via-border/30 to-border/10">
              <div className="flex items-center justify-between mb-3">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  {currentPostCreationStep === 1 ? "Create Post" : "Share Your Story"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full transition-all duration-300", currentPostCreationStep >= 1 ? "bg-gradient-to-r from-primary to-primary/80 scale-110" : "bg-muted/50")}></div>
                    <div className={cn("w-2 h-2 rounded-full transition-all duration-300", currentPostCreationStep >= 2 ? "bg-gradient-to-r from-primary to-primary/80 scale-110" : "bg-muted/50")}></div>
                  </div>
                </div>
              </div>
              <DialogDescriptionComponent className="text-sm text-muted-foreground/80 leading-relaxed">
                {currentPostCreationStep === 1 ? "✨ Turn your completed adventures into amazing highlights" : "🎨 Add your personal touch and share with the world"}
              </DialogDescriptionComponent>
            </DialogHeader>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-6">
                <Form {...formForPostCreation}>
                  <form>
                    {currentPostCreationStep === 1 && (
                      <div className="space-y-6">
                        <FormField
                          control={formForPostCreation.control}
                          name="planId"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Choose Your Adventure
                              </FormLabel>
                              {loadingCompletedPlans ? ( 
                                <div className="flex items-center justify-center text-sm text-muted-foreground h-16 bg-muted/30 rounded-2xl border border-border/20">
                                  <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary"/> 
                                  <span>Finding your adventures...</span>
                                </div>
                              ) : userCompletedPlans.length === 0 ? (
                                <div className="text-center p-8 bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl border border-border/20">
                                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                                    <Camera className="w-8 h-8 text-primary" />
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">No completed adventures yet</p>
                                  <Link href="/plans" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors" onClick={() => setIsCreatePostDialogOpen(false)}>
                                    Explore Plans →
                                  </Link>
                                </div>
                              ) : (
                                <Popover open={isPlanPickerOpen} onOpenChange={setIsPlanPickerOpen}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between text-sm h-14 px-4 py-3 border-2 border-border/30 bg-background/50 backdrop-blur-sm rounded-2xl hover:border-primary/40 hover:bg-background/80 transition-all duration-200",
                                          !field.value && "text-muted-foreground",
                                          field.value && "border-primary/30 bg-primary/5"
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                          <span className="font-medium">
                                            {field.value ? (userCompletedPlans.find(plan => plan.id === field.value)?.name || "Select plan") : "Select your completed adventure..."}
                                          </span>
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 border-border/30 bg-background/95 backdrop-blur-xl rounded-2xl">
                                    <Command>
                                      <CommandInput
                                        placeholder="Search your adventures..."
                                        value={planSearchTerm}
                                        onValueChange={setPlanSearchTerm}
                                        className="h-12 text-sm border-0 bg-transparent"
                                      />
                                      <CommandList>
                                        <CommandEmpty className="py-6 text-center text-muted-foreground">No adventures found.</CommandEmpty>
                                        <ScrollArea className="h-[200px] custom-scrollbar-vertical">
                                          <CommandGroup className="p-2">
                                            {filteredCompletedPlans.map((plan) => (
                                              <CommandItem
                                                key={plan.id}
                                                value={plan.name} 
                                                onSelect={() => {
                                                  formForPostCreation.setValue("planId", plan.id, { shouldValidate: true });
                                                  setIsPlanPickerOpen(false);
                                                }}
                                                className="text-sm p-3 rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
                                              >
                                                <Check className={cn("mr-3 h-4 w-4 text-primary", field.value === plan.id ? "opacity-100" : "opacity-0")}/>
                                                <span className="font-medium">{plan.name}</span>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </ScrollArea>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                              <FormMessage className="text-xs text-destructive" />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {currentPostCreationStep === 2 && (
                      <div className="space-y-6">
                         {formForPostCreation.getValues('planId') && (
                          <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              <p className="text-xs font-medium text-primary/80">Selected Adventure</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground truncate">
                              {userCompletedPlans.find(p => p.id === formForPostCreation.getValues('planId'))?.name || 'Plan not found'}
                            </p>
                          </div>
                        )}
                        {/* Combined Media and Caption Container */}
                        <div className="space-y-4">
                          <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Camera className="w-4 h-4 text-primary" />
                            Add Your Photo
                          </FormLabel>
                          
                          {/* Media Container with Overlay Caption for Tall Images */}
                          <div className="relative">
                            <div 
                              onDragOver={handleDragOver} 
                              onDragLeave={handleDragLeave} 
                              onDrop={handleDrop}
                              className={cn(
                                "w-full rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer relative overflow-hidden group",
                                isDraggingOver && "border-primary bg-gradient-to-br from-primary/20 to-primary/10 scale-[1.02]",
                                finalHighlightPreviewUrl ? "aspect-[4/5] p-0 border-solid border-primary/30" : "h-40 p-6 border-border/30 hover:border-primary/50 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10",
                                !finalHighlightPreviewUrl && "flex flex-col items-center justify-center text-muted-foreground"
                              )}
                              onClick={() => {
                                if (finalHighlightPreviewUrl && !isUploadingHighlight && !isSubmittingPostFromDialog) return;
                                if (isUploadingHighlight || isSubmittingPostFromDialog) return;
                                highlightFileInputRefDialog.current?.click();
                              }}
                            >
                              {finalHighlightPreviewUrl ? (
                                <>
                                  <NextImage src={finalHighlightPreviewUrl} alt="Highlight preview" fill style={{ objectFit: 'cover' }} data-ai-hint="upload preview" unoptimized className="rounded-3xl" />
                                  {isUploadingHighlight && (
                                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-md rounded-3xl">
                                      <div className="w-16 h-16 mb-4 bg-white/20 rounded-full flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                      </div>
                                      <span className="text-sm font-medium">Uploading your photo...</span>
                                      <span className="text-xs text-white/70 mt-1">This might take a moment</span>
                                    </div>
                                  )}
                                   {!isUploadingHighlight && (
                                    <Button
                                      type="button" variant="secondary" size="sm"
                                      className="absolute top-4 right-4 text-xs h-8 px-3 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-full"
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
                                      <ImageIcon className="mr-2 h-3.5 w-3.5" /> Change
                                    </Button>
                                  )}
                                  
                                  {/* Overlay Caption for Tall Images */}
                                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent rounded-b-3xl">
                                    <FormField
                                      control={formForPostCreation.control} name="caption"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Textarea 
                                              placeholder="Share what made this adventure special... ✨" 
                                              {...field} 
                                              className="text-sm min-h-[60px] bg-black/60 backdrop-blur-md border-0 text-white placeholder:text-white/70 resize-none focus:ring-0 focus:outline-none p-3 rounded-2xl shadow-2xl border border-white/10" 
                                              disabled={isSubmittingPostFromDialog || isUploadingHighlight} 
                                              rows={2}
                                              maxLength={300}
                                            />
                                          </FormControl>
                                          <div className="flex justify-between items-center mt-3">
                                            <FormMessage className="text-xs text-red-300" />
                                            <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 border border-white/20 shadow-lg">
                                              <span className="text-xs text-white/90 font-medium">
                                                {field.value?.length || 0}/300
                                              </span>
                                            </div>
                                          </div>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="w-16 h-16 mb-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                                    <UploadCloud className={cn("h-8 w-8", isDraggingOver ? "text-primary animate-bounce" : "text-primary/70")} />
                                  </div>
                                  <span className="text-sm font-semibold mb-2">{isDraggingOver ? "Drop your photo here!" : "Upload your best shot"}</span>
                                  <span className="text-xs text-muted-foreground/80 text-center leading-relaxed">Drag & drop or click to browse<br />Max 50MB • Portrait ratios work best</span>
                                </>
                              )}
                            </div>
                            
                            <Input 
                              id="highlight-image-upload-dialog-applayout-rhf" type="file" 
                              accept="image/png, image/jpeg, image/gif, image/webp, image/*" 
                              onChange={(e) => handleFileSelected(e.target.files ? e.target.files[0] : null)}
                              ref={highlightFileInputRefDialog} className="sr-only"
                              disabled={isSubmittingPostFromDialog || isPostCropperModalOpen || isUploadingHighlight} 
                            />
                            
                            {!finalHighlightPreviewUrl && (
                              <>
                                <p className="text-xs text-muted-foreground/70 text-center mt-3">✨ You'll be able to crop and adjust after selecting</p>
                                
                                {/* Caption Field for No Image State */}
                                <div className="mt-6">
                                  <FormField
                                    control={formForPostCreation.control} name="caption"
                                    render={({ field }) => (
                                      <FormItem className="space-y-3">
                                        <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                                          <Edit3 className="w-4 h-4 text-primary" />
                                          Tell Your Story
                                        </FormLabel>
                                        <FormControl>
                                          <Textarea 
                                            placeholder="Share what made this adventure special... ✨" 
                                            {...field} 
                                            className="text-sm min-h-[80px] bg-background/50 backdrop-blur-sm border-2 border-border/30 focus:border-primary/50 focus:bg-background/80 placeholder:text-muted-foreground/60 rounded-2xl resize-none transition-all duration-200" 
                                            disabled={isSubmittingPostFromDialog || isUploadingHighlight} 
                                            rows={4}
                                            maxLength={2000}
                                          />
                                        </FormControl>
                                        <div className="flex justify-between items-center">
                                          <FormMessage className="text-xs text-destructive" />
                                          <span className="text-xs text-muted-foreground/60">
                                            {field.value?.length || 0}/2000
                                          </span>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <FormField
                          control={formForPostCreation.control} name="isPublic"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl p-4 bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-sm transition-all duration-200">
                              <div className="space-y-1">
                                <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  {field.value ? (
                                    <Globe className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <LockIcon className="w-4 h-4 text-orange-500" />
                                  )}
                                  {field.value ? "Public Post" : "Private Post"}
                                </FormLabel>
                                <FormDescription className="text-xs text-muted-foreground/80">
                                  {field.value ? "Everyone can discover and see this post" : "Only your friends can see this post"}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange} 
                                  disabled={isSubmittingPostFromDialog || isUploadingHighlight}
                                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-orange-500/20"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </form>
                </Form>
              </div>
            </ScrollArea>
            <DialogFooter className="flex flex-row gap-2 p-3 border-t border-border/30 bg-card/90 backdrop-blur-sm">
              {currentPostCreationStep === 1 && (
                <>
                  <Button type="button" onClick={handleCancelDialog} className="flex-1 h-9 text-xs text-destructive border border-destructive/40 hover:bg-destructive/10 bg-transparent transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner" disabled={isSubmittingPostFromDialog || isUploadingHighlight}>Cancel</Button>
                  <Button type="button" onClick={handleNextStep} disabled={!formForPostCreation.watch('planId') || isSubmittingPostFromDialog || isUploadingHighlight} className="flex-1 h-9 text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner">Next <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>
                </>
              )}
              {currentPostCreationStep === 2 && (
                <>
                  <Button type="button" onClick={handlePreviousStep} className="flex-1 h-9 text-xs border-primary/40 text-primary/90 hover:bg-primary/10 bg-transparent transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner" disabled={isSubmittingPostFromDialog || isUploadingHighlight}><BackArrowIcon className="mr-2 h-3.5 w-3.5" /> Back</Button>
                  <Button type="button" onClick={formForPostCreation.handleSubmit(handleCreatePostSubmit)} disabled={isSubmittingPostFromDialog || isUploadingHighlight || loadingCompletedPlans || !formForPostCreation.formState.isValid || !croppedHighlightFileForPost} className="flex-1 h-9 text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner">
                    {(isSubmittingPostFromDialog || isUploadingHighlight) && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Share Highlight
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPostCropperModalOpen} onOpenChange={(open) => {if(!open) handleCancelPostImageCropDialog(); }}>
          <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] p-0 bg-gradient-to-br from-background/95 to-background/90 backdrop-blur-xl border-2 border-border/30 shadow-2xl rounded-3xl overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-border/20">
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent flex items-center gap-3">
                <CropIcon className="w-5 h-5 text-primary" />
                Perfect Your Shot
              </DialogTitle>
              <DialogDescriptionComponent className="text-sm text-muted-foreground/80 mt-2">
                Crop and frame your highlight image • Current: {postAspectRatioLabel}
              </DialogDescriptionComponent>
            </DialogHeader>
            
            {/* Aspect Ratio Selection Buttons */}
            <div className="px-6 py-4">
              <div className="flex gap-3 p-1 bg-background/50 backdrop-blur-sm border border-border/30 rounded-2xl">
                <Button
                  type="button"
                  variant={postAspectRatio === 1 ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePostAspectRatioChange(1, '1:1')}
                  className={`flex-1 h-10 text-sm font-medium rounded-xl transition-all duration-200 ${
                    postAspectRatio === 1 
                      ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                      : 'hover:bg-background/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Square
                </Button>

                <Button
                  type="button"
                  variant={postAspectRatio === 3/4 ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePostAspectRatioChange(3/4, '3:4')}
                  className={`flex-1 h-10 text-sm font-medium rounded-xl transition-all duration-200 ${
                    postAspectRatio === 3/4 
                      ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                      : 'hover:bg-background/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RectangleVertical className="w-4 h-4 mr-2" />
                  Portrait
                </Button>
                <Button
                  type="button"
                  variant={postAspectRatio === 9/16 ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePostAspectRatioChange(9/16, '9:16')}
                  className={`flex-1 h-10 text-sm font-medium rounded-xl transition-all duration-200 ${
                    postAspectRatio === 9/16 
                      ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                      : 'hover:bg-background/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Story
                </Button>
              </div>
            </div>
            
            {imageSrcForPostCropper && (
              <div className="px-6 pb-4">
                <div className="relative bg-background/30 backdrop-blur-sm rounded-2xl border-2 border-border/30 overflow-hidden shadow-inner">
                  <div className="max-h-[50vh] overflow-hidden flex justify-center items-center p-4">
                    <ReactCrop 
                      crop={postCrop} 
                      onChange={(_, percentCrop) => setPostCrop(percentCrop)} 
                      onComplete={(c) => setCompletedPostCrop(c)} 
                      aspect={postAspectRatio} 
                      minWidth={100} 
                      minHeight={75}
                      ruleOfThirds={true}
                      circularCrop={false}
                      keepSelection={true}
                      className="max-w-full"
                    >
                      <NextImage 
                        ref={imgRefPostCropperDialog} 
                        alt="Crop me" 
                        src={imageSrcForPostCropper} 
                        width={0} 
                        height={0} 
                        sizes="100vw" 
                        style={{ 
                          display: 'block', 
                          maxHeight: '45vh', 
                          width: 'auto', 
                          height: 'auto', 
                          objectFit: 'contain', 
                          userSelect: 'none', 
                          WebkitUserSelect: 'none', 
                          touchAction: 'none' 
                        }} 
                        onLoad={onPostImageLoadInCropperDialog} 
                        unoptimized={true} 
                        priority={false}
                        className="rounded-lg"
                      />
                    </ReactCrop>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="p-6 pt-4 border-t border-border/20 bg-background/50 backdrop-blur-sm">
              <div className="flex gap-3 w-full">
                <Button 
                  variant="outline" 
                  onClick={handleCancelPostImageCropDialog} 
                  size="lg"
                  disabled={isUploadingHighlight || isSubmittingPostFromDialog}
                  className="flex-1 h-11 text-sm font-medium border-2 border-border/40 hover:border-destructive/50 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handlePostImageCropAndSaveDialog} 
                  disabled={!completedPostCrop || isUploadingHighlight || isSubmittingPostFromDialog} 
                  size="lg"
                  className="flex-1 h-11 text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Crop & Use Image
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GoogleMapsProvider>
  );
}
