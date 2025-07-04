'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDescriptionComponent, // Aliased to avoid conflict
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  ThumbsUp,
  Heart,
  Share2,
  Send,
  Loader2,
  X as XIcon,
  UserCircle as UserCircleIcon,
  ExternalLink,
  MoreVertical,
  Trash2,
  CheckCircle,
  ShieldCheck as AdminIcon,
  Lock as LockIcon,
  EyeOff,
  AlertTriangle,
  Edit3,
  PackageOpen,
  Globe
} from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  fetchFeedPostsAction,
  toggleLikePostServerAction,
  addCommentToPostServerAction,
  incrementPostSharesAction,
  deleteFeedPostAction,
  deleteFeedCommentAction
} from '@/app/actions/feedActions';
import { createPlanShareInviteAction } from '@/app/actions/planActions';
import type { FeedPost, UserRoleType, FeedPostVisibility, FeedComment, UserProfile, FriendEntry, AppTimestamp } from '@/types/user';
import { formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
// Removed Tabs, TabsContent, TabsList, TabsTrigger from here as they move to AppLayout
// import { ExploreContent } from '@/components/explore/ExploreContent'; // Removed ExploreContent
import { cn } from "@/lib/utils";
// TEMP: getPostComments moved to clientServices for real-time updates
import { getPostComments, getUserProfile } from '@/services/clientServices';
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { extractImageGradientCached } from '@/lib/colorExtraction';

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

const VisibilityBadge = ({ visibility, isOwnPost }: { visibility: FeedPostVisibility, isOwnPost: boolean }) => {
  if (visibility === 'private' && isOwnPost) {
    return (
      <div className="inline-flex items-center" title="Private Post">
        <LockIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" aria-label="Private Post" />
      </div>
    );
  }
  return null;
};

interface FeedPostCardProps {
  item: FeedPost;
  currentUserId?: string;
  currentUserProfile: UserProfile | null;
  onOpenCommentsModal: (post: FeedPost) => void;
  onUpdatePostInList: (updatedPostData: Partial<FeedPost> & { id: string }) => void;
  onHidePost: (postId: string) => void;
  onRequestDeletePost: (post: FeedPost) => void;
  onOpenDetailModal: (post: FeedPost) => void;
}

const FeedPostCard = React.memo(({
  item,
  currentUserId,
  currentUserProfile,
  onOpenCommentsModal,
  onUpdatePostInList,
  onHidePost,
  onRequestDeletePost,
  onOpenDetailModal,
}: FeedPostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [postedAtRelative, setPostedAtRelative] = useState('just now');
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [canShowMoreCaption, setCanShowMoreCaption] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const MAX_CAPTION_LINES_COLLAPSED = 3;
  const MIN_CHARS_FOR_SHOW_MORE = 150;
  const [optimisticLikedByCurrentUser, setOptimisticLikedByCurrentUser] = useState(item.likedBy?.includes(currentUserId || "") || false);
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(item.likesCount || 0);
  const [optimisticCommentsCount, setOptimisticCommentsCount] = useState(item.commentsCount || 0);
  const [optimisticSharesCount, setOptimisticSharesCount] = useState(item.sharesCount || 0);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingCardComment, setIsSubmittingCardComment] = useState(false);
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [gradientClass, setGradientClass] = useState('bg-gradient-to-br from-gray-400/30 via-gray-500/15 to-transparent');

  useEffect(() => {
    setOptimisticLikedByCurrentUser(item.likedBy?.includes(currentUserId || "") || false);
    setOptimisticLikesCount(item.likesCount || 0);
    setOptimisticCommentsCount(item.commentsCount || 0);
    setOptimisticSharesCount(item.sharesCount || 0);
  }, [item.likedBy, item.likesCount, item.commentsCount, item.sharesCount, currentUserId]);

  useEffect(() => {
    if (item.createdAt) {
      const dateValue = parseISO(item.createdAt as string);
      if (isValid(dateValue)) {
        setPostedAtRelative(formatDistanceToNowStrict(dateValue, { addSuffix: true }));
      }
    }
  }, [item.createdAt]);

  useEffect(() => {
    if (captionRef.current) {
      const element = captionRef.current;
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      const scrollHeight = element.scrollHeight;
      if (item.text && item.text.length > MIN_CHARS_FOR_SHOW_MORE && lineHeight > 0) {
        element.style.webkitLineClamp = 'unset';
        element.style.display = '-webkit-box';
        element.style.overflow = 'visible';
        const fullScrollHeight = element.scrollHeight;
        element.style.webkitLineClamp = '';
        element.style.display = '';
        element.style.overflow = '';
        setCanShowMoreCaption(Math.ceil(fullScrollHeight / lineHeight) > MAX_CAPTION_LINES_COLLAPSED);
      } else {
        setCanShowMoreCaption(false);
      }
    } else {
        setCanShowMoreCaption(false);
    }
  }, [item.text, isCaptionExpanded, captionRef]);


  const toggleCaptionExpansion = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (canShowMoreCaption) {
      setIsCaptionExpanded(!isCaptionExpanded);
    }
  };
  const isOwnPost = currentUserId === item.userId;
  const userInitial = item.username ? item.username.charAt(0).toUpperCase() : (item.userName ? item.userName.charAt(0).toUpperCase() : 'U');

  const handleLikeClick = async () => {
    if (!user || !currentUserId) {
      toast({ title: "Login Required", description: "Please log in to like posts.", variant: "destructive" });
      return;
    }
    const previouslyLiked = optimisticLikedByCurrentUser;
    setOptimisticLikedByCurrentUser(!previouslyLiked);
    setOptimisticLikesCount(prev => previouslyLiked ? Math.max(0, prev - 1) : prev + 1);
    try {
      const idToken = await user.getIdToken(true);
      const result = await toggleLikePostServerAction(item.id, idToken);
      if (result.success && result.updatedPostFields) {
        onUpdatePostInList({
          id: item.id,
          likesCount: result.updatedPostFields.likesCount,
          likedBy: result.updatedPostFields.likedBy,
        });
        if (result.updatedPostFields.likedBy?.includes(currentUserId) !== !previouslyLiked) {
            setOptimisticLikedByCurrentUser(result.updatedPostFields.likedBy?.includes(currentUserId) || false);
        }
        if (result.updatedPostFields.likesCount !== (previouslyLiked ? optimisticLikesCount -1 : optimisticLikesCount +1)) {
            setOptimisticLikesCount(result.updatedPostFields.likesCount || 0);
        }
      } else {
        setOptimisticLikedByCurrentUser(previouslyLiked);
        setOptimisticLikesCount(prev => previouslyLiked ? prev + 1 : Math.max(0, prev - 1));
        let description = result.error || "Could not toggle like status.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND": description = "This post may have been deleted or is no longer available."; break;
            case "TRANSACTION_FAILED": description = "There was a temporary issue with the database. Please try again."; break;
            case "AUTH_TOKEN_EXPIRED": description = "Your session has expired. Please log in again to like posts."; break;
        }
        toast({ title: "Like Error", description, variant: "destructive" });
        console.error(`Like Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
      }
    } catch (error: any) {
      setOptimisticLikedByCurrentUser(previouslyLiked);
      setOptimisticLikesCount(prev => previouslyLiked ? prev + 1 : Math.max(0, prev - 1));
      toast({ title: "Like Error", description: error.message || "An unexpected network or client error occurred.", variant: "destructive" });
      console.error("Client-side error during like operation:", error);
    }
  };

  const handleCardCommentSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!newCommentText.trim() || !user || !currentUserProfile) {
      toast({ title: "Comment cannot be empty or user not logged in.", variant: "destructive" });
      return;
    }
    setIsSubmittingCardComment(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await addCommentToPostServerAction(item.id, newCommentText.trim(), idToken);
      if (result.success && result.updatedPostFields && result.comment) {
        setNewCommentText('');
        onUpdatePostInList({ id: item.id, commentsCount: result.updatedPostFields.commentsCount });
        toast({title: "Comment posted!"});
      } else {
        let description = result.error || "Could not add comment.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND": description = "This post may have been deleted or is no longer available to comment on."; break;
            case "TRANSACTION_FAILED": description = "There was a temporary issue posting your comment. Please try again."; break;
            case "AUTH_TOKEN_EXPIRED": description = "Your session has expired. Please log in again to comment."; break;
            case "VALIDATION_ERROR": description = "Your comment seems to be invalid. Please check and try again."; break;
        }
        toast({ title: "Comment Error", description, variant: "destructive" });
        console.error(`Comment Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
      }
    } catch (error: any) {
      toast({ title: "Comment Error", description: error.message || "An unexpected network or client error occurred.", variant: "destructive" });
      console.error("Client-side error during comment submission:", error);
    } finally {
      setIsSubmittingCardComment(false);
    }
  };

  const handleSharePost = async () => {
    if (!user || !currentUserId || !item) {
      toast({ title: "Error", description: "Cannot share post. User or post data missing.", variant: "destructive" });
      return;
    }
    setOptimisticSharesCount(prev => (prev || 0) + 1);
    let serverIncremented = false;
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token missing for share action.");
      const result = await incrementPostSharesAction(item.id, idToken);
      if (result.success && result.updatedPostFields) {
        onUpdatePostInList({ id: item.id, sharesCount: result.updatedPostFields.sharesCount });
        serverIncremented = true;
      } else {
        setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1)); 
        serverIncremented = false;
        console.error(`[handleSharePost] Failed to increment share count on server for post ${item.id}. Code: ${result.errorCode}, Message: ${result.error}, Original: ${result.originalError}`);
      }
    } catch (error: any) {
      setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1));
      serverIncremented = false;
      console.error("[handleSharePost] Client-side error calling incrementPostSharesAction:", error);
    }
    const planUrl = `${window.location.origin}/p/${item.planId}`;
    const shareTitle = `Macaroom: ${item.planName || 'a great plan'} by ${item.username || item.userName || 'a user'}`;
    const shareText = item.text ? item.text.substring(0, 150) + (item.text.length > 150 ? '...' : '') : `Check out this experience from "${item.planName || 'a great plan'}"!`;
    const shareData = { title: shareTitle, text: shareText, url: planUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared successfully!" });
      } catch (error: any) {
        if (!serverIncremented) { setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1)); }
        let description = "Could not share using native share feature.";
        const errorObj = error as any;
        if (errorObj?.name === 'AbortError') { description = "Share cancelled by user."; }
        else if (errorObj?.code === 20 || errorObj?.name === 'NotAllowedError' || (errorObj?.message && typeof errorObj.message === 'string' && errorObj.message.toLowerCase().includes('permission denied'))) {
            description = "Could not share. Please ensure your browser has permission to share, you are in a secure (HTTPS) environment, and pop-ups are not blocked. This feature might also be restricted by your current browsing environment (e.g., if embedded in an iframe).";
        } else if (errorObj?.message) { description = `Could not share: ${errorObj.message}`; }
        toast({ title: "Share Error", description, variant: "destructive", duration: (errorObj?.name === 'AbortError' ? 3000 : ((errorObj?.code === 20 || errorObj?.name === 'NotAllowedError') ? 10000 : 5000)) });
        console.error("[handleSharePost] Native share error:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareText}\n${planUrl}`);
        toast({ title: "Plan Link Copied!", description: "Plan details & link copied to clipboard." });
      } catch (err) {
        if (!serverIncremented) { setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1)); }
        const errorObj = err as any;
        let copyErrorDescription = "Could not copy link to clipboard.";
        if (errorObj?.message) { copyErrorDescription = `Copy failed: ${errorObj.message}`; }
        toast({ title: "Copy Failed", description: copyErrorDescription, variant: "destructive" });
        console.error("[handleSharePost] Clipboard copy error:", err);
      }
    }
  };

  const handleReportPost = async (postId: string) => {
    if (!user || !currentUserId || isReporting) {
      return;
    }
    
    setIsReporting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/reports/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          postId,
          reason: 'inappropriate_content',
          description: 'Reported from feed'
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({ title: "Post Reported", description: "Thank you for your report. We'll review it shortly." });
      } else {
        toast({ title: "Report Failed", description: result.error || "Could not report post", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Report Error", description: "An error occurred while reporting the post", variant: "destructive" });
      console.error('Error reporting post:', error);
    } finally {
      setIsReporting(false);
    }
  };

  const handleSharePlanWithFriendFromPost = async (selectedFriend: FriendEntry) => {
    if (!user || !currentUserId || !currentUserProfile || !item) {
      toast({ title: "Action Failed", description: "User not authenticated or post data missing.", variant: "destructive" });
      return;
    }
    setIsFriendPickerOpen(false);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token missing for sharing plan with friend.");
      const result = await createPlanShareInviteAction(item.planId, item.planName, selectedFriend.friendUid, idToken);
      if (result.success) {
        toast({ title: "Plan Shared!", description: `Invitation for "${item.planName}" sent to ${selectedFriend.name}.` });
      } else {
        throw new Error(result.error || "Failed to share plan with friend.");
      }
    } catch (error: any) {
      toast({ title: "Share Error", description: error.message || "Could not share plan with friend.", variant: "destructive" });
    }
  };

  // Load gradient from image asynchronously
  useEffect(() => {
    if (item.mediaUrl) {
      const loadGradient = async () => {
        try {
          const gradient = await extractImageGradientCached(
            item.mediaUrl,
            'bg-gradient-to-br from-gray-400/30 via-gray-500/15 to-transparent'
          );
          setGradientClass(gradient);
        } catch (error) {
          console.warn('Failed to extract gradient from image:', error);
          // Fallback to plan-based gradient
          const planBasedGradients = [
            'bg-gradient-to-br from-orange-400/30 via-red-400/15 to-transparent',
            'bg-gradient-to-br from-cyan-400/30 via-blue-400/15 to-transparent', 
            'bg-gradient-to-br from-green-400/30 via-teal-400/15 to-transparent',
            'bg-gradient-to-br from-purple-400/30 via-indigo-400/15 to-transparent',
            'bg-gradient-to-br from-pink-400/30 via-purple-400/15 to-transparent',
            'bg-gradient-to-br from-yellow-400/30 via-orange-400/15 to-transparent',
            'bg-gradient-to-br from-indigo-400/30 via-purple-400/15 to-transparent',
            'bg-gradient-to-br from-emerald-400/30 via-green-400/15 to-transparent',
            'bg-gradient-to-br from-amber-400/30 via-yellow-400/15 to-transparent',
            'bg-gradient-to-br from-rose-400/30 via-pink-400/15 to-transparent',
            'bg-gradient-to-br from-teal-400/30 via-cyan-400/15 to-transparent',
            'bg-gradient-to-br from-violet-400/30 via-purple-400/15 to-transparent'
          ];
          const baseString = item.planName + 'media';
          const hash = baseString.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          const fallback = planBasedGradients[Math.abs(hash) % planBasedGradients.length];
          setGradientClass(fallback);
        }
      };
      loadGradient();
    } else {
      // No media, use plan-based gradient
      const planBasedGradients = [
        'bg-gradient-to-br from-orange-400/30 via-red-400/15 to-transparent',
        'bg-gradient-to-br from-cyan-400/30 via-blue-400/15 to-transparent', 
        'bg-gradient-to-br from-green-400/30 via-teal-400/15 to-transparent',
        'bg-gradient-to-br from-purple-400/30 via-indigo-400/15 to-transparent',
        'bg-gradient-to-br from-pink-400/30 via-purple-400/15 to-transparent',
        'bg-gradient-to-br from-yellow-400/30 via-orange-400/15 to-transparent',
        'bg-gradient-to-br from-indigo-400/30 via-purple-400/15 to-transparent',
        'bg-gradient-to-br from-emerald-400/30 via-green-400/15 to-transparent',
        'bg-gradient-to-br from-amber-400/30 via-yellow-400/15 to-transparent',
        'bg-gradient-to-br from-rose-400/30 via-pink-400/15 to-transparent',
        'bg-gradient-to-br from-teal-400/30 via-cyan-400/15 to-transparent',
        'bg-gradient-to-br from-violet-400/30 via-purple-400/15 to-transparent'
      ];
      const baseString = item.planName + 'text';
      const hash = baseString.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const fallback = planBasedGradients[Math.abs(hash) % planBasedGradients.length];
      setGradientClass(fallback);
    }
  }, [item.mediaUrl, item.planName]);

  return (
    <>
    <Card className={cn("overflow-hidden border border-white/20 shadow-2xl rounded-3xl w-full max-w-md transition-all duration-500 hover:shadow-3xl hover:scale-[1.03] cursor-pointer relative transform-gpu backdrop-blur-xl bg-transparent", gradientClass)} onClick={() => onOpenDetailModal(item)}>
      {/* Light-infused glass gradient radiating from media center */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-transparent rounded-3xl transition-opacity duration-500 group-hover:opacity-70" style={{background: 'radial-gradient(ellipse at center, transparent 0%, rgba(255,255,255,0.05) 40%, transparent 100%)'}} />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-transparent rounded-3xl transition-opacity duration-500 group-hover:opacity-60" style={{background: 'radial-gradient(ellipse at 50% 60%, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%)'}} />
      {/* Enhanced glass effect with transparency */}
      <div className="absolute inset-0 backdrop-blur-md rounded-3xl transition-all duration-500 group-hover:backdrop-blur-lg" />
      {/* Header with user info */}
      <div className="relative px-3 pt-3 pb-2 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/users/${item.userId}`} className="flex-shrink-0 group/avatar" onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-10 w-10 border-2 border-white/50 shadow-lg group-hover/avatar:opacity-90 transition-all duration-300 group-hover/avatar:scale-110 ring-1 ring-white/20">
                <AvatarImage src={item.userAvatarUrl || undefined} alt={item.userName} data-ai-hint="person avatar" />
                <AvatarFallback className="bg-white/95 text-gray-800 text-sm font-semibold shadow-lg">{userInitial}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="space-y-0.5">
              <Link href={`/users/${item.userId}`} className="hover:underline transition-all duration-200" onClick={(e) => e.stopPropagation()}>
                <span className="font-bold text-sm text-white/80 drop-shadow-lg hover:text-white/90 tracking-tight">{item.username || item.userName}</span>
              </Link>
              <VerificationBadge role={item.userRole} isVerified={item.userIsVerified} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/25 backdrop-blur-md transition-all duration-300 hover:scale-110" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">More options</span>
                <MoreVertical className="h-4 w-4 drop-shadow-md" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onHidePost(item.id)} className="cursor-pointer text-xs"><EyeOff className="mr-2 h-3.5 w-3.5"/> Hide Post</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleReportPost(item.id)} className="cursor-pointer text-xs"><AlertTriangle className="mr-2 h-3.5 w-3.5 text-destructive/70"/> Report Post</DropdownMenuItem>
              {isOwnPost && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => toast({ title: "Edit Post", description: "Edit feature is coming soon!", duration: 3000 })} className="cursor-pointer text-xs"><Edit3 className="mr-2 h-3.5 w-3.5"/> Edit Post</DropdownMenuItem><DropdownMenuItem onSelect={() => onRequestDeletePost(item)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs"><Trash2 className="mr-2 h-3.5 w-3.5"/> Delete Post</DropdownMenuItem></>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Plan name with icon */}
      <div className="relative px-3 pb-2 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/95 backdrop-blur-md rounded-lg flex items-center justify-center shadow-md border border-white/40 transition-transform duration-300 hover:scale-110">
            <span className="text-orange-600 text-sm">📅</span>
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/p/${item.planId}`} className="text-white/80 font-bold text-base hover:underline drop-shadow-lg hover:text-white/90 transition-all duration-200 tracking-tight block truncate" onClick={(e) => e.stopPropagation()}>
              {item.planName}
            </Link>
            <p className="text-white/60 text-xs drop-shadow-md font-medium">{postedAtRelative}</p>
          </div>
        </div>
      </div>

      {/* Main content area with image */}
      <div className={cn("relative mx-3 rounded-xl overflow-hidden z-10 shadow-2xl ring-1 ring-white/20", item.mediaUrl ? "aspect-auto" : "h-72")}>
        {/* Subtle light glow radiating from media */}
        <div className="absolute -inset-3 opacity-25 blur-xl -z-10" style={{background: `radial-gradient(ellipse at center, ${gradientClass.includes('orange') ? 'rgba(251, 146, 60, 0.12)' : gradientClass.includes('blue') ? 'rgba(59, 130, 246, 0.12)' : gradientClass.includes('cyan') ? 'rgba(34, 211, 238, 0.12)' : gradientClass.includes('green') ? 'rgba(34, 197, 94, 0.12)' : gradientClass.includes('purple') ? 'rgba(147, 51, 234, 0.12)' : gradientClass.includes('pink') ? 'rgba(236, 72, 153, 0.12)' : gradientClass.includes('yellow') ? 'rgba(234, 179, 8, 0.12)' : gradientClass.includes('indigo') ? 'rgba(99, 102, 241, 0.12)' : gradientClass.includes('emerald') ? 'rgba(16, 185, 129, 0.12)' : gradientClass.includes('amber') ? 'rgba(245, 158, 11, 0.12)' : gradientClass.includes('rose') ? 'rgba(244, 63, 94, 0.12)' : gradientClass.includes('teal') ? 'rgba(20, 184, 166, 0.12)' : gradientClass.includes('violet') ? 'rgba(139, 92, 246, 0.12)' : 'rgba(99, 102, 241, 0.12)'} 40%, transparent 80%)`}} />
        {item.mediaUrl ? (
          <>
            <Image 
              src={item.mediaUrl} 
              alt={item.text || `Highlight from ${item.planName}`} 
              width={400} 
              height={400} 
              style={{ 
                width: '100%', 
                height: 'auto',
                maxHeight: '600px',
                objectFit: 'contain'
              }} 
              data-ai-hint="feed post image" 
              priority={true} 
              className="w-full h-auto drop-shadow-2xl" 
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 336px, 384px" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -inset-1 bg-black/20 blur-xl -z-10" />
          </>
        ) : (
          <>
            {/* Enhanced placeholder for posts without media */}
            <div className={cn("absolute inset-0", gradientClass.replace('/60', '/30').replace('/20', '/15'))} />
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-white/95 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-white/50 transition-transform duration-300 hover:scale-110">
                  <span className="text-4xl">📝</span>
                </div>
                <p className="text-white/80 font-bold text-lg drop-shadow-lg tracking-tight">Text Post</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Caption below media */}
      {item.text && (
        <div className="relative px-3 py-2 z-10">
          <p className="text-white/75 text-xs leading-snug line-clamp-2 font-medium drop-shadow-lg">{item.text}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="relative px-3 pb-3 pt-1 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className={cn("hover:text-red-400 p-0 h-auto flex items-center gap-1.5 text-white/90 hover:bg-white/30 backdrop-blur-lg rounded-full px-2.5 py-1.5 transition-all duration-300 drop-shadow-lg hover:scale-105 border border-white/30 ring-1 ring-white/20", optimisticLikedByCurrentUser ? "text-red-400 bg-white/30 scale-105" : "")} onClick={(e) => { e.stopPropagation(); handleLikeClick(); }} disabled={!currentUserId} aria-pressed={optimisticLikedByCurrentUser ? true : false} aria-label={optimisticLikedByCurrentUser ? "Unlike post" : "Like post"}>
               <Heart className={cn("h-4 w-4 drop-shadow-lg transition-transform duration-300", optimisticLikedByCurrentUser && "fill-red-400 scale-110")} />
               <span className="text-xs font-semibold tabular-nums drop-shadow-lg">{optimisticLikesCount || 0}</span>
             </Button>
             <Button variant="ghost" size="sm" className="text-white/90 hover:text-white hover:bg-white/30 backdrop-blur-lg p-0 h-auto flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-all duration-300 drop-shadow-lg hover:scale-105 border border-white/30 ring-1 ring-white/20" onClick={(e) => { e.stopPropagation(); onOpenCommentsModal(item); }}>
               <MessageSquare className="h-4 w-4 drop-shadow-lg" fill="none" />
               <span className="text-xs font-semibold tabular-nums drop-shadow-lg">{optimisticCommentsCount || 0}</span>
             </Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white/90 hover:text-white hover:bg-white/30 backdrop-blur-lg p-1.5 h-auto rounded-full transition-all duration-300 drop-shadow-lg hover:scale-110 border border-white/30 ring-1 ring-white/20" onClick={(e) => e.stopPropagation()}>
                  <Share2 className="h-4 w-4 drop-shadow-lg" fill="none" />
                </Button>
             </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="grid gap-1">
                <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => { handleSharePost(); }}>
                  <ExternalLink className="mr-2 h-4 w-4"/> Share via Link/Native
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => setIsFriendPickerOpen(true)}>
                  <Send className="mr-2 h-4 w-4"/> Share Plan with Friend
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Card>
    <FriendPickerDialog open={isFriendPickerOpen} onOpenChange={setIsFriendPickerOpen} onFriendSelect={handleSharePlanWithFriendFromPost} title={`Share "${item.planName}" with a Friend`} description="Select a friend to send this plan to." />
    </>
  );
});
FeedPostCard.displayName = 'FeedPostCard';

interface CommentsModalProps {
  post: FeedPost | null;
  commentsData: FeedComment[];
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  onCommentSubmitModal: (postId: string, text: string) => Promise<boolean>;
  currentUserProfile: UserProfile | null;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ post, commentsData: initialCommentsData, isOpen, onClose, loading: loadingCommentsProp, onCommentSubmitModal, currentUserProfile }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newModalComment, setNewModalComment] = useState('');
  const [isSubmittingModalComment, setIsSubmittingModalComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const sortedCommentsData = useMemo(() => {
    return [...(initialCommentsData || [])].sort((a, b) => {
      const timeA = a.createdAt && isValid(parseISO(a.createdAt as string)) ? parseISO(a.createdAt as string).getTime() : 0;
      const timeB = b.createdAt && isValid(parseISO(b.createdAt as string)) ? parseISO(b.createdAt as string).getTime() : 0;
      return timeA - timeB;
    });
  }, [initialCommentsData]);

  useEffect(() => {
    if (isOpen && scrollAreaRef.current && sortedCommentsData.length > 0) {
      const timer = setTimeout(() => { if (scrollAreaRef.current) { scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight; } }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sortedCommentsData]);

  if (!post) return null;
  const handleSubmitModalComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newModalComment.trim() || !post) return;
    setIsSubmittingModalComment(true);
    const success = await onCommentSubmitModal(post.id, newModalComment.trim());
    if (success) { setNewModalComment(''); }
    setIsSubmittingModalComment(false);
  };
  const authorInitial = post.username ? post.username.charAt(0).toUpperCase() : (post.userName ? post.userName.charAt(0).toUpperCase() : 'U');
  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;
    setIsDeletingComment(true);
    try {
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await deleteFeedCommentAction(post.id, commentId, idToken);
      if (result.success) {
        toast({ title: "Comment deleted" });
      } else {
        let description = result.error || "Could not delete comment.";
        switch (result.errorCode) {
          case "POST_NOT_FOUND": description = "The post this comment belongs to no longer exists."; break;
          case "COMMENT_NOT_FOUND": description = "This comment no longer exists."; break;
          case "UNAUTHORIZED": description = "You are not authorized to delete this comment."; break;
          case "AUTH_TOKEN_EXPIRED": description = "Your session has expired. Please log in again."; break;
        }
        throw new Error(description);
      }
    } catch (error: any) {
      toast({ title: "Delete Error", description: error.message || "Could not delete comment.", variant: "destructive" });
    } finally {
      setIsDeletingComment(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 flex flex-col h-[85vh] sm:h-[75vh] bg-card border-border/30 rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden" hideCloseButton>
        <DialogHeader className="p-4 border-b border-border/30">
          <DialogClose asChild><Button variant="ghost" size="icon" className="absolute top-3 right-3 h-10 w-10 rounded-full text-muted-foreground hover:bg-muted/80"><XIcon className="h-5 w-5" aria-hidden="true" /><span className="sr-only">Close comments</span></Button></DialogClose>
          <div className="flex flex-col items-center w-full pt-8"><DialogTitle className="text-lg font-semibold text-center">Comments on {post.username || post.userName}'s post</DialogTitle><DialogDescriptionComponent className="text-sm text-muted-foreground text-center mt-1">Read and add comments below. The original post text is shown for context.</DialogDescriptionComponent></div>
        </DialogHeader>
        <div className="px-4 pt-3 pb-2 border-b border-border/30 shrink-0">
          <div className="flex items-start gap-2"><Avatar className="h-8 w-8"><AvatarImage src={post.userAvatarUrl || undefined} alt={post.username || post.userName} data-ai-hint="person avatar"/><AvatarFallback>{authorInitial}</AvatarFallback></Avatar><div className="text-sm"><span className="font-semibold text-foreground/90">{post.username || post.userName}</span><span className="text-foreground/80 ml-1 whitespace-pre-line line-clamp-2">{post.text}</span></div></div>
        </div>
        <div className="flex-1 min-h-0"><ScrollArea className="h-full" ref={scrollAreaRef}><div className="px-4 py-2">
          {loadingCommentsProp ? (<div className="flex justify-center items-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>)
            : sortedCommentsData.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first!</p>)
            : (<div className="space-y-3 pb-2">{sortedCommentsData.map((comment) => {
                let commentTimestampRelative = 'just now';
                if (comment.createdAt) { const dateValue = parseISO(comment.createdAt as string); if (isValid(dateValue)) { commentTimestampRelative = formatDistanceToNowStrict(dateValue, { addSuffix: true }); }}
                const commenterInitial = comment.username ? comment.username.charAt(0).toUpperCase() : (comment.userName ? comment.userName.charAt(0).toUpperCase() : 'U');
                const isCommentOwner = user?.uid === comment.userId;
                return (<div key={comment.id} className="flex flex-col mt-0 mb-0 relative">
                  <div className="absolute -top-3 left-3 z-10 flex items-center gap-2 bg-muted/80 border border-border/30 rounded-full py-1 pl-1 pr-3 shadow-sm"><Avatar className="h-6 w-6"><AvatarImage src={comment.userAvatarUrl || undefined} alt={comment.username || comment.userName || 'User'} data-ai-hint="person avatar"/><AvatarFallback className="text-[11px]">{commenterInitial}</AvatarFallback></Avatar><span className="text-sm font-medium text-foreground">{comment.username || comment.userName || 'User'}</span></div>
                  <div className="w-full text-xs bg-background border border-border/10 p-3 pt-5 pl-4 rounded-xl shadow-sm relative group hover:bg-muted/20 transition-colors duration-200 mt-0">
                    <p className="text-foreground/90 whitespace-pre-line break-words leading-relaxed pr-6">{comment.text}</p>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      {isCommentOwner && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-3 w-3" /><span className="sr-only">Comment options</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-32"><DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer text-xs py-1.5 flex items-center" onClick={() => handleDeleteComment(comment.id)} disabled={isDeletingComment}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}
                    </div>
                    <div className="mt-1.5 text-right"><span className="text-muted-foreground text-[10px]">{commentTimestampRelative}</span></div>
                  </div>
                </div>);})}
            </div>)}
        </div></ScrollArea></div>
        {currentUserProfile && (
          <form onSubmit={handleSubmitModalComment} className="p-3 border-t border-border/30 flex items-center gap-2 shrink-0 bg-background/95 backdrop-blur-sm">
            <Avatar className="h-8 w-8"><AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'User'} data-ai-hint="person avatar"/><AvatarFallback className="text-xs">{currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : <UserCircleIcon className="h-4 w-4"/>}</AvatarFallback></Avatar>
            <textarea ref={commentInputRef} placeholder="Add a comment..." value={newModalComment}
              onChange={(e) => { setNewModalComment(e.target.value); if (commentInputRef.current) { commentInputRef.current.style.height = 'auto'; commentInputRef.current.style.height = `${Math.max(28, Math.min(120, commentInputRef.current.scrollHeight))}px`; }}}
              className="min-h-[28px] h-[28px] w-full rounded-full border border-transparent bg-muted/50 px-3.5 py-1 text-sm focus:border-primary placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden flex-1"
              disabled={isSubmittingModalComment} />
            {newModalComment.trim() && (<Button type="submit" variant="ghost" size="icon" className="text-primary h-9 w-9 flex-shrink-0 hover:bg-primary/10" disabled={isSubmittingModalComment} aria-label="Post comment">{isSubmittingModalComment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}</Button>)}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function FeedPage() {
  const { user, currentUserProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());
  const [postToDelete, setPostToDelete] = useState<FeedPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [activePostForCommentsModal, setActivePostForCommentsModal] = useState<FeedPost | null>(null);
  const [commentsForActivePost, setCommentsForActivePost] = useState<FeedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsUnsubscribeRef = useRef<(() => void) | null>(null);
  const [activePostForDetailModal, setActivePostForDetailModal] = useState<FeedPost | null>(null);
  const [isPostDetailModalOpen, setIsPostDetailModalOpen] = useState(false);
  const [authorForDetailModal, setAuthorForDetailModal] = useState<UserProfile | null>(null);
  const [loadingAuthorForDetailModal, setLoadingAuthorForDetailModal] = useState(false);

  const fetchFeedData = useCallback(async () => {
    if (authLoading) { setLoadingFeed(true); return; }
    setLoadingFeed(true);
    try {
      const result = await fetchFeedPostsAction(user?.uid, 20); 
      if (result.success && result.posts) {
        setFeedPosts(result.posts); setNextCursor(result.nextCursor || null); setHasMore(!!result.nextCursor);
      } else {
        toast({ title: "Error Loading Feed", description: result.error || "Could not load feed content.", variant: "destructive" });
        setFeedPosts([]); setHasMore(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred while loading the feed.", variant: "destructive" });
      setFeedPosts([]); setHasMore(false);
    } finally { setLoadingFeed(false); }
  }, [user?.uid, authLoading, toast]);

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await fetchFeedPostsAction(user?.uid, 20, nextCursor);
      if (result.success && result.posts) {
        setFeedPosts(prevPosts => [...prevPosts, ...result.posts!]); setNextCursor(result.nextCursor || null); setHasMore(!!result.nextCursor);
      } else {
        toast({ title: "Error Loading More Posts", description: result.error || "Could not load more content.", variant: "destructive" }); setHasMore(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" }); setHasMore(false);
    } finally { setLoadingMore(false); }
  };

  useEffect(() => { fetchFeedData(); }, [fetchFeedData]);

  const updateFeedPostInList = useCallback((updatedPostData: Partial<FeedPost> & { id: string }) => {
    setFeedPosts(prevPosts => prevPosts.map(p => p.id === updatedPostData.id ? { ...p, ...updatedPostData } : p));
    if (activePostForCommentsModal?.id === updatedPostData.id) { setActivePostForCommentsModal(prev => prev ? { ...prev, ...updatedPostData } : null); }
  }, [activePostForCommentsModal?.id]);

  const hidePostLocally = useCallback((postId: string) => {
    setHiddenPostIds(prev => new Set(prev).add(postId));
    toast({ title: "Post Hidden", description: "This post will be hidden from your feed.", duration: 3000});
  }, [toast]);

  const handleRequestDeletePost = useCallback((post: FeedPost) => { setPostToDelete(post); }, []);

  const confirmDeletePost = async () => {
    if (!postToDelete || !user) return;
    setIsDeletingPost(true);
    try {
      try { console.log("[Feed] Forcing token refresh before delete action"); await user.getIdToken(true); }
      catch (refreshError: any) { console.error("[Feed] Error refreshing token:", refreshError); }
      let idToken: string;
      try { idToken = await user.getIdToken(); console.log("[Feed] Got token for delete action, length:", idToken?.length); }
      catch (tokenError: any) { console.error("[Feed] Error getting token:", tokenError); throw new Error("Failed to get authentication token. Please try signing out and back in."); }
      if (!idToken) throw new Error("Authentication token missing for delete action.");
      const result = await deleteFeedPostAction(postToDelete.id, idToken);
      if (result.success) {
        toast({ title: "Post Deleted", description: "The post has been removed." });
        setFeedPosts(prev => prev.filter(p => p.id !== postToDelete.id));
        if (activePostForCommentsModal?.id === postToDelete.id) { closeCommentsModal(); }
      } else {
        if (result.error?.includes("Session expired")) {
          toast({ title: "Session Expired", description: "Your session has expired. The page will refresh to restore your session.", variant: "destructive" });
          setTimeout(() => window.location.reload(), 2000); return;
        }
        throw new Error(result.error || "Failed to delete post.");
      }
    } catch (error: any) {
      toast({ title: "Delete Error", description: error.message || "Could not delete post.", variant: "destructive" });
    } finally { setIsDeletingPost(false); setPostToDelete(null); }
  };

  const openCommentsModal = useCallback((post: FeedPost) => {
    if (!user) { toast({ title: "Login Required", description: "Please log in to view comments.", variant: "destructive" }); return; }
    setActivePostForCommentsModal(post);
  }, [user, toast]);

  const closeCommentsModal = useCallback(() => {
    setActivePostForCommentsModal(null); setCommentsForActivePost([]); setLoadingComments(false);
    if (commentsUnsubscribeRef.current) { commentsUnsubscribeRef.current(); commentsUnsubscribeRef.current = null; }
  }, []);

  const handleAddCommentToPost = useCallback(async (postId: string, text: string): Promise<boolean> => {
    if (!user || !currentUserProfile) {
      toast({ title: "Login Required", description: "Please log in to comment.", variant: "destructive" }); return false;
    }
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if(!idToken) throw new Error("Authentication token not available.");
      const result = await addCommentToPostServerAction(postId, text, idToken);
      if (result.success && result.updatedPostFields && result.comment) {
        toast({ title: "Comment Added!", duration: 2000 });
        updateFeedPostInList({ id: postId, commentsCount: result.updatedPostFields.commentsCount });
        return true;
      } else {
        let description = result.error || "Failed to add comment or comment data missing.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND": description = "This post may have been deleted or is no longer available to comment on."; break;
            case "TRANSACTION_FAILED": description = "There was a temporary issue posting your comment. Please try again."; break;
            case "AUTH_TOKEN_EXPIRED": description = "Your session has expired. Please log in again to comment."; break;
            case "VALIDATION_ERROR": description = "Your comment seems to be invalid. Please check and try again."; break;
        }
        toast({ title: "Comment Error", description, variant: "destructive" });
        console.error(`Add Comment Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
        return false;
      }
    } catch (error: any) {
      toast({ title: "Comment Error", description: error.message || "An unexpected network or client error occurred.", variant: "destructive" });
      console.error("Client-side error during add comment operation:", error);
      return false;
    }
  }, [user, currentUserProfile, toast, updateFeedPostInList]);

  useEffect(() => {
    if (activePostForCommentsModal?.id && user?.uid) {
      setLoadingComments(true); setCommentsForActivePost([]);
      if (commentsUnsubscribeRef.current) { commentsUnsubscribeRef.current(); }
      commentsUnsubscribeRef.current = getPostComments(activePostForCommentsModal.id, (fetchedComments) => {
        setCommentsForActivePost(fetchedComments); setLoadingComments(false);
      }, (error) => {
        console.error(`[FeedPage] Error in comments listener for post ${activePostForCommentsModal.id}:`, error);
        toast({ title: "Error Loading Comments", description: error.message || "Could not load comments.", variant: "destructive" });
        setCommentsForActivePost([]); setLoadingComments(false);
      });
    } else {
      if (commentsUnsubscribeRef.current) { commentsUnsubscribeRef.current(); commentsUnsubscribeRef.current = null; }
    }
    return () => { if (commentsUnsubscribeRef.current) { commentsUnsubscribeRef.current(); commentsUnsubscribeRef.current = null; }};
  }, [activePostForCommentsModal?.id, user?.uid, toast]);

  const handleOpenPostDetailModal = useCallback(async (post: FeedPost) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to view post details.", variant: "destructive" }); return;
    }
    setActivePostForDetailModal(post); setIsPostDetailModalOpen(true); setLoadingAuthorForDetailModal(true); setAuthorForDetailModal(null);
    try {
      const authorProfile = await getUserProfile(post.userId);
      if (authorProfile) {
        setAuthorForDetailModal(authorProfile);
      } else {
        // Instead of throwing, set to null and perhaps log a warning.
        // The modal should handle a null authorProfile gracefully.
        console.warn(`Author profile not found for userId: ${post.userId}. Modal will show limited author info.`);
        setAuthorForDetailModal(null);
        // Optionally, a less severe toast can be shown here if desired,
        // or let the modal display "User not found"
        // toast({ title: "Author Info", description: "Could not load full author details for this post.", variant: "default" });
      }
    } catch (error: any) { // This catch is for unexpected errors from getUserProfile
      console.error("Error fetching author profile for detail modal:", error);
      toast({ title: "Error", description: `Could not load author details: ${error.message}`, variant: "destructive" });
      setAuthorForDetailModal(null);
    } finally {
      setLoadingAuthorForDetailModal(false);
    }
  }, [user, toast]);

  const handleClosePostDetailModal = useCallback(() => {
    setActivePostForDetailModal(null); setIsPostDetailModalOpen(false); setAuthorForDetailModal(null); setLoadingAuthorForDetailModal(false);
  }, []);

  const visibleFeedPosts = useMemo(() => { return feedPosts.filter(post => !hiddenPostIds.has(post.id)); }, [feedPosts, hiddenPostIds]);
  const handleNextPost = useCallback(() => { if (!activePostForDetailModal) return; const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id); if (currentIndex !== -1 && currentIndex < visibleFeedPosts.length - 1) { handleOpenPostDetailModal(visibleFeedPosts[currentIndex + 1]); }}, [activePostForDetailModal, visibleFeedPosts, handleOpenPostDetailModal]);
  const handlePreviousPost = useCallback(() => { if (!activePostForDetailModal) return; const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id); if (currentIndex !== -1 && currentIndex > 0) { handleOpenPostDetailModal(visibleFeedPosts[currentIndex - 1]); }}, [activePostForDetailModal, visibleFeedPosts, handleOpenPostDetailModal]);
  const hasNextPost = useMemo(() => { if (!activePostForDetailModal) return false; const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id); return currentIndex !== -1 && currentIndex < visibleFeedPosts.length - 1; }, [activePostForDetailModal, visibleFeedPosts]);
  const hasPreviousPost = useMemo(() => { if (!activePostForDetailModal) return false; const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id); return currentIndex !== -1 && currentIndex > 0; }, [activePostForDetailModal, visibleFeedPosts]);

  if (authLoading && !user) { return (<div className="flex min-h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>); }

  return (
    <div className="min-h-screen"> {/* Removed Tabs container as it's now in AppLayout */}
      <div className="mx-auto max-w-7xl pt-6 pb-20 px-4">
        {/* This is where the "For You" content will now directly live */}
        {loadingFeed && visibleFeedPosts.length === 0 && (<div className="flex min-h-[calc(100vh-15rem)] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-gray-600" /></div>)}
        {!loadingFeed && visibleFeedPosts.length === 0 && (<div className="text-center py-10 text-gray-600 min-h-[calc(100vh-15rem)] flex flex-col justify-center items-center"><PackageOpen className="mx-auto h-12 w-12 mb-4 opacity-70" /><p className="text-lg font-semibold">Your feed is looking a bit quiet.</p><p>Share your plan highlights or explore to find content!</p></div>)}
        {visibleFeedPosts.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 justify-items-center">
              {visibleFeedPosts.map(item => (<FeedPostCard key={item.id} item={item} currentUserId={user?.uid} currentUserProfile={currentUserProfile} onOpenCommentsModal={openCommentsModal} onUpdatePostInList={updateFeedPostInList} onHidePost={hidePostLocally} onRequestDeletePost={handleRequestDeletePost} onOpenDetailModal={handleOpenPostDetailModal} />))}
            </div>
            {hasMore && (<div className="flex justify-center mt-8 mb-4"><Button onClick={loadMorePosts} disabled={loadingMore} className="bg-primary text-primary-foreground hover:bg-primary/90">{loadingMore ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>) : ("Load More Posts")}</Button></div>)}
            {!hasMore && (<p className="text-center text-gray-500 mt-8 mb-4">You've reached the end of the feed.</p>)}
          </>
        )}
      </div>
      {/* ExploreContent is no longer rendered here */}

      <CommentsModal post={activePostForCommentsModal} commentsData={commentsForActivePost} isOpen={!!activePostForCommentsModal} onClose={closeCommentsModal} loading={loadingComments} onCommentSubmitModal={handleAddCommentToPost} currentUserProfile={currentUserProfile} />
      {activePostForDetailModal && (<PostDetailModal post={activePostForDetailModal} authorProfile={authorForDetailModal} isLoadingAuthor={loadingAuthorForDetailModal} isOpen={isPostDetailModalOpen} onClose={handleClosePostDetailModal} onNext={handleNextPost} onPrevious={handlePreviousPost} hasNext={hasNextPost} hasPrevious={hasPreviousPost} />)}
      <AlertDialog open={!!postToDelete} onOpenChange={(open) => { if(!open) setPostToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Post?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this post. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setPostToDelete(null)} disabled={isDeletingPost}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeletePost} disabled={isDeletingPost} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isDeletingPost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>} Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
    