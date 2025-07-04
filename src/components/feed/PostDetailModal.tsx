'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, ChevronDown, MessageSquare, Heart, Share2, ExternalLink, ShieldCheck as AdminIcon, CheckCircle, Send, Trash2, Loader2, MoreVertical, ZoomIn, ZoomOut, Copy, Bookmark, Flag, User } from "lucide-react";
import Image from 'next/image';
import type { FeedPost, FeedComment } from "@/types/user";
import type { UserProfile } from "@/types/user";
import { formatDistanceToNowStrict, parseISO, isValid } from "date-fns";
import { cn } from '@/lib/utils';
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { deleteFeedCommentAction, toggleLikePostServerAction, addCommentToPostServerAction } from "@/app/actions/feedActions";
import { getPostComments } from "@/services/clientServices";

interface PostDetailModalProps {
  post: FeedPost;
  authorProfile: UserProfile | null; 
  isLoadingAuthor?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

const VerificationBadgeModal = ({ role, isVerified }: { role: UserProfile['role'], isVerified: UserProfile['isVerified'] }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified User" />;
  }
  return null;
};

const LikeButton = ({ post }: { post: FeedPost }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [optimisticLikedByCurrentUser, setOptimisticLikedByCurrentUser] = useState<boolean>(
    user && post.likedBy ? post.likedBy.includes(user.uid) : false
  );
  const [optimisticLikesCount, setOptimisticLikesCount] = useState<number>(post.likesCount || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Update optimistic state when post changes
  useEffect(() => {
    if (user && post.likedBy) {
      setOptimisticLikedByCurrentUser(post.likedBy.includes(user.uid));
    } else {
      setOptimisticLikedByCurrentUser(false);
    }
    setOptimisticLikesCount(post.likesCount || 0);
  }, [post, user]);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to like posts." });
      return;
    }

    if (isLiking) return;
    setIsLiking(true);
    setIsAnimating(true);

    // Optimistic update
    const wasLiked = optimisticLikedByCurrentUser;
    setOptimisticLikedByCurrentUser(!wasLiked);
    setOptimisticLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    // Reset animation after a short delay
    setTimeout(() => setIsAnimating(false), 300);

    try {
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      
      const result = await toggleLikePostServerAction(post.id, idToken);
      
      if (!result.success) {
        // Revert optimistic update on failure
        setOptimisticLikedByCurrentUser(wasLiked);
        setOptimisticLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
        throw new Error(result.error || "Could not update like status.");
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Could not update like status.", 
        variant: "destructive" 
      });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("p-0 h-auto flex items-center gap-2 transition-all duration-200 hover:scale-105", 
              optimisticLikedByCurrentUser ? "text-red-500 hover:text-red-600" : "text-white hover:text-red-400")}
            onClick={handleLikeClick}
            disabled={!user || isLiking}
            aria-pressed={optimisticLikedByCurrentUser ? true : false}
            aria-label={optimisticLikedByCurrentUser ? "Unlike post" : "Like post"}
          >
            <Heart className={cn("h-5 w-5 transition-all duration-200", 
              optimisticLikedByCurrentUser ? "fill-current scale-110" : "fill-none",
              isAnimating && "animate-pulse scale-125")} />
            <span className="text-sm font-medium tabular-nums">{optimisticLikesCount}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-black/90 text-white border-white/20">
          <p>{optimisticLikedByCurrentUser ? 'Unlike' : 'Like'} this post</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const CommentsList = ({ post }: { post: FeedPost }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  useEffect(() => {
    if (!post?.id) return;

    setIsLoadingComments(true);
    const unsubscribe = getPostComments(post.id, (fetchedComments: FeedComment[]) => {
      setComments(fetchedComments);
      setIsLoadingComments(false);
    });

    return () => unsubscribe();
  }, [post?.id]);

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;
    setIsDeletingComment(true);
    try {
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await deleteFeedCommentAction(post.id, commentId, idToken);
      if (result.success) {
        // Optimistically remove the comment from the list
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast({ title: "Comment deleted" });
      } else {
        let description = result.error || "Could not delete comment.";
        switch (result.errorCode) {
          case "POST_NOT_FOUND":
            description = "The post this comment belongs to no longer exists.";
            break;
          case "COMMENT_NOT_FOUND":
            description = "This comment no longer exists.";
            break;
          case "UNAUTHORIZED":
            description = "You are not authorized to delete this comment.";
            break;
          case "AUTH_TOKEN_EXPIRED":
            description = "Your session has expired. Please log in again.";
            break;
        }
        throw new Error(description);
      }
    } catch (error: any) {
      toast({ 
        title: "Delete Error", 
        description: error.message || "Could not delete comment.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeletingComment(false);
    }
  };

  if (isLoadingComments) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">No comments yet</p>
          <p className="text-xs text-muted-foreground/70">Be the first to share your thoughts!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {comments.map((comment) => {
        let commentTimestampRelative = 'just now';
        if (comment.createdAt) {
          let dateValue: Date;
          if (typeof comment.createdAt === 'string') {
            dateValue = parseISO(comment.createdAt);
          } else if (comment.createdAt instanceof Date) {
            dateValue = comment.createdAt;
          } else if (comment.createdAt && typeof comment.createdAt.toDate === 'function') {
            // Handle Firestore Timestamp
            dateValue = comment.createdAt.toDate();
          } else {
            dateValue = new Date();
          }
          
          if (isValid(dateValue)) {
            commentTimestampRelative = formatDistanceToNowStrict(dateValue, { addSuffix: true });
          }
        }
        const commenterInitial = comment.username 
          ? comment.username.charAt(0).toUpperCase() 
          : (comment.userName ? comment.userName.charAt(0).toUpperCase() : 'U');
        const isCommentOwner = user?.uid === comment.userId;

        return (
          <div key={comment.id} className="group">
            <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 hover:bg-muted/40 transition-all duration-200 hover:shadow-sm">
              {/* Comment Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border-2 border-border/30">
                    <AvatarImage 
                      src={comment.userAvatarUrl || undefined} 
                      alt={comment.username || comment.userName || 'User'} 
                      data-ai-hint="person avatar"
                    />
                    <AvatarFallback className="text-xs font-semibold">{commenterInitial}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {comment.username || comment.userName || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground/70">•</span>
                    <span className="text-xs text-muted-foreground">{commentTimestampRelative}</span>
                  </div>
                </div>
                {isCommentOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-muted/50"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Comment options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer text-sm py-2 flex items-center"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={isDeletingComment}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {/* Comment Content */}
              <div className="pl-11">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line break-words">{comment.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// CommentInput component replaced with CommentForm

const CommentForm = ({ post, onCommentAdded }: { post: FeedPost, onCommentAdded?: () => void }) => {
  const { user, currentUserProfile } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      
      const result = await addCommentToPostServerAction(post.id, commentText.trim(), idToken);
      
      if (result.success) {
        setCommentText("");
        if (onCommentAdded) onCommentAdded();
        // The comment will be added to the list by the real-time listener
      } else {
        throw new Error(result.error || "Could not add comment.");
      }
    } catch (error: any) {
      toast({ 
        title: "Comment Error", 
        description: error.message || "Could not add comment.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Sign in to comment</p>
          <p className="text-xs text-muted-foreground/70">Join the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitComment} className="space-y-2 sm:space-y-4">
      <div className="flex items-start gap-2 sm:gap-3">
        <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border border-border/30 sm:border-2 ring-1 ring-primary/10 sm:ring-2 flex-shrink-0">
          <AvatarImage 
            src={currentUserProfile.avatarUrl || undefined} 
            alt={currentUserProfile.username || currentUserProfile.name || 'User'} 
            data-ai-hint="person avatar"
          />
          <AvatarFallback className="text-xs sm:text-sm font-semibold">
            {currentUserProfile.username 
              ? currentUserProfile.username.charAt(0).toUpperCase() 
              : (currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : 'U')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="relative">
            <textarea 
              id="detail-comment-input"
              ref={commentInputRef}
              placeholder="Add a comment..." 
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                // Auto-resize the textarea based on content
                if (commentInputRef.current) {
                  commentInputRef.current.style.height = 'auto';
                  commentInputRef.current.style.height = `${Math.max(36, Math.min(100, commentInputRef.current.scrollHeight))}px`;
                }
              }}
              className="min-h-[36px] sm:min-h-[40px] w-full rounded-lg sm:rounded-xl border border-border/30 sm:border-2 bg-background/50 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3 pr-12 sm:pr-14 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden transition-all duration-200"
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              size="sm" 
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 transition-all duration-200 hover:scale-105"
              disabled={!commentText.trim() || isSubmitting || commentText.length > 500}
            >
              {isSubmitting ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Send className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </Button>
          </div>
          {commentText.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground text-right">
              <span className={commentText.length > 500 ? 'text-destructive' : ''}>
                {commentText.length}/500
              </span>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export function PostDetailModal({
  post,
  authorProfile,
  isLoadingAuthor,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: PostDetailModalProps) {
  const { toast } = useToast();
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  if (!isOpen || !post) return null;

  const authorInitial = authorProfile?.username ? authorProfile.username.charAt(0).toUpperCase() : (authorProfile?.name ? authorProfile.name.charAt(0).toUpperCase() : 'U');
  let postedAtRelative = 'just now';
  const createdAtValid = post.createdAt && (typeof post.createdAt === 'string' || post.createdAt instanceof Date) && isValid(parseISO(post.createdAt as string));
  if (createdAtValid) {
      postedAtRelative = formatDistanceToNowStrict(parseISO(post.createdAt as string), { addSuffix: true });
  }

  // Image zoom and pan handlers
  const handleImageClick = useCallback(() => {
    if (!isImageZoomed) {
      setIsImageZoomed(true);
      setImageScale(2);
    } else {
      setIsImageZoomed(false);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
    }
  }, [isImageZoomed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isImageZoomed) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  }, [isImageZoomed, imagePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && isImageZoomed) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, isImageZoomed, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSharePost = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${authorProfile?.username || authorProfile?.name || 'User'}`,
          text: post.text || 'Check out this post!',
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: "Link copied!", description: "Post link copied to clipboard" });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [authorProfile, post.text, toast]);

  const handleCopyText = useCallback(async () => {
    if (post.text) {
      try {
        await navigator.clipboard.writeText(post.text);
        toast({ title: "Text copied!", description: "Post text copied to clipboard" });
      } catch (error) {
        console.error('Error copying text:', error);
      }
    }
  }, [post.text, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90 backdrop-blur-md" />
        <DialogContent
          className="bg-transparent border-none shadow-xl p-0 w-full h-full max-w-full max-h-full sm:max-w-5xl sm:max-h-[95vh] flex flex-col items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 sm:rounded-xl overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Hidden DialogTitle for screen readers */}
          <DialogTitle className="sr-only">
            Post by {authorProfile?.username || authorProfile?.name || 'Macaroom User'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of the post by {authorProfile?.username || authorProfile?.name || 'Macaroom User'}, including image, caption, and interaction options. Shared from plan: {post.planName || 'Not specified'}.
          </DialogDescription>

          {/* Close Button */}
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 hover:text-white shadow-md transition-all" aria-label="Close post view">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>

          {/* Navigation Buttons */}
          {hasPrevious && onPrevious && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onPrevious} 
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-50 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 hover:text-white shadow-md transition-all" 
              aria-label="Previous post"
            >
              <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          )}
          {hasNext && onNext && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onNext} 
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-50 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 hover:text-white shadow-md transition-all" 
              aria-label="Next post"
            >
              <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          )}

          <div className={cn(
            "flex flex-col h-full w-full overflow-hidden shadow-2xl bg-background/95 backdrop-blur-xl border border-border/20",
            "sm:flex-row sm:rounded-2xl" // Side-by-side layout on sm+ screens
          )}>
            {/* Image Area (Takes up more space on larger screens) */}
            <div className={cn(
              "relative bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center overflow-hidden group",
              "w-full h-3/5 sm:h-full sm:w-3/5 md:w-2/3 sm:rounded-l-2xl" // Adjust aspect ratio for mobile vs desktop
            )}>
              {post.mediaUrl ? (
                <div 
                  ref={imageContainerRef}
                  className="relative w-full h-full cursor-pointer"
                  onClick={handleImageClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <Image
                    src={post.mediaUrl}
                    alt={post.text || `Post by ${authorProfile?.username || authorProfile?.name || 'user'}`}
                    fill
                    style={{ 
                      objectFit: 'contain',
                      transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                      transition: isDragging ? 'none' : 'transform 0.3s ease-out'
                    }} 
                    data-ai-hint="feed post media"
                    unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                    priority
                    sizes="(max-width: 639px) 100vw, (max-width: 767px) 60vw, 66vw"
                    className={cn(
                      "transition-all duration-300",
                      isImageZoomed ? "cursor-grab" : "cursor-zoom-in hover:brightness-110",
                      isDragging && "cursor-grabbing"
                    )}
                  />
                  
                  {/* Zoom indicator */}
                  <div className={cn(
                    "absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-full p-2 transition-opacity duration-300",
                    "opacity-0 group-hover:opacity-100"
                  )}>
                    {isImageZoomed ? (
                      <ZoomOut className="h-4 w-4 text-white" />
                    ) : (
                      <ZoomIn className="h-4 w-4 text-white" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-white/70 text-center p-8 space-y-4">
                  <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-medium">Text-only post</p>
                  <p className="text-sm opacity-75">This post doesn't contain an image</p>
                </div>
              )}
              
              {/* Enhanced header overlay */}
              <div className="absolute top-4 left-4 right-4 backdrop-blur-xl bg-black/60 rounded-2xl px-5 py-4 shadow-xl border border-white/20 flex items-center justify-between z-10">
                {isLoadingAuthor ? (
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-full bg-white/10 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-28 bg-white/10 animate-pulse rounded" />
                      <div className="h-3 w-36 bg-white/10 animate-pulse rounded" />
                    </div>
                  </div>
                ) : (
                  <>
                    <Link href={`/users/${authorProfile?.id || post.userId}`} className="flex items-center gap-3 flex-grow min-w-0 hover:bg-white/10 rounded-xl p-1 transition-colors">
                      <Avatar className="h-9 w-9 border-2 border-white/20 ring-2 ring-white/10">
                        <AvatarImage src={authorProfile?.avatarUrl || undefined} alt={authorProfile?.username || authorProfile?.name || 'User'} data-ai-hint="person avatar" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-white font-semibold">{authorInitial}</AvatarFallback>
                      </Avatar>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-white truncate">{authorProfile?.username || authorProfile?.name || 'Macaroom User'}</span>
                          {authorProfile && <VerificationBadgeModal role={authorProfile.role} isVerified={authorProfile.isVerified} />}
                        </div>
                        <div className="text-xs text-white/70 truncate flex items-center gap-1">
                          <span>{postedAtRelative}</span>
                          {post.planName && (
                            <>
                              <span>•</span>
                              <span className="truncate">from {post.planName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/20 ml-2 transition-all duration-200">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">More options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-black/90 backdrop-blur-md border-white/20">
                        <DropdownMenuItem onClick={handleSharePost} className="text-white hover:bg-white/10">
                          <Share2 className="h-4 w-4 mr-2" />
                          Share post
                        </DropdownMenuItem>
                        {post.text && (
                          <DropdownMenuItem onClick={handleCopyText} className="text-white hover:bg-white/10">
                            <Copy className="h-4 w-4 mr-2" />
                            Copy text
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-white hover:bg-white/10">
                          <Bookmark className="h-4 w-4 mr-2" />
                          Save post
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 hover:bg-red-500/10">
                          <Flag className="h-4 w-4 mr-2" />
                          Report
                        </DropdownMenuItem>
                        {post.planName && (
                          <DropdownMenuItem asChild>
                            <Link href={`/p/${post.planId}`} className="text-white hover:bg-white/10">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View plan
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
              
              {/* Enhanced action bar overlay */}
              <div className="absolute bottom-4 left-4 right-4 backdrop-blur-xl bg-black/60 rounded-2xl px-5 py-4 shadow-xl border border-white/20 flex items-center justify-between z-10">
                <div className="flex items-center gap-6">
                  <LikeButton post={post} />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-white hover:text-blue-400 p-0 h-auto flex items-center gap-2 transition-all duration-200 hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation();
                            const commentInput = document.getElementById('detail-comment-input');
                            if (commentInput) {
                              commentInput.focus();
                            }
                          }}
                        >
                          <MessageSquare className="h-5 w-5" fill="none" />
                          <span className="text-sm font-medium tabular-nums">{post.commentsCount || 0}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/20">
                        <p>Add a comment</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-white hover:text-green-400 p-0 h-auto transition-all duration-200 hover:scale-105"
                          onClick={handleSharePost}
                        >
                          <Share2 className="h-5 w-5" fill="none" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/20">
                        <p>Share post</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Plan link badge */}
                {post.planName && post.planId && (
                  <Link href={`/p/${post.planId}`}>
                    <Badge 
                      variant="secondary" 
                      className="bg-white/10 text-white border-white/20 hover:bg-white/20 transition-all duration-200 cursor-pointer backdrop-blur-sm"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Plan
                    </Badge>
                  </Link>
                )}
              </div>
            </div>

            {/* Content & Comments expandable drawer - Desktop layout */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0 z-20 bg-background/98 backdrop-blur-xl",
              "sm:relative sm:flex sm:flex-col sm:bg-background/98 sm:backdrop-blur-xl sm:text-foreground sm:border-l sm:border-border/20",
              "sm:w-2/5 md:w-1/3 sm:h-full sm:rounded-r-2xl"
            )}>
              <div className="bg-muted/30 rounded-t-3xl sm:rounded-t-none border border-border/20 border-b-0 sm:border-0 overflow-hidden sm:flex-1 sm:flex sm:flex-col">
                <details className="group" open>
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors list-none">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 bg-primary rounded-full group-open:bg-primary/60 transition-colors"></div>
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Discussion
                      </h3>
                      <Badge variant="secondary" className="text-xs font-medium bg-muted/50 text-muted-foreground border-border/30">
                        {(post.commentsCount || 0) + (post.text ? 1 : 0)}
                      </Badge>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-200" />
                  </summary>
                  <div className="border-t border-border/20 bg-background/50 max-h-[60vh] sm:max-h-none overflow-y-auto sm:flex-1">
                    <div className="space-y-4">
                      {/* Author's thoughts section */}
                      {post.text && (
                        <div className="p-4 border-b border-border/10">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              Author's Thoughts
                            </h4>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-4 border border-border/20">
                            <div className="flex items-center gap-3 mb-3">
                              <Avatar className="h-6 w-6 border border-border/30">
                                <AvatarImage src={authorProfile?.avatarUrl || undefined} alt={authorProfile?.username || authorProfile?.name || 'User'} data-ai-hint="person avatar" />
                                <AvatarFallback className="text-xs font-semibold">{authorInitial}</AvatarFallback>
                              </Avatar>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">{authorProfile?.username || authorProfile?.name || 'Macaroom User'}</span>
                                <span>•</span>
                                <span>{postedAtRelative}</span>
                              </div>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{post.text}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Comments section */}
                      <div className="border-b border-border/10">
                        <div className="flex items-center gap-2 px-4 py-3">
                          <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Comments
                            <Badge variant="secondary" className="text-xs font-medium bg-muted/50 text-muted-foreground border-border/30">
                              {post.commentsCount || 0}
                            </Badge>
                          </h4>
                        </div>
                        <CommentsList post={post} />
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              
              {/* Enhanced comment form */}
              <div className="bg-muted/30 rounded-b-3xl sm:rounded-b-none border border-border/20 border-t-0 sm:border-0 p-3 sm:p-5">
                <CommentForm post={post} />
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
