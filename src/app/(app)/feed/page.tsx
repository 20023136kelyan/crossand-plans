
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
  DialogDescription, // Added
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ThumbsUp, MessageSquare, Share2, ExternalLink, MoreVertical, Globe, Lock as LockIcon,
  Loader2, Send, X as XIcon, ShieldCheck as AdminIcon, CheckCircle as CheckCircleIcon, Edit3, EyeOff, Trash2, AlertTriangle,
  UserCircle as UserCircleIcon, Sparkles, PackageOpen,
} from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  fetchFeedPostsAction, // For fetching initial feed
  toggleLikePostServerAction,
  addCommentToPostServerAction,
  incrementPostSharesAction,
  deleteFeedPostAction
} from '@/app/actions/feedActions';
import { createPlanShareInviteAction } from '@/app/actions/planActions'; // For sharing plan from post
import type { FeedPost, UserRoleType, FeedPostVisibility, FeedComment, UserProfile, FriendEntry, AppTimestamp } from '@/types/user';
import { formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExploreTabContent from '@/components/explore/ExploreTabContent';
import { cn } from "@/lib/utils";
import { getPostComments as getPostCommentsClient } from "@/services/feedService"; // Client SDK for comments listener
import { getUserProfile } from "@/services/userService"; // Added for PostDetailModal author fetching
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { PostDetailModal } from '@/components/feed/PostDetailModal'; // Added for PostDetailModal


const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircleIcon className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

const VisibilityBadge = ({ visibility, isOwnPost }: { visibility: FeedPostVisibility, isOwnPost: boolean }) => {
  if (visibility === 'private' && isOwnPost) {
    return <LockIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" title="Private Post" aria-label="Private Post" />;
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
  onOpenDetailModal: (post: FeedPost) => void; // Added for PostDetailModal
}

const FeedPostCard = React.memo(({
  item,
  currentUserId,
  currentUserProfile,
  onOpenCommentsModal,
  onUpdatePostInList,
  onHidePost,
  onRequestDeletePost,
  onOpenDetailModal, // Added for PostDetailModal
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
         // Temporarily unclamp to measure full height
        element.style.webkitLineClamp = 'unset';
        element.style.display = '-webkit-box';
        element.style.overflow = 'visible';
        const fullScrollHeight = element.scrollHeight;
        element.style.webkitLineClamp = ''; // Reset
        element.style.display = '';
        element.style.overflow = '';

        setCanShowMoreCaption(Math.ceil(fullScrollHeight / lineHeight) > MAX_CAPTION_LINES_COLLAPSED);
      } else {
        setCanShowMoreCaption(false);
      }
    } else {
        setCanShowMoreCaption(false);
    }
  }, [item.text, isCaptionExpanded, captionRef.current]); // Re-check if captionRef.current changes


  const toggleCaptionExpansion = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (canShowMoreCaption) {
      setIsCaptionExpanded(!isCaptionExpanded);
    }
  };

  const isOwnPost = currentUserId === item.userId;
  const userInitial = item.userName ? item.userName.charAt(0).toUpperCase() : 'U';

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
        // Sync optimistic state if server returns different values
        if (result.updatedPostFields.likedBy?.includes(currentUserId) !== !previouslyLiked) {
            setOptimisticLikedByCurrentUser(result.updatedPostFields.likedBy?.includes(currentUserId) || false);
        }
        if (result.updatedPostFields.likesCount !== (previouslyLiked ? optimisticLikesCount -1 : optimisticLikesCount +1)) {
            setOptimisticLikesCount(result.updatedPostFields.likesCount || 0);
        }
      } else {
        // Failure: Revert optimistic updates & show specific toast
        setOptimisticLikedByCurrentUser(previouslyLiked);
        setOptimisticLikesCount(prev => previouslyLiked ? prev + 1 : Math.max(0, prev - 1));
        let description = result.error || "Could not toggle like status.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND":
                description = "This post may have been deleted or is no longer available.";
                break;
            case "TRANSACTION_FAILED":
                description = "There was a temporary issue with the database. Please try again.";
                break;
            case "AUTH_TOKEN_EXPIRED":
                description = "Your session has expired. Please log in again to like posts.";
                break;
            // Add more specific errorCode checks as needed
        }
        toast({ title: "Like Error", description, variant: "destructive" });
        console.error(`Like Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
      }
    } catch (error: any) { // Catch for network errors or other issues not from the action's structured response
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
        onUpdatePostInList({
          id: item.id,
          commentsCount: result.updatedPostFields.commentsCount,
        });
        toast({title: "Comment posted!"});
      } else {
        let description = result.error || "Could not add comment.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND":
                description = "This post may have been deleted or is no longer available to comment on.";
                break;
            case "TRANSACTION_FAILED":
                description = "There was a temporary issue posting your comment. Please try again.";
                break;
            case "AUTH_TOKEN_EXPIRED":
                description = "Your session has expired. Please log in again to comment.";
                break;
            case "VALIDATION_ERROR":
                description = "Your comment seems to be invalid. Please check and try again.";
                 break;
            // Add more specific errorCode checks as needed
        }
        toast({ title: "Comment Error", description, variant: "destructive" });
        console.error(`Comment Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
      }
    } catch (error: any) { // Catch for network errors or other issues not from the action's structured response
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
        // Server-side increment failed. Log details for debugging.
        // The user will primarily see errors related to the share action itself.
        // Revert optimistic count if server increment failed.
        setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1)); 
        serverIncremented = false; // Ensure this is false if server update failed
        console.error(
            `[handleSharePost] Failed to increment share count on server for post ${item.id}. Code: ${result.errorCode}, Message: ${result.error}, Original: ${result.originalError}`
        );
        // No toast here for server count failure, as primary feedback is for the share action itself.
      }
    } catch (error: any) { // Catch for network errors or other issues not from the action's structured response
      setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1)); // Revert optimistic count
      serverIncremented = false;
      console.error("[handleSharePost] Client-side error calling incrementPostSharesAction:", error);
      // No toast here either, as the subsequent share attempt will provide user feedback.
    }

    const planUrl = `${window.location.origin}/p/${item.planId}`;
    const shareTitle = `Macaroom: ${item.planName || 'a great plan'} by ${item.userName || 'a user'}`;
    const shareText = item.text ? item.text.substring(0, 150) + (item.text.length > 150 ? '...' : '') : `Check out this experience from "${item.planName || 'a great plan'}"!`;

    const shareData = {
      title: shareTitle,
      text: shareText,
      url: planUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Shared successfully!" });
      } catch (error: any) {
        // If server increment failed earlier, optimistic count was already reverted.
        // If server increment succeeded but native share failed, we don't revert server count.
        // So, only revert if serverIncremented was false from the start OR it became false due to server error.
        if (!serverIncremented) {
            setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1));
        }
        // If server increment failed earlier, optimistic count was already reverted.
        // If server increment succeeded but native share failed, we don't revert server count.
        if (!serverIncremented) { // This check is slightly redundant if the above logic correctly sets serverIncremented
            setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1));
        }
        
        let description = "Could not share using native share feature.";
        const errorObj = error as any; // Cast to any to safely access properties
        if (errorObj?.name === 'AbortError') {
          description = "Share cancelled by user.";
        } else if (errorObj?.code === 20 || errorObj?.name === 'NotAllowedError' || (errorObj?.message && typeof errorObj.message === 'string' && errorObj.message.toLowerCase().includes('permission denied'))) {
            description = "Could not share. Please ensure your browser has permission to share, you are in a secure (HTTPS) environment, and pop-ups are not blocked. This feature might also be restricted by your current browsing environment (e.g., if embedded in an iframe).";
        } else if (errorObj?.message) {
            description = `Could not share: ${errorObj.message}`;
        }
        
        toast({ 
            title: "Share Error", 
            description, 
            variant: "destructive", 
            duration: (errorObj?.name === 'AbortError' ? 3000 : ((errorObj?.code === 20 || errorObj?.name === 'NotAllowedError') ? 10000 : 5000)) 
        });
        console.error("[handleSharePost] Native share error:", error); // Log the full error object
      }
    } else { // Fallback to clipboard if native share is not available
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareText}\n${planUrl}`);
        toast({ title: "Plan Link Copied!", description: "Plan details & link copied to clipboard." });
      } catch (err) {
        if (!serverIncremented) { // Only revert if server increment also failed
            setOptimisticSharesCount(prev => Math.max(0, (prev || 1) - 1));
        }
        const errorObj = err as any;
        let copyErrorDescription = "Could not copy link to clipboard.";
        if (errorObj?.message) {
            copyErrorDescription = `Copy failed: ${errorObj.message}`;
        }
        toast({ title: "Copy Failed", description: copyErrorDescription, variant: "destructive" });
        console.error("[handleSharePost] Clipboard copy error:", err); // Log the full error object
      }
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


  return (
    <>
    <Card className="overflow-hidden shadow-lg bg-card border-border/30 rounded-none sm:rounded-lg md:rounded-xl mx-auto w-full">
      <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4">
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <Link href={`/users/${item.userId}`} className="flex-shrink-0 group">
            <Avatar className="h-10 w-10 group-hover:opacity-80 transition-opacity">
              <AvatarImage src={item.userAvatarUrl || undefined} alt={item.userName} data-ai-hint="person avatar" />
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-grow min-w-0">
            <div className="flex items-center">
              <Link href={`/users/${item.userId}`} className="hover:underline">
                <CardTitle className="text-base sm:text-lg">{item.userName}</CardTitle>
              </Link>
              <VerificationBadge role={item.userRole} isVerified={item.userIsVerified} />
              <VisibilityBadge visibility={item.visibility} isOwnPost={isOwnPost} />
            </div>
            <CardDescription className="text-xs text-muted-foreground/80 mt-0.5">
              shared an experience from <Link href={`/plans/${item.planId}`} className="text-primary hover:underline font-medium">{item.planName}</Link> - {postedAtRelative}
            </CardDescription>
          </div>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => onHidePost(item.id)} className="cursor-pointer text-xs">
                    <EyeOff className="mr-2 h-3.5 w-3.5"/> Hide Post
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast({ title: "Report Post", description: "Reporting feature is coming soon!", duration: 3000 })} className="cursor-pointer text-xs">
                    <AlertTriangle className="mr-2 h-3.5 w-3.5 text-destructive/70"/> Report Post
                </DropdownMenuItem>
                {isOwnPost && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => toast({ title: "Edit Post", description: "Edit feature is coming soon!", duration: 3000 })} className="cursor-pointer text-xs">
                           <Edit3 className="mr-2 h-3.5 w-3.5"/> Edit Post
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onRequestDeletePost(item)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs">
                           <Trash2 className="mr-2 h-3.5 w-3.5"/> Delete Post
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      {item.mediaUrl && (
        <div 
          className="relative w-full aspect-[3/4] sm:aspect-square md:aspect-[4/3] lg:aspect-[16/9] bg-muted overflow-hidden cursor-pointer"
          onClick={() => onOpenDetailModal(item)}
        >
          <Image
            src={item.mediaUrl}
            alt={item.text || `Highlight from ${item.planName}`}
            fill
            style={{ objectFit: 'cover' }}
            data-ai-hint="feed post image"
            priority={true}
            className="rounded-none sm:rounded-t-lg md:rounded-t-xl"
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 672px, 768px"
          />
        </div>
      )}

      <div className="flex items-center justify-start gap-0 p-2 sm:p-3 border-b border-border/20">
        <Button
            variant="ghost"
            size="sm"
            className={cn("hover:text-primary flex items-center gap-1.5", optimisticLikedByCurrentUser ? "text-primary" : "text-muted-foreground")}
            onClick={handleLikeClick}
            disabled={!currentUserId}
            aria-pressed={optimisticLikedByCurrentUser}
            aria-label={optimisticLikedByCurrentUser ? "Unlike post" : "Like post"}
        >
          <ThumbsUp className={cn("h-5 w-5", optimisticLikedByCurrentUser && "fill-primary")} />
          <span className="text-xs tabular-nums">{optimisticLikesCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary flex items-center gap-1.5" onClick={() => onOpenCommentsModal(item)}>
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs tabular-nums">{optimisticCommentsCount}</span>
        </Button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
           <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary text-xs">
              <Link href={`/plans/${item.planId}`}>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> View Plan
              </Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary text-xs">
                    <Share2 className="mr-1.5 h-4 w-4" /> Share ({optimisticSharesCount})
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

      <CardContent className="px-3 sm:px-4 pt-2 pb-3 sm:pb-4 text-sm space-y-2">
        {item.text && (
           <div onClick={toggleCaptionExpansion} className={cn("max-w-prose mx-auto", canShowMoreCaption ? "cursor-pointer" : "")}>
            <p
                ref={captionRef}
                className={cn(
                    "text-foreground/90 whitespace-pre-line",
                    !isCaptionExpanded && canShowMoreCaption && `line-clamp-${MAX_CAPTION_LINES_COLLAPSED}`
                )}
            >
              {item.text}
            </p>
            {canShowMoreCaption && (
              <button className="text-xs text-muted-foreground hover:underline mt-1 inline-block focus:outline-none" onClick={toggleCaptionExpansion} aria-expanded={isCaptionExpanded}>
                {isCaptionExpanded ? "Show less" : "...show more"}
              </button>
            )}
          </div>
        )}

        {optimisticCommentsCount > 0 && (
          <Link href="#" onClick={(e) => { e.preventDefault(); onOpenCommentsModal(item); }} className="text-xs text-muted-foreground hover:underline block pt-1">
            View all {optimisticCommentsCount} comments
          </Link>
        )}
        {currentUserProfile && (
          <form onSubmit={handleCardCommentSubmit} className="flex items-center gap-2 pt-1">
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'User'} data-ai-hint="person avatar"/>
              <AvatarFallback className="text-xs">{currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : <UserCircleIcon className="h-4 w-4"/>}</AvatarFallback>
            </Avatar>
            <Input
              type="text"
              placeholder="Add a comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="h-8 text-xs flex-1 bg-muted border-transparent focus:border-primary placeholder:text-muted-foreground/70 rounded-full px-3"
              disabled={isSubmittingCardComment}
            />
            {newCommentText.trim() && (
              <Button type="submit" variant="ghost" size="icon" className="text-primary h-8 w-8 flex-shrink-0 hover:bg-primary/10" disabled={isSubmittingCardComment} aria-label="Post comment">
                  {isSubmittingCardComment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
              </Button>
            )}
          </form>
        )}
      </CardContent>
    </Card>
    <FriendPickerDialog
      open={isFriendPickerOpen}
      onOpenChange={setIsFriendPickerOpen}
      onFriendSelect={handleSharePlanWithFriendFromPost}
      title={`Share "${item.planName}" with a Friend`}
      description="Select a friend to send this plan to."
    />
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
  onCommentSubmitModal: (postId: string, text: string) => Promise<boolean>; // Changed name for clarity
  currentUserProfile: UserProfile | null; // Pass full profile
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  post,
  commentsData: initialCommentsData, // Renamed to avoid conflict with internal state
  isOpen,
  onClose,
  loading: loadingCommentsProp, // Renamed to avoid conflict
  onCommentSubmitModal,
  currentUserProfile,
}) => {
  const [newModalComment, setNewModalComment] = useState('');
  const [isSubmittingModalComment, setIsSubmittingModalComment] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Sort comments once when data changes
  const sortedCommentsData = useMemo(() => {
    return [...(initialCommentsData || [])].sort((a, b) => {
      const timeA = a.createdAt && isValid(parseISO(a.createdAt as string)) ? parseISO(a.createdAt as string).getTime() : 0;
      const timeB = b.createdAt && isValid(parseISO(b.createdAt as string)) ? parseISO(b.createdAt as string).getTime() : 0;
      return timeA - timeB;
    });
  }, [initialCommentsData]);


  useEffect(() => {
    if (isOpen && scrollAreaRef.current && sortedCommentsData.length > 0) {
      const timer = setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100); // Small delay to allow rendering
      return () => clearTimeout(timer);
    }
  }, [isOpen, sortedCommentsData]); // Rerun when comments change to scroll to bottom if new one added

  if (!post) return null;

  const handleSubmitModalComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newModalComment.trim() || !post) return;
    setIsSubmittingModalComment(true);
    const success = await onCommentSubmitModal(post.id, newModalComment.trim());
    if (success) {
      setNewModalComment('');
      // The parent (FeedPage) will optimistically update commentsForActivePost, triggering re-render
    }
    setIsSubmittingModalComment(false);
  };

  const authorInitial = post.userName ? post.userName.charAt(0).toUpperCase() : 'U';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 flex flex-col h-[85vh] sm:h-[75vh] bg-card border-border/30 rounded-t-xl sm:rounded-xl shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/30 relative"> {/* Added relative for absolute positioning of close button */}
          <div className="flex flex-col items-center w-full">
            <DialogTitle className="text-lg font-semibold text-center">Comments on {post.userName}'s post</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-center mt-1 px-4">
              Read and add comments below. The original post text is shown for context.
            </DialogDescription>
          </div>
          <DialogClose asChild className="absolute top-3 right-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <XIcon className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="px-4 pt-3 pb-2 border-b border-border/30 shrink-0">
          <div className="flex items-start gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.userAvatarUrl || undefined} alt={post.userName} data-ai-hint="person avatar"/>
              <AvatarFallback>{authorInitial}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <span className="font-semibold text-foreground/90">{post.userName}</span>
              <span className="text-foreground/80 ml-1 whitespace-pre-line line-clamp-2">{post.text}</span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-2 custom-scrollbar-vertical" ref={scrollAreaRef}>
          {loadingCommentsProp ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sortedCommentsData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {sortedCommentsData.map((comment) => {
                let commentTimestampRelative = 'just now';
                if (comment.createdAt) {
                    const dateValue = parseISO(comment.createdAt as string);
                    if (isValid(dateValue)) {
                        commentTimestampRelative = formatDistanceToNowStrict(dateValue, { addSuffix: true });
                    }
                }
                const commenterInitial = comment.userName ? comment.userName.charAt(0).toUpperCase() : 'U';
                return (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={comment.userAvatarUrl || undefined} alt={comment.userName || 'User'} data-ai-hint="person avatar"/>
                      <AvatarFallback className="text-xs">{commenterInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-xs bg-muted/50 p-2 rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="font-semibold text-foreground/90">{comment.userName || 'User'}</span>
                        <span className="text-muted-foreground/70 text-[10px]">{commentTimestampRelative}</span>
                      </div>
                      <p className="text-foreground/80 mt-0.5 whitespace-pre-line">{comment.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {currentUserProfile && (
          <form onSubmit={handleSubmitModalComment} className="p-3 border-t border-border/30 flex items-center gap-2 shrink-0 bg-background sm:rounded-b-xl">
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'User'} data-ai-hint="person avatar"/>
              <AvatarFallback className="text-xs">{currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : <UserCircleIcon className="h-4 w-4"/>}</AvatarFallback>
            </Avatar>
            <Input
              type="text"
              placeholder="Add a comment..."
              value={newModalComment}
              onChange={(e) => setNewModalComment(e.target.value)}
              className="h-9 text-sm flex-1 bg-muted border-transparent focus:border-primary placeholder:text-muted-foreground/70 rounded-full px-3.5"
              disabled={isSubmittingModalComment}
            />
            {newModalComment.trim() && (
              <Button type="submit" variant="ghost" size="icon" className="text-primary h-9 w-9 flex-shrink-0 hover:bg-primary/10" disabled={isSubmittingModalComment} aria-label="Post comment">
                  {isSubmittingModalComment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
              </Button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function FeedPage() {
  const { user, currentUserProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [activeTab, setActiveTab] = useState("forYou");

  // New state variables for pagination
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [isTabsHeaderVisible, setIsTabsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollThreshold = 50;

  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());
  const [postToDelete, setPostToDelete] = useState<FeedPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const [activePostForCommentsModal, setActivePostForCommentsModal] = useState<FeedPost | null>(null);
  const [commentsForActivePost, setCommentsForActivePost] = useState<FeedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsUnsubscribeRef = useRef<(() => void) | null>(null);

  // State for PostDetailModal
  const [activePostForDetailModal, setActivePostForDetailModal] = useState<FeedPost | null>(null);
  const [isPostDetailModalOpen, setIsPostDetailModalOpen] = useState(false);
  const [authorForDetailModal, setAuthorForDetailModal] = useState<UserProfile | null>(null);
  const [loadingAuthorForDetailModal, setLoadingAuthorForDetailModal] = useState(false);

  const fetchFeedData = useCallback(async () => {
    if (authLoading) {
      setLoadingFeed(true);
      return;
    }
    setLoadingFeed(true);
    try {
      // Pass limitCount (e.g., 20), but no lastPostCreatedAt for initial fetch
      const result = await fetchFeedPostsAction(user?.uid, 20); 
      if (result.success && result.posts) {
        setFeedPosts(result.posts);
        setNextCursor(result.nextCursor || null); // Store the next cursor
        setHasMore(!!result.nextCursor); // Update hasMore
      } else {
        toast({ title: "Error Loading Feed", description: result.error || "Could not load feed content.", variant: "destructive" });
        setFeedPosts([]);
        setHasMore(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred while loading the feed.", variant: "destructive" });
      setFeedPosts([]);
      setHasMore(false);
    } finally {
      setLoadingFeed(false);
    }
  }, [user?.uid, authLoading, toast]);

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const result = await fetchFeedPostsAction(user?.uid, 20, nextCursor); // Pass current nextCursor
      if (result.success && result.posts) {
        setFeedPosts(prevPosts => [...prevPosts, ...result.posts!]);
        setNextCursor(result.nextCursor || null);
        setHasMore(!!result.nextCursor);
      } else {
        toast({ title: "Error Loading More Posts", description: result.error || "Could not load more content.", variant: "destructive" });
        setHasMore(false); // Stop trying if there's an error
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setHasMore(false); // Stop trying if there's an error
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]); // Now only depends on fetchFeedData itself

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) < scrollThreshold / 3) return;
      if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold && isTabsHeaderVisible) setIsTabsHeaderVisible(false);
      else if (currentScrollY < lastScrollY && !isTabsHeaderVisible) setIsTabsHeaderVisible(true);
      setLastScrollY(currentScrollY <= 0 ? 0 : currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isTabsHeaderVisible, scrollThreshold]);

  const updateFeedPostInList = useCallback((updatedPostData: Partial<FeedPost> & { id: string }) => {
    setFeedPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === updatedPostData.id ? { ...p, ...updatedPostData } : p
      )
    );
    if (activePostForCommentsModal?.id === updatedPostData.id) {
        setActivePostForCommentsModal(prev => prev ? { ...prev, ...updatedPostData } : null);
    }
  }, [activePostForCommentsModal?.id]);

  const hidePostLocally = useCallback((postId: string) => {
    setHiddenPostIds(prev => new Set(prev).add(postId));
    toast({ title: "Post Hidden", description: "This post will be hidden from your feed.", duration: 3000});
  }, [toast]);

  const handleRequestDeletePost = useCallback((post: FeedPost) => {
      setPostToDelete(post);
  }, []);

  const confirmDeletePost = async () => {
    if (!postToDelete || !user) return;
    setIsDeletingPost(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token missing for delete action.");
      const result = await deleteFeedPostAction(postToDelete.id, idToken);
      if (result.success) {
        toast({ title: "Post Deleted", description: "The post has been removed." });
        setFeedPosts(prev => prev.filter(p => p.id !== postToDelete.id));
        if (activePostForCommentsModal?.id === postToDelete.id) {
            closeCommentsModal();
        }
      } else {
        throw new Error(result.error || "Failed to delete post.");
      }
    } catch (error: any) {
      toast({ title: "Delete Error", description: error.message || "Could not delete post.", variant: "destructive" });
    } finally {
      setIsDeletingPost(false);
      setPostToDelete(null);
    }
  };

  const openCommentsModal = useCallback((post: FeedPost) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to view comments.", variant: "destructive" });
      return;
    }
    // // console.log(`[FeedPage] Opening comments modal for post: ${post.id}`);
    setActivePostForCommentsModal(post);
  }, [user, toast]);

  const closeCommentsModal = useCallback(() => {
    setActivePostForCommentsModal(null);
    setCommentsForActivePost([]); // Clear comments when modal closes
    setLoadingComments(false); // Reset loading state
    if (commentsUnsubscribeRef.current) {
      // // console.log("[FeedPage] Unsubscribing from comments listener on modal close.");
      commentsUnsubscribeRef.current();
      commentsUnsubscribeRef.current = null;
    }
  }, []);

  const handleAddCommentToPost = useCallback(async (postId: string, text: string): Promise<boolean> => {
    if (!user || !currentUserProfile) {
      toast({ title: "Login Required", description: "Please log in to comment.", variant: "destructive" });
      return false;
    }
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if(!idToken) throw new Error("Authentication token not available.");
      const result = await addCommentToPostServerAction(postId, text, idToken);
      if (result.success && result.updatedPostFields && result.comment) {
        toast({ title: "Comment Added!", duration: 2000 });
        updateFeedPostInList({
            id: postId,
            commentsCount: result.updatedPostFields.commentsCount,
        });
        // Optimistic update for commentsForActivePost removed.
        // The listener (getPostCommentsClient) will handle fetching the new comment.
        return true;
      } else {
        // Handle error case based on new error structure from server action if needed
        let description = result.error || "Failed to add comment or comment data missing.";
        switch (result.errorCode) {
            case "POST_NOT_FOUND":
                description = "This post may have been deleted or is no longer available to comment on.";
                break;
            case "TRANSACTION_FAILED":
                description = "There was a temporary issue posting your comment. Please try again.";
                break;
            case "AUTH_TOKEN_EXPIRED":
                description = "Your session has expired. Please log in again to comment.";
                break;
            case "VALIDATION_ERROR":
                description = "Your comment seems to be invalid. Please check and try again.";
                 break;
        }
        toast({ title: "Comment Error", description, variant: "destructive" });
        console.error(`Add Comment Error: ${result.errorCode} - ${result.error}. Original: ${result.originalError}`);
        return false; // Ensure we return false on failure
      }
    } catch (error: any) { // Catch for network errors or other issues not from the action's structured response
      toast({ title: "Comment Error", description: error.message || "An unexpected network or client error occurred.", variant: "destructive" });
      console.error("Client-side error during add comment operation:", error);
      return false;
    }
  }, [user, currentUserProfile, toast, updateFeedPostInList]); // Removed activePostForCommentsModal?.id from dependencies

  // Effect for fetching comments when modal opens
  useEffect(() => {
    if (activePostForCommentsModal?.id && user?.uid) {
      // // console.log(`[FeedPage] Comments Modal opened for post ${activePostForCommentsModal.id}. Setting up listener.`);
      setLoadingComments(true);
      setCommentsForActivePost([]); // Clear previous comments
      if (commentsUnsubscribeRef.current) {
        commentsUnsubscribeRef.current(); // Unsubscribe from previous post if any
      }
      commentsUnsubscribeRef.current = getPostCommentsClient(
        activePostForCommentsModal.id,
        (fetchedComments) => {
          // // console.log(`[FeedPage] Comments received for ${activePostForCommentsModal.id}: ${fetchedComments.length}`);
          setCommentsForActivePost(fetchedComments);
          setLoadingComments(false);
        },
        (error) => { // Error callback for getPostCommentsClient
          console.error(`[FeedPage] Error in comments listener for post ${activePostForCommentsModal.id}:`, error);
          toast({ title: "Error Loading Comments", description: error.message || "Could not load comments.", variant: "destructive" });
          setCommentsForActivePost([]);
          setLoadingComments(false);
        }
      );
    } else {
      if (commentsUnsubscribeRef.current) {
        // // console.log("[FeedPage] Comments Modal closed or no active post. Unsubscribing.");
        commentsUnsubscribeRef.current();
        commentsUnsubscribeRef.current = null;
      }
    }
    // Cleanup listener when component unmounts or activePostForCommentsModal.id changes
    return () => {
      if (commentsUnsubscribeRef.current) {
        // // console.log("[FeedPage] Cleanup effect: Unsubscribing from comments listener.");
        commentsUnsubscribeRef.current();
        commentsUnsubscribeRef.current = null;
      }
    };
  }, [activePostForCommentsModal?.id, user?.uid, toast]); // Corrected dependency array


  // Handler for opening PostDetailModal
  const handleOpenPostDetailModal = useCallback(async (post: FeedPost) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to view post details.", variant: "destructive" });
      return;
    }
    setActivePostForDetailModal(post);
    setIsPostDetailModalOpen(true);
    setLoadingAuthorForDetailModal(true);
    setAuthorForDetailModal(null); // Clear previous author

    try {
      const authorProfile = await getUserProfile(post.userId);
      if (authorProfile) {
        setAuthorForDetailModal(authorProfile);
      } else {
        throw new Error("Author profile not found.");
      }
    } catch (error: any) {
      console.error("Error fetching author profile for detail modal:", error);
      toast({ title: "Error", description: `Could not load author details: ${error.message}`, variant: "destructive" });
      setAuthorForDetailModal(null);
      // Optionally close modal or show error in modal:
      // setIsPostDetailModalOpen(false); 
      // setActivePostForDetailModal(null);
    } finally {
      setLoadingAuthorForDetailModal(false);
    }
  }, [user, toast]);

  // Handler for closing PostDetailModal
  const handleClosePostDetailModal = useCallback(() => {
    setActivePostForDetailModal(null);
    setIsPostDetailModalOpen(false);
    setAuthorForDetailModal(null);
    setLoadingAuthorForDetailModal(false);
  }, []);

  const visibleFeedPosts = useMemo(() => {
    return feedPosts.filter(post => !hiddenPostIds.has(post.id));
  }, [feedPosts, hiddenPostIds]);

  const handleNextPost = useCallback(() => {
    if (!activePostForDetailModal) return;
    const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id);
    if (currentIndex !== -1 && currentIndex < visibleFeedPosts.length - 1) {
      handleOpenPostDetailModal(visibleFeedPosts[currentIndex + 1]);
    }
  }, [activePostForDetailModal, visibleFeedPosts, handleOpenPostDetailModal]);

  const handlePreviousPost = useCallback(() => {
    if (!activePostForDetailModal) return;
    const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id);
    if (currentIndex !== -1 && currentIndex > 0) {
      handleOpenPostDetailModal(visibleFeedPosts[currentIndex - 1]);
    }
  }, [activePostForDetailModal, visibleFeedPosts, handleOpenPostDetailModal]);

  const hasNextPost = useMemo(() => {
    if (!activePostForDetailModal) return false;
    const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id);
    return currentIndex !== -1 && currentIndex < visibleFeedPosts.length - 1;
  }, [activePostForDetailModal, visibleFeedPosts]);

  const hasPreviousPost = useMemo(() => {
    if (!activePostForDetailModal) return false;
    const currentIndex = visibleFeedPosts.findIndex(p => p.id === activePostForDetailModal.id);
    return currentIndex !== -1 && currentIndex > 0;
  }, [activePostForDetailModal, visibleFeedPosts]);

  if (authLoading && !user) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <div
          className={cn(
            "sticky top-0 z-30 flex justify-center items-center transition-all duration-300 ease-in-out h-12 sm:h-14",
            isTabsHeaderVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          )}
        >
          <TabsList className={cn(
            "grid grid-cols-2 p-0.5 rounded-lg max-w-xs sm:max-w-sm h-8 sm:h-9",
            "bg-card/70 backdrop-blur-md shadow-md",
            )}>
            <TabsTrigger
              value="forYou"
              className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded h-full px-3 py-1.5 transition-colors duration-150"
            >
              For You
            </TabsTrigger>
            <TabsTrigger
              value="explore"
              className="text-xs sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded h-full px-3 py-1.5 transition-colors duration-150"
            >
              Explore
            </TabsTrigger>
          </TabsList>
        </div>

        <div className={cn(
          "mx-auto pt-4 pb-20 px-0 sm:max-w-2xl lg:max-w-3xl", // Adjusted max-width and padding
          activeTab === "explore" && "max-w-none px-0" 
        )}>
          <TabsContent value="forYou" className="mt-0">
            {loadingFeed && visibleFeedPosts.length === 0 && (
              <div className="flex min-h-[calc(100vh-15rem)] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
            {!loadingFeed && visibleFeedPosts.length === 0 && (
              <div className="text-center py-10 text-muted-foreground min-h-[calc(100vh-15rem)] flex flex-col justify-center items-center">
                <PackageOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-semibold">Your feed is looking a bit quiet.</p>
                <p>Share your plan highlights or explore to find content!</p>
              </div>
            )}
            {!loadingFeed && visibleFeedPosts.length > 0 && (
              <>
                <div className="space-y-8 sm:space-y-10">
                  {visibleFeedPosts.map(item => (
                    <FeedPostCard
                      key={item.id}
                      item={item}
                      currentUserId={user?.uid}
                      currentUserProfile={currentUserProfile}
                      onOpenCommentsModal={openCommentsModal}
                      onUpdatePostInList={updateFeedPostInList}
                      onHidePost={hidePostLocally}
                      onRequestDeletePost={handleRequestDeletePost}
                      onOpenDetailModal={handleOpenPostDetailModal} // Pass handler
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-6 mb-4">
                    <Button onClick={loadMorePosts} disabled={loadingMore}>
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More Posts"
                      )}
                    </Button>
                  </div>
                )}
                {!hasMore && (
                  <p className="text-center text-muted-foreground mt-6 mb-4">You've reached the end of the feed.</p>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="explore" className="mt-0">
            <ExploreTabContent />
          </TabsContent>
        </div>
      </Tabs>

      <CommentsModal
        post={activePostForCommentsModal}
        commentsData={commentsForActivePost}
        isOpen={!!activePostForCommentsModal}
        onClose={closeCommentsModal}
        loading={loadingComments}
        onCommentSubmitModal={handleAddCommentToPost}
        currentUserProfile={currentUserProfile}
      />

      {activePostForDetailModal && (
        <PostDetailModal
          post={activePostForDetailModal}
          authorProfile={authorForDetailModal}
          isLoadingAuthor={loadingAuthorForDetailModal}
          isOpen={isPostDetailModalOpen}
          onClose={handleClosePostDetailModal}
          onNext={handleNextPost}
          onPrevious={handlePreviousPost}
          hasNext={hasNextPost}
          hasPrevious={hasPreviousPost}
        />
      )}

      <AlertDialog open={!!postToDelete} onOpenChange={(open) => { if(!open) setPostToDelete(null); }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete this post. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPostToDelete(null)} disabled={isDeletingPost}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeletePost} disabled={isDeletingPost} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {isDeletingPost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>} Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
