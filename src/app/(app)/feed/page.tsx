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
  DialogDescription as DialogDescriptionComponent,
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
  Heart,
  Loader2,
  X as XIcon,
  UserCircle as UserCircleIcon,
  MoreVertical,
  Trash2,
  CheckCircle,
  ShieldCheck as AdminIcon,
  Lock as LockIcon,
  EyeOff,
  PackageOpen,
  AlertTriangle,
  MapPin,
  Clock,
  Users,
  Star,
  ArrowLeft,
  ArrowRight,
  Eye
} from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  fetchFeedPostsAction,
  toggleLikePostServerAction,
  addCommentToPostServerAction,
  deleteFeedPostAction,
  deleteFeedCommentAction
} from '@/app/actions/feedActions';
import type { FeedPost, UserRoleType, FeedPostVisibility, FeedComment, UserProfile, Plan } from '@/types/user';
import { formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { getPostComments, getUserProfile, getPlanById, getTemplatesByOriginalPlanId } from '@/services/clientServices';
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { extractImageGradientCached } from '@/lib/colorExtraction';
import { LinearBlur } from "progressive-blur";

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
  plan?: { city?: string; location?: string; } | null;
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
  plan
}: FeedPostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const locationText = useMemo(() => {
    if (!plan) return "No location";
    const city = plan.city;
    const location = plan.location;
    const country = location?.split(',').pop()?.trim() || null;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return 'No location';
  }, [plan]);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [canShowMoreCaption, setCanShowMoreCaption] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const MAX_CAPTION_LINES_COLLAPSED = 3;
  const MIN_CHARS_FOR_SHOW_MORE = 150;
  const [optimisticLikedByCurrentUser, setOptimisticLikedByCurrentUser] = useState(item.likedBy?.includes(currentUserId || "") || false);
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(item.likesCount || 0);
  const [optimisticCommentsCount, setOptimisticCommentsCount] = useState(item.commentsCount || 0);

  // Swipe and template state
  const [isFlipped, setIsFlipped] = useState(false);
  const [templateData, setTemplateData] = useState<Plan | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOptimisticLikedByCurrentUser(item.likedBy?.includes(currentUserId || "") || false);
    setOptimisticLikesCount(item.likesCount || 0);
    setOptimisticCommentsCount(item.commentsCount || 0);
  }, [item.likedBy, item.likesCount, item.commentsCount, currentUserId]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingCardComment, setIsSubmittingCardComment] = useState(false);

  // Fetch template data when card is flipped
  const fetchTemplateData = useCallback(async () => {
    if (templateData || loadingTemplate) return;
    
    setLoadingTemplate(true);
    try {
      console.log('🔍 Fetching template data for planId:', item.planId);
      
      // First, try to fetch templates that were created from this plan
      const templates = await getTemplatesByOriginalPlanId(item.planId);
      console.log('📋 Found templates:', templates.length, templates.map(t => ({ id: t.id, name: t.name, isTemplate: t.isTemplate })));
      
      if (templates.length > 0) {
        // Use the first (most recent) template
        console.log('✅ Using template:', templates[0].name);
        setTemplateData(templates[0]);
        return;
      }
      
      // If no templates found, check if the plan itself is a template
      const plan = await getPlanById(item.planId);
      console.log('📄 Plan data:', plan ? { id: plan.id, name: plan.name, isTemplate: plan.isTemplate } : 'null');
      
      if (plan && plan.isTemplate) {
        console.log('✅ Plan is itself a template:', plan.name);
        setTemplateData(plan);
      } else {
        console.log('❌ No templates found for planId:', item.planId);
      }
    } catch (error) {
      console.error('Error fetching template data:', error);
    } finally {
      setLoadingTemplate(false);
    }
  }, [item.planId, templateData, loadingTemplate]);

  // Handle swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
    setSwipeDistance(0);
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;
    
    const currentX = e.touches[0].clientX;
    const distance = currentX - swipeStartX;
    
    // Track direction and distance
    if (Math.abs(distance) > 0) {
      setSwipeDistance(Math.abs(distance));
      setSwipeDirection(distance < 0 ? 'left' : 'right');
    }
  };

  const handleTouchEnd = () => {
    if (swipeStartX === null) return;
    
    // If swipe distance is significant
    if (swipeDistance > 50) {
      if (swipeDirection === 'left') {
        // Left swipe - flip to template
        setIsFlipped(true);
        fetchTemplateData();
      } else if (swipeDirection === 'right' && isFlipped) {
        // Right swipe when flipped - return to front
        setIsFlipped(false);
      }
    }
    
    setSwipeStartX(null);
    setSwipeDistance(0);
    setSwipeDirection(null);
  };

  // Calculate swipe progress for visual feedback
  const swipeProgress = Math.min(swipeDistance / 100, 1);

  // Handle flip back
  const handleFlipBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(false);
  };

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

  // Debug template data changes
  useEffect(() => {
    console.log('🔄 Template data changed:', templateData ? { id: templateData.id, name: templateData.name } : 'null');
  }, [templateData]);

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

  return (
    <div 
      ref={cardRef}
      className="relative w-full max-w-md h-[600px] perspective-1000"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
              <div 
          className={cn(
            "relative w-full h-full transition-transform duration-500 transform-style-preserve-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped 
              ? 'rotateY(-180deg)' 
              : swipeDistance > 0 
                ? `rotateY(${swipeProgress * 15}deg)` 
                : 'rotateY(0deg)',
          }}
        >
        {/* Front side - Original post */}
        <Card 
          className={cn(
            "overflow-hidden rounded-3xl w-full h-full absolute backface-hidden transition-shadow duration-200",
            swipeDistance > 0 && "shadow-2xl"
          )} 
          onClick={() => onOpenDetailModal(item)}
        >
          <div className="relative h-full w-full">
            {item.mediaUrl ? (
              <>
                <Image 
                  src={item.mediaUrl} 
                  alt={item.text || `Highlight from ${item.planName}`} 
                  width={400} 
                  height={600} 
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }} 
                  data-ai-hint="feed post image" 
                  priority={true} 
                  className="w-full h-full" 
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 336px, 384px" 
                />
                {/* Top overlay with user info and plan name */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20">
                  <LinearBlur
                    steps={8}
                    strength={64}
                    falloffPercentage={100}
                    tint="rgba(0, 0, 0, 0.7)"
                    side="top"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: -1
                    }}
                  />
                  <div className="flex items-center gap-3 mb-3">
                    <Link href={`/users/${item.userId}`} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Avatar className="h-10 w-10 border-2 border-white/50">
                        <AvatarImage src={item.userAvatarUrl || undefined} alt={item.userName} />
                        <AvatarFallback className="bg-white/95 text-gray-800 text-sm font-semibold">{userInitial}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <div className="flex items-center">
                        <Link href={`/users/${item.userId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          <span className="font-bold text-sm text-white">{item.username || item.userName}</span>
                        </Link>
                        <VerificationBadge role={item.userRole} isVerified={item.userIsVerified} />
                      </div>
                      <p className="text-white/60 text-xs mt-0.3">{locationText}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/10 ml-auto" onClick={(e) => e.stopPropagation()}>
                          <span className="sr-only">More options</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-background">
                        <DropdownMenuItem onSelect={() => onHidePost(item.id)} className="cursor-pointer text-xs"><EyeOff className="mr-2 h-3.5 w-3.5"/> Hide Post</DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"><AlertTriangle className="mr-2 h-3.5 w-3.5"/> Report Post</DropdownMenuItem>
                        {isOwnPost && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => onRequestDeletePost(item)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs">
                              <Trash2 className="mr-2 h-3.5 w-3.5"/> Delete Post
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>
                {/* Bottom overlay with like and comment counts */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                  <LinearBlur
                    steps={8}
                    strength={64}
                    falloffPercentage={100}
                    tint="rgba(0, 0, 0, 0.7)"
                    side="bottom"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: -1
                    }}
                  />
                  <div className="flex items-center gap-4 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto flex items-center gap-2 text-white"
                      onClick={(e) => { e.stopPropagation(); handleLikeClick(); }}
                      disabled={!currentUserId}
                    >
                      <Heart className= "h-20 w-20" />
                      <span className="text-base">{optimisticLikesCount || 0}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto flex items-center gap-2 text-white"
                      onClick={(e) => { e.stopPropagation(); onOpenCommentsModal(item); }}
                    >
                      <MessageSquare className="h-20 w-20" />
                      <span className="text-base">{optimisticCommentsCount || 0}</span>
                    </Button>
                  </div>
                  
                  {/* Swipe hint */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 text-white/60 text-xs">
                    <ArrowLeft className="h-3 w-3" />
                    <span>Swipe left for template</span>
                  </div>
                  
                  {/* Swipe progress indicator */}
                  {swipeDistance > 0 && (
                    <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                      <div className="w-1 h-16 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="bg-white/80 rounded-full transition-all duration-150"
                          style={{ 
                            height: `${swipeProgress * 100}%`,
                            transform: 'translateY(100%)'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Swipe progress indicator for back side */}
                  {isFlipped && swipeDistance > 0 && swipeDirection === 'right' && (
                    <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
                      <div className="w-1 h-16 bg-gray-300/20 rounded-full overflow-hidden">
                        <div 
                          className="bg-gray-600/80 rounded-full transition-all duration-150"
                          style={{ 
                            height: `${swipeProgress * 100}%`,
                            transform: 'translateY(100%)'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Swipe hint overlay */}
                  {swipeDistance > 10 && swipeDistance < 50 && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-white/90 rounded-lg px-4 py-2 text-sm font-medium text-gray-800">
                        {isFlipped ? "Keep swiping right to return" : "Keep swiping left to reveal template"}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-black">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-white/95 rounded-3xl flex items-center justify-center mx-auto">
                    <span className="text-4xl">📝</span>
                  </div>
                  <p className="text-white/80 font-bold text-lg">Text Post</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Back side - Template information */}
        <Card className="overflow-hidden rounded-3xl w-full h-full absolute backface-hidden rotate-y-180 animate-in fade-in duration-500" style={{ background: 'hsl(35, 15%, 94%)' }}>
          <div className="relative h-full w-full p-6 flex flex-col">
            {/* Header with back button */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleFlipBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-gray-800">Plan Snippet</h3>
                <p className="text-sm text-gray-600">Swipe right to return</p>
              </div>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>

                        {/* Template content */}
            <div className="flex-1 overflow-y-auto">
              {loadingTemplate ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : templateData ? (
                <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
                  {/* Template header */}
                  <div className="text-center mb-6">
                    <h2 className="text-base font-bold text-gray-800 mb-2">{templateData.name}</h2>
                    <p className="text-sm text-gray-600 mb-3">{templateData.description}</p>
                    
                    {/* Creator info */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={templateData.creatorAvatarUrl || undefined} alt={templateData.creatorName || ''} />
                        <AvatarFallback className="text-xs">
                          {(templateData.creatorName || templateData.templateOriginalHostName || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-700">
                        by {templateData.creatorName || templateData.templateOriginalHostName || 'Unknown'}
                      </span>
                      {templateData.creatorIsVerified && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Template details */}
                  <div className="space-y-3">
                    {/* City, Category, Price - single row */}
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-700 mb-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{templateData.city}</span>
                      <span className="mx-1">•</span>
                      <span>{templateData.eventType || 'Event'}</span>
                      <span className="mx-1">•</span>
                      <span>{templateData.priceRange || 'Free'}</span>
                    </div>

                    {/* Rating */}
                    {templateData.averageRating && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-gray-700">
                          {templateData.averageRating.toFixed(1)} ({templateData.reviewCount || 0} reviews)
                        </span>
                      </div>
                    )}

                    {/* Itinerary preview */}
                    {templateData.itinerary && templateData.itinerary.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-gray-800 mb-2">Itinerary</h4>
                        <div className="space-y-2">
                          {templateData.itinerary.slice(0, 3).map((item, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-800">{item.placeName}</p>
                                {item.description && (
                                  <p className="text-gray-600 text-xs">{item.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {templateData.itinerary.length > 3 && (
                            <p className="text-xs text-gray-500 mt-2">
                              +{templateData.itinerary.length - 3} more stops
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <PackageOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No template available</p>
                    <p className="text-sm text-gray-500">This post doesn't have an associated template</p>
                  </div>
                </div>
              )}
            </div>

                        {/* Action buttons */}
            {templateData && (
              <div className="absolute bottom-4 left-4 flex flex-row items-center gap-3 z-20">
                <Eye
                  className="h-6 w-6 text-blue-600 cursor-pointer hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded transition"
                  aria-label="View Template"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/p/${templateData.id}`, '_blank');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.open(`/p/${templateData.id}`, '_blank');
                    }
                  }}
                />
                <Star
                  className="h-6 w-6 text-yellow-500 cursor-pointer hover:text-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded transition"
                  aria-label="Copy to My Plans"
                  tabIndex={0}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user || !currentUserId) {
                      toast({ title: "Login Required", description: "Please log in to copy templates.", variant: "destructive" });
                      return;
                    }
                    try {
                      const idToken = await user.getIdToken();
                      if (!idToken) throw new Error("Authentication token not available.");
                      const { copyPlanToMyAccountAction } = await import('@/app/actions/planActions');
                      const result = await copyPlanToMyAccountAction(templateData.id, idToken);
                      if (result.success) {
                        toast({ title: "Template Copied!", description: "The template has been added to your plans." });
                        window.open(`/plans/${result.newPlanId}`, '_blank');
                      } else {
                        toast({ title: "Copy Failed", description: result.error || "Could not copy template.", variant: "destructive" });
                      }
                    } catch (error: any) {
                      toast({ title: "Copy Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!user || !currentUserId) {
                        toast({ title: "Login Required", description: "Please log in to copy templates.", variant: "destructive" });
                        return;
                      }
                      try {
                        const idToken = await user.getIdToken();
                        if (!idToken) throw new Error("Authentication token not available.");
                        const { copyPlanToMyAccountAction } = await import('@/app/actions/planActions');
                        const result = await copyPlanToMyAccountAction(templateData.id, idToken);
                        if (result.success) {
                          toast({ title: "Template Copied!", description: "The template has been added to your plans." });
                          window.open(`/plans/${result.newPlanId}`, '_blank');
                        } else {
                          toast({ title: "Copy Failed", description: result.error || "Could not copy template.", variant: "destructive" });
                        }
                      } catch (error: any) {
                        toast({ title: "Copy Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
                      }
                    }
                  }}
                />
              </div>
            )}
            
            {/* Swipe hint for back side */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 text-gray-600 text-xs">
              <ArrowRight className="h-3 w-3" />
              <span>Swipe right to return</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
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
            {newModalComment.trim() && (<Button type="submit" variant="ghost" size="icon" className="text-primary h-9 w-9 flex-shrink-0 hover:bg-primary/10" disabled={isSubmittingModalComment} aria-label="Post comment">{isSubmittingModalComment ? <Loader2 className="h-4 w-4 animate-spin"/> : "Post"}</Button>)}
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
  const [planData, setPlanData] = useState<Record<string, { city?: string; location?: string; } | null>>({});
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

  const fetchPlanData = useCallback(async (posts: FeedPost[]) => {
    const newPlanData: Record<string, { city?: string; location?: string; } | null> = {};
    await Promise.all(posts.map(async (post) => {
      try {
        const plan = await getPlanById(post.planId);
        newPlanData[post.planId] = plan ? { city: plan.city, location: plan.location } : null;
      } catch (error) {
        console.error(`Error fetching plan data for post ${post.id}:`, error);
        newPlanData[post.planId] = null;
      }
    }));
    setPlanData(prev => ({ ...prev, ...newPlanData }));
  }, []);

  const fetchFeedData = useCallback(async () => {
    if (authLoading) { setLoadingFeed(true); return; }
    setLoadingFeed(true);
    try {
      const result = await fetchFeedPostsAction(user?.uid, 20); 
      if (result.success && result.posts) {
        setFeedPosts(result.posts);
        setNextCursor(result.nextCursor || null);
        setHasMore(!!result.nextCursor);
        await fetchPlanData(result.posts);
      } else {
        toast({ title: "Error Loading Feed", description: result.error || "Could not load feed content.", variant: "destructive" });
        setFeedPosts([]); setHasMore(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred while loading the feed.", variant: "destructive" });
      setFeedPosts([]); setHasMore(false);
    } finally { setLoadingFeed(false); }
  }, [user?.uid, authLoading, toast, fetchPlanData]);

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await fetchFeedPostsAction(user?.uid, 20, nextCursor);
      if (result.success && result.posts) {
        setFeedPosts(prevPosts => [...prevPosts, ...result.posts!]);
        setNextCursor(result.nextCursor || null);
        setHasMore(!!result.nextCursor);
        await fetchPlanData(result.posts);
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
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl pb-20 px-4">
        {/* This is where the "For You" content will now directly live */}
        {loadingFeed && visibleFeedPosts.length === 0 && (<div className="flex min-h-[calc(100vh-15rem)] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-gray-600" /></div>)}
        {!loadingFeed && visibleFeedPosts.length === 0 && (<div className="text-center py-10 text-gray-600 min-h-[calc(100vh-15rem)] flex flex-col justify-center items-center"><PackageOpen className="mx-auto h-12 w-12 mb-4 opacity-70" /><p className="text-lg font-semibold">Your feed is looking a bit quiet.</p><p>Share your plan highlights or explore to find content!</p></div>)}
        {visibleFeedPosts.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 justify-items-center">
              {visibleFeedPosts.map(item => (<FeedPostCard key={item.id} item={item} currentUserId={user?.uid} currentUserProfile={currentUserProfile} onOpenCommentsModal={openCommentsModal} onUpdatePostInList={updateFeedPostInList} onHidePost={hidePostLocally} onRequestDeletePost={handleRequestDeletePost} onOpenDetailModal={handleOpenPostDetailModal} plan={planData[item.planId]} />))}
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
    
    