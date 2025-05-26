'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // Added
  DialogClose,
  DialogPortal,
  DialogOverlay
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, ChevronLeft, ChevronRight, MessageSquare, ThumbsUp, Share2, ExternalLink, ShieldCheck as AdminIcon, CheckCircle } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import type { FeedPost, UserProfile, UserRoleType } from '@/types/user';
import { formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

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

  const authorInitial = authorProfile?.name ? authorProfile.name.charAt(0).toUpperCase() : 'U';
  let postedAtRelative = 'just now';
  const createdAtValid = post.createdAt && (typeof post.createdAt === 'string' || post.createdAt instanceof Date) && isValid(parseISO(post.createdAt as string));
  if (createdAtValid) {
      postedAtRelative = formatDistanceToNowStrict(parseISO(post.createdAt as string), { addSuffix: true });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
        <DialogContent
          className="bg-card border-none shadow-xl p-0 w-full h-full max-w-full max-h-full sm:max-w-4xl sm:max-h-[90vh] flex flex-col items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0 sm:rounded-lg"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Hidden DialogTitle for screen readers */}
          <DialogTitle className="sr-only">
            Post by {authorProfile?.name || 'Macaroom User'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of the post by {authorProfile?.name || 'Macaroom User'}, including image, caption, and interaction options. Shared from plan: {post.planName || 'Not specified'}.
          </DialogDescription>

          {/* Close Button */}
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 z-50 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white" aria-label="Close post view">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>

          {/* Navigation Buttons */}
          {hasPrevious && onPrevious && (
            <Button variant="ghost" size="icon" onClick={onPrevious} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Previous post">
              <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          )}
          {hasNext && onNext && (
            <Button variant="ghost" size="icon" onClick={onNext} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Next post">
              <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          )}

          <div className={cn(
            "flex flex-col h-full w-full overflow-hidden",
            "sm:flex-row" // Side-by-side layout on sm+ screens
          )}>
            {/* Image Area (Takes up more space on larger screens) */}
            <div className={cn(
              "relative bg-black flex items-center justify-center overflow-hidden",
              "w-full h-3/5 sm:h-full sm:w-3/5 md:w-2/3" // Adjust aspect ratio for mobile vs desktop
            )}>
              {post.mediaUrl ? (
                <Image
                  src={post.mediaUrl}
                  alt={post.text || `Post by ${authorProfile?.name || 'user'}`}
                  fill
                  style={{ objectFit: 'contain' }} 
                  data-ai-hint="feed post media"
                  unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                  priority
                  sizes="(max-width: 639px) 100vw, (max-width: 767px) 60vw, 66vw"
                />
              ) : (
                <div className="text-muted-foreground text-center p-8">No image for this post.</div>
              )}
            </div>

            {/* Content Area (Side panel on larger screens) */}
            <div className={cn(
              "flex flex-col bg-card text-foreground",
              "w-full h-2/5 sm:h-full sm:w-2/5 md:w-1/3"
            )}>
              <DialogHeader className="flex flex-row items-center p-3 sm:p-4 border-b border-border/30 shrink-0">
                {isLoadingAuthor ? (
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ) : (
                  <>
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                      <AvatarImage src={authorProfile?.avatarUrl || undefined} alt={authorProfile?.name || 'User'} data-ai-hint="person avatar" />
                      <AvatarFallback>{authorInitial}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3 flex-grow">
                      <div className="flex items-center">
                        <span className="text-sm sm:text-md font-semibold text-foreground/90">{authorProfile?.name || 'Macaroom User'}</span>
                        {authorProfile && <VerificationBadgeModal role={authorProfile.role} isVerified={authorProfile.isVerified} />}
                      </div>
                      {post.planName && (
                        <Link href={`/plans/${post.planId}`} className="text-xs text-muted-foreground hover:underline line-clamp-1" onClick={onClose}>
                          from <span className="font-medium text-primary">{post.planName}</span>
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar-vertical">
                {post.text && (
                  <p className="text-sm text-foreground/90 whitespace-pre-line">{post.text}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  <span>{postedAtRelative}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-around p-2 border-t border-border/30 shrink-0">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary flex-1">
                  <ThumbsUp className="mr-1.5 h-4 w-4" /> {post.likesCount || 0}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary flex-1">
                  <MessageSquare className="mr-1.5 h-4 w-4" /> {post.commentsCount || 0}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary flex-1">
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
