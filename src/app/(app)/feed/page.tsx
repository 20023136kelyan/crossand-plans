
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
import { getPostComments } from "@/services/feedService";
import { getUserProfile } from "@/services/userService";
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import { useRouter, useSearchParams } from 'next/navigation';

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
    <Card className="overflow-hidden border-0 shadow-lg rounded-xl mx-auto w-full mb-4 transition-all hover:shadow-xl">
      {item.mediaUrl && (
        <div className="relative w-full">
          <div className="relative aspect-square bg-muted overflow-hidden w-full">
            <Image src={item.mediaUrl} alt={item.text || `Highlight from ${item.planName}`} fill style={{ objectFit: 'cover' }} data-ai-hint="feed post image" priority={true} className="w-full h-full cursor-pointer" sizes="(max-width: 639px) 100vw, (max-width: 1023px) 672px, 768px"
              onClick={(e) => { e.stopPropagation(); onOpenDetailModal(item); }} />
            <div className="absolute top-3 left-3 right-3 backdrop-blur-md bg-black/30 rounded-full px-3 py-2 shadow-md flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5 flex-grow min-w-0">
                <Link href={`/users/${item.userId}`} className="flex-shrink-0 group">
                  <Avatar className="h-8 w-8 border border-white/20 group-hover:opacity-90 transition-opacity"><AvatarImage src={item.userAvatarUrl || undefined} alt={item.userName} data-ai-hint="person avatar" /><AvatarFallback>{userInitial}</AvatarFallback></Avatar>
                </Link>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center">
                    <Link href={`/users/${item.userId}`} className="hover:underline"><span className="font-medium text-sm text-white">{item.username || item.userName}</span></Link>
                    <VerificationBadge role={item.userRole} isVerified={item.userIsVerified} />
                    <VisibilityBadge visibility={item.visibility} isOwnPost={isOwnPost} />
                  </div>
                  <CardDescription className="text-xs text-white/80 mt-0 truncate">
                    <Link href={`/p/${item.planId}`} className="text-white/90 hover:underline font-medium">{item.planName}</Link> • {postedAtRelative}
                  </CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/20"><span className="sr-only">More options</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3.5C8.82843 3.5 9.5 2.82843 9.5 2C9.5 1.17157 8.82843 0.5 8 0.5C7.17157 0.5 6.5 1.17157 6.5 2C6.5 2.82843 7.17157 3.5 8 3.5Z" fill="currentColor"/><path d="M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z" fill="currentColor"/><path d="M8 15.5C8.82843 15.5 9.5 14.8284 9.5 14C9.5 13.1716 8.82843 12.5 8 12.5C7.17157 12.5 6.5 13.1716 6.5 14C6.5 14.8284 7.17157 15.5 8 15.5Z" fill="currentColor"/></svg></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => onHidePost(item.id)} className="cursor-pointer text-xs"><EyeOff className="mr-2 h-3.5 w-3.5"/> Hide Post</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast({ title: "Report Post", description: "Reporting feature is coming soon!", duration: 3000 })} className="cursor-pointer text-xs"><AlertTriangle className="mr-2 h-3.5 w-3.5 text-destructive/70"/> Report Post</DropdownMenuItem>
                  {isOwnPost && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => toast({ title: "Edit Post", description: "Edit feature is coming soon!", duration: 3000 })} className="cursor-pointer text-xs"><Edit3 className="mr-2 h-3.5 w-3.5"/> Edit Post</DropdownMenuItem><DropdownMenuItem onSelect={() => onRequestDeletePost(item)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs"><Trash2 className="mr-2 h-3.5 w-3.5"/> Delete Post</DropdownMenuItem></>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="absolute bottom-3 right-3 backdrop-blur-md bg-black/30 rounded-full px-4 py-2 shadow-md flex items-center gap-3 z-10">
              <Button variant="ghost" size="sm" className={cn("hover:text-red-400 p-0 h-auto flex items-center gap-1.5", optimisticLikedByCurrentUser ? "text-red-400" : "text-white")} onClick={handleLikeClick} disabled={!currentUserId} aria-pressed={optimisticLikedByCurrentUser ? true : false} aria-label={optimisticLikedByCurrentUser ? "Unlike post" : "Like post"}><Heart className={cn("h-5 w-5", optimisticLikedByCurrentUser && "fill-red-400")} /><span className="text-xs font-medium tabular-nums">{optimisticLikesCount || 349}</span></Button>
              <Button variant="ghost" size="sm" className="text-white hover:text-primary/90 p-0 h-auto flex items-center gap-1.5" onClick={() => onOpenCommentsModal(item)}><MessageSquare className="h-5 w-5" fill="none" /><span className="text-xs font-medium tabular-nums">{optimisticCommentsCount || 760}</span></Button>
              <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="text-white hover:text-primary/90 p-0 h-auto"><Share2 className="h-5 w-5" fill="none" /></Button></PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <div className="grid gap-1">
                    <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => { handleSharePost(); }}><ExternalLink className="mr-2 h-4 w-4"/> Share via Link/Native</Button>
                    <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => setIsFriendPickerOpen(true)}><Send className="mr-2 h-4 w-4"/> Share Plan with Friend</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}
      {item.text && (
        <CardContent className="pt-3 px-4 pb-4">
          <p ref={captionRef} className={cn("text-sm", !isCaptionExpanded && canShowMoreCaption && "line-clamp-3")}>{item.text}</p>
          {canShowMoreCaption && (<button className="text-muted-foreground text-xs mt-1" onClick={toggleCaptionExpansion} aria-expanded={isCaptionExpanded}>{isCaptionExpanded ? "show less" : "... more"}</button>)}
        </CardContent>
      )}
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
          <div className="flex flex-col items-center w-full pt-8"><DialogTitle className="text-lg font-semibold text-center">Comments on {post.userName}'s post</DialogTitle><DialogDescriptionComponent className="text-sm text-muted-foreground text-center mt-1">Read and add comments below. The original post text is shown for context.</DialogDescriptionComponent></div>
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
      if (authorProfile) { setAuthorForDetailModal(authorProfile); } else { throw new Error("Author profile not found."); }
    } catch (error: any) {
      console.error("Error fetching author profile for detail modal:", error);
      toast({ title: "Error", description: `Could not load author details: ${error.message}`, variant: "destructive" });
      setAuthorForDetailModal(null);
    } finally { setLoadingAuthorForDetailModal(false); }
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
    <div className="space-y-0"> {/* Removed Tabs container as it's now in AppLayout */}
      <div className={cn("mx-auto pt-4 pb-20 px-0 sm:max-w-2xl lg:max-w-3xl")}>
        {/* This is where the "For You" content will now directly live */}
        {loadingFeed && visibleFeedPosts.length === 0 && (<div className="flex min-h-[calc(100vh-15rem)] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>)}
        {!loadingFeed && visibleFeedPosts.length === 0 && (<div className="text-center py-10 text-muted-foreground min-h-[calc(100vh-15rem)] flex flex-col justify-center items-center"><PackageOpen className="mx-auto h-12 w-12 mb-4 opacity-50" /><p className="text-lg font-semibold">Your feed is looking a bit quiet.</p><p>Share your plan highlights or explore to find content!</p></div>)}
        {visibleFeedPosts.length > 0 && (
          <>
            <div className="space-y-8 sm:space-y-10">
              {visibleFeedPosts.map(item => (<FeedPostCard key={item.id} item={item} currentUserId={user?.uid} currentUserProfile={currentUserProfile} onOpenCommentsModal={openCommentsModal} onUpdatePostInList={updateFeedPostInList} onHidePost={hidePostLocally} onRequestDeletePost={handleRequestDeletePost} onOpenDetailModal={handleOpenPostDetailModal} />))}
            </div>
            {hasMore && (<div className="flex justify-center mt-6 mb-4"><Button onClick={loadMorePosts} disabled={loadingMore}>{loadingMore ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>) : ("Load More Posts")}</Button></div>)}
            {!hasMore && (<p className="text-center text-muted-foreground mt-6 mb-4">You've reached the end of the feed.</p>)}
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
    