'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, ChevronLeft, ChevronRight, MessageSquare, Heart, Share2, ExternalLink, ShieldCheck as AdminIcon, CheckCircle, Send, Trash2, Loader2, MoreVertical } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import type { FeedPost, FeedComment } from "@/types/user";
import type { UserProfile } from "@/types/user";
import { formatDistanceToNowStrict, parseISO, isValid } from "date-fns";
import { cn } from '@/lib/utils';
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { deleteFeedCommentAction, toggleLikePostServerAction, addCommentToPostServerAction } from "@/app/actions/feedActions";
import { getPostComments } from "@/services/feedService";

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

    // Optimistic update
    const wasLiked = optimisticLikedByCurrentUser;
    setOptimisticLikedByCurrentUser(!wasLiked);
    setOptimisticLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

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
    <Button
      variant="ghost"
      size="sm"
      className={cn("p-0 h-auto flex items-center gap-1.5", 
        optimisticLikedByCurrentUser ? "text-red-400" : "text-white hover:text-red-400")}
      onClick={handleLikeClick}
      disabled={!user || isLiking}
      aria-pressed={optimisticLikedByCurrentUser ? true : false}
      aria-label={optimisticLikedByCurrentUser ? "Unlike post" : "Like post"}
    >
      <Heart className={cn("h-5 w-5", optimisticLikedByCurrentUser && "fill-red-400")} />
      <span className="text-xs font-medium tabular-nums">{optimisticLikesCount}</span>
    </Button>
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
      <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
    );
  }

  return (
    <div className="space-y-3">
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
          <div key={comment.id} className="flex flex-col mt-0 mb-0 relative">
            <div className="absolute -top-3 left-3 z-10 flex items-center gap-2 bg-muted/80 border border-border/30 rounded-full py-1 pl-1 pr-3 shadow-sm">
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={comment.userAvatarUrl || undefined} 
                  alt={comment.username || comment.userName || 'User'} 
                  data-ai-hint="person avatar"
                />
                <AvatarFallback className="text-[11px]">{commenterInitial}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">
                {comment.username || comment.userName || 'User'}
              </span>
            </div>
            <div className="w-full text-xs bg-background border border-border/10 p-3 pt-5 pl-4 rounded-xl shadow-sm relative group hover:bg-muted/20 transition-colors duration-200 mt-0">
              <p className="text-foreground/90 whitespace-pre-line break-words leading-relaxed pr-6">{comment.text}</p>
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                {isCommentOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-3 w-3" />
                        <span className="sr-only">Comment options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer text-xs py-1.5 flex items-center"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={isDeletingComment}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="mt-1.5 text-right">
                <span className="text-muted-foreground text-[10px]">{commentTimestampRelative}</span>
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
      <div className="px-4 py-3 border-t border-border/10 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          Sign in to add a comment
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitComment} className="px-4 py-3 border-t border-border/10 shrink-0">
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 mt-1">
          <AvatarImage 
            src={currentUserProfile.avatarUrl || undefined} 
            alt={currentUserProfile.username || currentUserProfile.name || 'User'} 
            data-ai-hint="person avatar"
          />
          <AvatarFallback>
            {currentUserProfile.username 
              ? currentUserProfile.username.charAt(0).toUpperCase() 
              : (currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : 'U')}
          </AvatarFallback>
        </Avatar>
        <div className="relative flex-1">
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
                commentInputRef.current.style.height = `${Math.max(28, Math.min(120, commentInputRef.current.scrollHeight))}px`;
              }
            }}
            className="min-h-[28px] h-[28px] w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
            disabled={isSubmitting}
          />
          <Button 
            type="submit" 
            size="sm" 
            className="absolute bottom-2 right-2 h-7 px-2"
            disabled={!commentText.trim() || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
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
  if (!isOpen || !post) return null;

  const authorInitial = authorProfile?.username ? authorProfile.username.charAt(0).toUpperCase() : (authorProfile?.name ? authorProfile.name.charAt(0).toUpperCase() : 'U');
  let postedAtRelative = 'just now';
  const createdAtValid = post.createdAt && (typeof post.createdAt === 'string' || post.createdAt instanceof Date) && isValid(parseISO(post.createdAt as string));
  if (createdAtValid) {
      postedAtRelative = formatDistanceToNowStrict(parseISO(post.createdAt as string), { addSuffix: true });
  }

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
            "flex flex-col h-full w-full overflow-hidden shadow-2xl",
            "sm:flex-row sm:rounded-xl" // Side-by-side layout on sm+ screens
          )}>
            {/* Image Area (Takes up more space on larger screens) */}
            <div className={cn(
              "relative bg-black/90 flex items-center justify-center overflow-hidden",
              "w-full h-3/5 sm:h-full sm:w-3/5 md:w-2/3" // Adjust aspect ratio for mobile vs desktop
            )}>
              {post.mediaUrl ? (
                <Image
                  src={post.mediaUrl}
                  alt={post.text || `Post by ${authorProfile?.username || authorProfile?.name || 'user'}`}
                  fill
                  style={{ objectFit: 'contain' }} 
                  data-ai-hint="feed post media"
                  unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                  priority
                  sizes="(max-width: 639px) 100vw, (max-width: 767px) 60vw, 66vw"
                  className="transition-transform duration-300 hover:scale-[1.02]"
                />
              ) : (
                <div className="text-white/70 text-center p-8">No image for this post.</div>
              )}
              
              {/* Semi-translucent header overlay */}
              <div className="absolute top-3 left-3 right-3 backdrop-blur-md bg-black/40 rounded-full px-4 py-2.5 shadow-md flex items-center justify-between z-10">
                {isLoadingAuthor ? (
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-white/10 animate-pulse rounded" />
                      <div className="h-3 w-32 bg-white/10 animate-pulse rounded" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 flex-grow min-w-0">
                      <Avatar className="h-8 w-8 border border-white/20">
                        <AvatarImage src={authorProfile?.avatarUrl || undefined} alt={authorProfile?.username || authorProfile?.name || 'User'} data-ai-hint="person avatar" />
                        <AvatarFallback>{authorInitial}</AvatarFallback>
                      </Avatar>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-white">{authorProfile?.username || authorProfile?.name || 'Macaroom User'}</span>
                          {authorProfile && <VerificationBadgeModal role={authorProfile.role} isVerified={authorProfile.isVerified} />}
                        </div>
                        <div className="text-xs text-white/80 truncate">
                          {postedAtRelative}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/20 ml-2">
                      <span className="sr-only">More options</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 3.5C8.82843 3.5 9.5 2.82843 9.5 2C9.5 1.17157 8.82843 0.5 8 0.5C7.17157 0.5 6.5 1.17157 6.5 2C6.5 2.82843 7.17157 3.5 8 3.5Z" fill="currentColor"/>
                        <path d="M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z" fill="currentColor"/>
                        <path d="M8 15.5C8.82843 15.5 9.5 14.8284 9.5 14C9.5 13.1716 8.82843 12.5 8 12.5C7.17157 12.5 6.5 13.1716 6.5 14C6.5 14.8284 7.17157 15.5 8 15.5Z" fill="currentColor"/>
                      </svg>
                    </Button>
                  </>
                )}
              </div>
              
              {/* Semi-translucent action bar overlay */}
              <div className="absolute bottom-3 right-3 backdrop-blur-md bg-black/40 rounded-full px-4 py-2 shadow-md flex items-center gap-4 z-10">
                <LikeButton post={post} />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:text-primary/90 p-0 h-auto flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    const commentInput = document.getElementById('detail-comment-input');
                    if (commentInput) {
                      commentInput.focus();
                    }
                  }}
                >
                  <MessageSquare className="h-5 w-5" fill="none" />
                  <span className="text-xs font-medium">{post.commentsCount || 0}</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:text-primary/90 p-0 h-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Share2 className="h-5 w-5" fill="none" />
                </Button>
              </div>
            </div>

            {/* Content Area (Side panel on larger screens) */}
            <div className={cn(
              "flex flex-col bg-card/95 backdrop-blur-sm text-foreground",
              "w-full h-2/5 sm:h-full sm:w-2/5 md:w-1/3"
            )}>
              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar-vertical">
                {post.text && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-border/20">
                        <AvatarImage src={authorProfile?.avatarUrl || undefined} alt={authorProfile?.username || authorProfile?.name || 'User'} data-ai-hint="person avatar" />
                        <AvatarFallback>{authorInitial}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{authorProfile?.username || authorProfile?.name || 'Macaroom User'}</span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-line">{post.text}</p>
                  </div>
                )}
                
                {/* Comments section */}
                <div className="mt-4 px-1">
                  <h3 className="text-sm font-medium mb-4">Comments</h3>
                  <CommentsList post={post} />
                </div>
              </div>
              
              <CommentForm post={post} />
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
