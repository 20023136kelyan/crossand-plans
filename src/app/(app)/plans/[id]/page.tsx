'use client';

import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import {
  CalendarDaysIcon as CalendarDays,
  MapPinIcon as MapPin,
  UsersIcon as Users,
  ChatBubbleLeftEllipsisIcon as MessageSquare,
  ShareIcon as Share2,
  HandThumbUpIcon as ThumbsUp,
  HandThumbDownIcon as ThumbsDown,
  ChevronLeftIcon as ChevronLeft,
  ArrowPathIcon as Loader2,
  ClockIcon as Clock,
  QuestionMarkCircleIcon as HelpCircle,
  XMarkIcon as X,
  CheckIcon as Check,
  StarIcon as Star
} from '@heroicons/react/24/outline';

import { useAuth } from '@/context/AuthContext';
import { getPlanById } from '@/services/clientServices';
import { Plan, ParticipantResponse, RSVPStatusType } from '@/types/user';
import { updateMyRSVPAction, submitRatingAction, deleteRatingAction } from '@/app/actions/planActions';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import dynamic from 'next/dynamic';

// Lazy load heavy components for better performance
const PlanMap = dynamic(() => import('@/components/plans/PlanMap').then(mod => ({ default: mod.PlanMap })), {
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PlanPhotos = dynamic(() => import('@/components/plans/PlanPhotos').then(mod => ({ default: mod.PlanPhotos })), {
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PlanComments = dynamic(() => import('@/components/plans/PlanComments'), {
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const PlanRatingSection = dynamic(() => import('@/components/plans/PlanRatingSection').then(mod => ({ default: mod.PlanRatingSection })), {
  loading: () => <div className="h-24 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});
import toast from 'react-hot-toast';
import { LinearBlur } from "progressive-blur";
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import { PlanDropdownMenu } from '@/components/plans/PlanDropdownMenu';

// Helper to chunk itinerary into groups of 3 - memoized to prevent recreation
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export default function PlanDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const slideInterval = useRef<NodeJS.Timeout>();
  const [selectedItineraryItem, setSelectedItineraryItem] = useState<any>(null);
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Overview, 1 = Plan Details
  const planDetailsRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // Force dark mode for plan detail page - using local wrapper instead of global
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Memoized swipe gesture handlers to prevent recreation on every render
  const handleSwipeUp = useCallback(() => {
    setActiveTab(1);
  }, []);

  const handleSwipeDown = useCallback(() => {
    setActiveTab(0);
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedUp: handleSwipeUp,
    onSwipedDown: handleSwipeDown,
    delta: 50, // Minimum distance(px) for a swipe
    trackTouch: true,
    trackMouse: false,
  });
  
  // Extract image data from plan using similar logic as PlanImageLoader component
  const planImages = useMemo(() => {
    if (!plan) return [];
    
    const images: {url: string; alt: string}[] = [];
    
    // Priority 1: Photo highlights (uploaded by users) - limit to first 3 for performance
    if (plan.photoHighlights?.length > 0) {
      plan.photoHighlights.slice(0, 3).forEach(url => {
        images.push({
          url, 
          alt: plan.name || 'Plan image'
        });
      });
    }
    
    // Priority 2: Collect from itinerary items with images - limit to first 5 for performance
    if (plan.itinerary?.length > 0 && images.length < 5) {
      for (const item of plan.itinerary) {
        if (images.length >= 5) break; // Limit total images
        
        let imageUrl = null;
        
        if (item.googlePhotoReference) {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            // Check if it's already a direct URL
            if (item.googlePhotoReference.startsWith('http://') || item.googlePhotoReference.startsWith('https://')) {
              imageUrl = item.googlePhotoReference;
            } else {
              // Construct URL from reference with smaller size for performance
              imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${item.googlePhotoReference}&key=${apiKey}`;
            }
          }
        } else if (item.googleMapsImageUrl) {
          imageUrl = item.googleMapsImageUrl;
        }
        
        if (imageUrl) {
          images.push({
            url: imageUrl,
            alt: item.placeName || plan.name || 'Plan location'
          });
        }
      }
    }
    
    // Fallback: If no images found, use a static map from first itinerary item if possible
    if (images.length === 0 && plan.itinerary?.[0]) {
      const firstItem = plan.itinerary[0];
      if (firstItem.lat && firstItem.lng) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        images.push({
            url: `https://maps.googleapis.com/maps/api/staticmap?center=${firstItem.lat},${firstItem.lng}&zoom=15&size=800x600&markers=color:red%7C${firstItem.lat},${firstItem.lng}&key=${apiKey}`,
            alt: firstItem.placeName || plan.name || 'Plan location'
        });
        }
      }
    }
    
    return images;
  }, [plan]);

  const [fitModes, setFitModes] = useState<string[]>([]);
  const topContainerRef = useRef<HTMLDivElement>(null);

  // Memoize fit modes initialization
  useEffect(() => {
    if (planImages.length > 0) {
      setFitModes(new Array(planImages.length).fill('contain'));
    }
  }, [planImages.length]); // Only depend on length, not the entire array

  // Check if user has already rated this plan
  useEffect(() => {
    if (plan && user?.uid) {
      const userRating = plan.ratings?.find(rating => rating.userId === user.uid);
      if (userRating) {
        setUserRating(userRating.value);
        setHasRated(true);
      } else {
        setUserRating(0);
        setHasRated(false);
      }
    }
  }, [plan, user?.uid]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const observer = new ResizeObserver(() => {
      // Trigger re-calculation for visible image with debouncing
      if (topContainerRef.current && planImages.length > 0) {
        const currentImg = document.querySelector(`[data-image-index="${activeImageIndex}"]`) as HTMLImageElement;
        if (currentImg) {
          // Debounce the calculation to prevent excessive calls
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            calculateFit(currentImg, activeImageIndex);
          }, 100);
        }
      }
    });

    if (topContainerRef.current) {
      observer.observe(topContainerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [activeImageIndex, planImages]);

  // Memoized calculateFit function to prevent recreation
  const calculateFit = useCallback((img: HTMLImageElement, index: number) => {
    if (!topContainerRef.current) return;

    const containerWidth = topContainerRef.current.clientWidth;
    const containerHeight = topContainerRef.current.clientHeight;
    const containerAspect = containerWidth / containerHeight;

    const naturalAspect = img.naturalWidth / img.naturalHeight;

    // Skip for static maps (they are generated to fit)
    if (planImages[index].url.includes('staticmap')) {
      setFitModes(prev => {
        const newModes = [...prev];
        newModes[index] = 'contain';
        return newModes;
      });
      return;
    }

    // If image is much narrower (tall portrait) or much wider (short landscape) than container, use cover to avoid bars
    const isTooNarrow = naturalAspect < containerAspect * 0.8;
    const isTooWide = naturalAspect > containerAspect * 1.2;
    const fitMode = (isTooNarrow || isTooWide) ? 'cover' : 'contain';

    setFitModes(prev => {
      const newModes = [...prev];
      newModes[index] = fitMode;
      return newModes;
    });
  }, [planImages]);
  
  useEffect(() => {
    if (planImages.length > 1) {
      slideInterval.current = setInterval(() => {
        setActiveImageIndex((prev) => (prev + 1) % planImages.length);
      }, 30000);  // Increased to 30 seconds for better performance
    }

    return () => {
      if (slideInterval.current) {
        clearInterval(slideInterval.current);
      }
    };
  }, [planImages.length]);

  // Pause slideshow when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (slideInterval.current) {
          clearInterval(slideInterval.current);
          slideInterval.current = undefined;
        }
      } else if (planImages.length > 1 && !slideInterval.current) {
        slideInterval.current = setInterval(() => {
          setActiveImageIndex((prev) => (prev + 1) % planImages.length);
        }, 30000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [planImages.length]);

  // Memoized function to fetch plan data
  const fetchPlanData = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedPlan = await getPlanById(id);
      if (fetchedPlan) {
        setPlan(fetchedPlan);
      } else {
        toast.error('Plan not found');
        router.push('/plans');
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
      toast.error('Error loading plan details');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      fetchPlanData();
    }
  }, [id, fetchPlanData]);

  // Memoize user permissions and responses to prevent unnecessary re-renders
  const userPermissions = useMemo(() => {
    const isHost = user?.uid === plan?.hostId;
    const isInvited = plan?.invitedParticipantUserIds?.includes(user?.uid || '') || false;
    const userResponse = user?.uid && plan?.participantResponses ? 
      plan.participantResponses[user.uid] : undefined;
    
    const isGoing = userResponse === 'going';
    const isMaybe = userResponse === 'maybe';
    const hasDeclined = userResponse === 'not-going';

    return {
      isHost,
      isInvited,
      userResponse,
      isGoing,
      isMaybe,
      hasDeclined
    };
  }, [user?.uid, plan?.hostId, plan?.invitedParticipantUserIds, plan?.participantResponses]);

  const { isHost, isInvited, userResponse, isGoing, isMaybe, hasDeclined } = userPermissions;

  // Debug logging for comment permissions - only in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && plan && user) {
      console.log('Plan comment debugging:', {
        planId: plan.id,
        currentUserId: user.uid,
        isHost,
        isInvited,
        userResponse,
        isGoing,
        isMaybe,
        planEventTime: plan.eventTime,
        currentTime: new Date().toISOString(),
        isEventPast: plan.eventTime ? new Date(plan.eventTime) < new Date() : false,
        invitedParticipants: plan.invitedParticipantUserIds,
        participantResponses: plan.participantResponses
      });
    }
  }, [plan, user, isHost, isInvited, userResponse, isGoing, isMaybe]);

  // Memoized RSVP handler to prevent recreation
  const handleRSVP = useCallback(async (response: ParticipantResponse) => {
    if (!user || !plan) return;

    try {
      setRsvpLoading(true);
      
      // Convert ParticipantResponse to RSVPStatusType
      const rsvpStatus: RSVPStatusType = response === 'going' ? 'going' : 
                                        response === 'not-going' ? 'not-going' : 'maybe';
      
      // Call the actual API to update RSVP status
      const idToken = await user.getIdToken();
      const result = await updateMyRSVPAction(plan.id, idToken, rsvpStatus);
      
      if (result.success) {
        toast.success(`RSVP updated to ${response}`);
        
        // Update local state to reflect the change
        setPlan(prev => {
          if (!prev) return prev;
          
          // Create new plan object with updated responses
          const updatedPlan = { ...prev };
          
          // Update the participant responses
          updatedPlan.participantResponses = {
            ...updatedPlan.participantResponses,
            [user.uid]: response
          };
          
          // Update participant user IDs list based on response
          if (response === 'going' && !updatedPlan.participantUserIds.includes(user.uid)) {
            updatedPlan.participantUserIds = [...updatedPlan.participantUserIds, user.uid];
          } else if (response !== 'going') {
            updatedPlan.participantUserIds = updatedPlan.participantUserIds.filter(id => id !== user.uid);
          }
          
          return updatedPlan;
        });
      } else {
        toast.error(result.error || 'Failed to update RSVP');
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  }, [user, plan]);

  // Memoized date formatting function
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString || !isValid(parseISO(dateString))) return 'Date not set';
    return format(parseISO(dateString), 'MMM d • h:mm a');
  }, []);

  // Helper function to check if plan is past
  const isPlanPast = useCallback((eventTime?: string) => {
    if (!eventTime) return false;
    const eventDate = new Date(eventTime);
    const now = new Date();
    return eventDate < now;
  }, []);

  // Memoized callback functions to prevent recreation
  const closeItineraryModal = useCallback(() => {
    setIsItineraryModalOpen(false);
    setSelectedItineraryItem(null);
  }, []);

  // Helper functions for modal - memoized to prevent recreation
  const formatTime = useCallback((timeString?: string | null) => {
    if (!timeString) return 'TBD';
    try {
      const parsedTime = parseISO(String(timeString));
      if (isValid(parsedTime)) {
        return format(parsedTime, 'h:mm a');
      }
    } catch (error) {
      console.warn('Invalid time format:', timeString);
    }
    return timeString;
  }, []);

  const getItemImageUrl = useCallback((item: any) => {
    if (item.googlePhotoReference) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        if (item.googlePhotoReference.startsWith('http://') || item.googlePhotoReference.startsWith('https://')) {
          return item.googlePhotoReference;
        } else {
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${item.googlePhotoReference}&key=${apiKey}`;
        }
      }
    } else if (item.googleMapsImageUrl) {
      return item.googleMapsImageUrl;
    }
    return `https://placehold.co/80x80.png?text=${encodeURIComponent(item.placeName || 'Location')}`;
  }, []);

  // Memoized itinerary item click handler
  const handleItineraryItemClick = useCallback((item: any, index: number) => {
    setSelectedItineraryItem({ ...item, index });
    setIsItineraryModalOpen(true);
  }, []);

  // Memoize itinerary chunks to prevent recalculation - limit to first 9 items for performance
  const itineraryChunks = useMemo(() => {
    if (!plan?.itinerary) return [];
    const limitedItinerary = plan.itinerary.slice(0, 9); // Limit to first 9 items
    return chunkArray(limitedItinerary, 3);
  }, [plan?.itinerary]);

  // Compact Itinerary Component - memoized to prevent unnecessary re-renders
  const CompactItinerary = memo(({ itinerary }: { itinerary: any[] }) => {
    // Only render first 6 items for performance, show "view more" if needed
    const displayItems = itinerary.slice(0, 6);
    const hasMoreItems = itinerary.length > 6;

    return (
      <>
        <div className="flex flex-col gap-y-3 pt-0 pb-2">
          {displayItems.map((item, index) => (
            <React.Fragment key={item.id || index}>
              <div 
                className="flex items-center gap-3 py-1 relative cursor-pointer group h-20"
                onClick={() => handleItineraryItemClick(item, index)}
              >
              {/* Timeline removed; only polaroid and content remain */}

              {/* Polaroid-style Thumbnail with Time Tag */}
              <div className="flex-shrink-0 flex flex-col items-center ml-2">
                <div className="relative rounded-xl bg-muted shadow-md flex flex-col items-center" style={{ width: 68, height: 84 }}>
                  {/* Stop number indicator in top left */}
                  <span className="absolute -top-2 -left-2 w-6 h-6 flex items-center justify-center rounded-full bg-background text-xs font-semibold text-muted-foreground border border-border/60 z-50" style={{ opacity: 1, boxShadow: '0 1px 4px 0 rgba(0,0,0,0.06)' }}>
                    {index + 1}
                  </span>
                  <div className="w-full h-14 overflow-hidden rounded-t-xl">
                    <Image
                      src={getItemImageUrl(item)}
                      alt={item.placeName}
                      width={68}
                      height={56}
                      className="object-cover w-full h-full"
                      unoptimized={getItemImageUrl(item).includes('maps.googleapis.com')}
                      loading="lazy"
                    />
                  </div>
                  {/* Time Tag in the 'polaroid' bottom */}
                  <div className="w-full flex items-center justify-center pb-1 pt-0.5">
                    <span className="rounded-full bg-transparent text-white text-xs px-2 py-0.5">
                      {formatTime(item.startTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pl-3 flex flex-col justify-center">
                <h4 className="font-semibold text-foreground text-base mb-0 group-hover:text-primary transition-colors">
                  {item.placeName}
                </h4>
                {(item.address || typeof item.rating === 'number') && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mb-1">
                    {item.address && (
                      <span className="truncate">{item.address.split(',')[0]}</span>
                    )}
                    {typeof item.rating === 'number' && (
                      <span className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span>{item.rating.toFixed(1)}</span>
                        {item.reviewCount && (
                          <span className="ml-1">({abbreviateNumber(item.reviewCount)})</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description || 'No description available'}
                </p>
              </div>
            </div>
            {/* Faint horizontal separator, except after last item */}
            {index < displayItems.length - 1 && (
              <div
                className="w-full h-4 flex items-center"
                aria-hidden="true"
              >
                <div
                  className="w-full h-px mx-4"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, transparent 100%)',
                    opacity: 0.5
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
        
        {/* Show "view more" if there are more items */}
        {hasMoreItems && (
          <div className="flex justify-center pt-2">
            <span className="text-xs text-muted-foreground">
              +{itinerary.length - 6} more stops
            </span>
          </div>
        )}
      </div>
      </>
    );
  });

  // Scroll to top when switching to Plan Details tab
  useEffect(() => {
    if (activeTab === 1 && planDetailsRef.current) {
      planDetailsRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading plan details...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">Plan not found</p>
        <Button 
          variant="ghost" 
          className="mt-4"
          onClick={() => router.push('/plans')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to plans
        </Button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative ${isDarkMode ? 'dark' : ''}`} {...swipeHandlers}>
      <AnimatePresence initial={false} mode="wait">
        {activeTab === 0 ? (
          <motion.div
            key="overview"
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 0, opacity: 1 }}
            transition={{ duration: 0, ease: 'linear' }}
            className="absolute inset-0 z-10 bg-transparent"
            style={{ pointerEvents: activeTab === 0 ? 'auto' : 'none' }}
          >
      {/* Full-screen image container for both top and bottom images */}
      <div className="fixed top-0 left-0 right-0 bottom-0 z-0 overflow-hidden">
        {/* Progressive Blur Overlay */}
        <LinearBlur
          steps={2.5}
          strength={64}
          falloffPercentage={50}
          side="bottom"
          style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}
        />
        {/* Gradual blur overlay that starts at 38.5% and gets stronger to the bottom */}
        <div
          className="absolute inset-0 backdrop-blur-md"
          style={{ maskImage: 'linear-gradient(to bottom, transparent 38.5%, black 100%)' }}
        />
        {/* Progressive gradient overlay that adapts to color scheme - spans entire page with stronger bottom effect */}
        <div className="absolute inset-0 z-[8] pointer-events-none">
          {/* Dark mode gradient - completely opaque black at bottom */}
          <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-black/0 from-0% via-black/30 via-25% via-black/70 via-60% via-black/90 via-85% to-black"></div>
          {/* Light mode gradient - nearly opaque white at bottom */}
          <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-white/0 from-0% via-white/30 via-25% via-white/60 via-60% via-white/85 via-85% to-white"></div>
        </div>
        {planImages.length > 0 ? (
          <>
                  {/* Single full viewport image container */}
                  <div ref={topContainerRef} className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden" style={{ boxShadow: 'none', filter: 'none' }}>
              {planImages.map((image, index) => (
                <div 
                        key={`image-${index}`}
                  className={`absolute inset-0 transition-opacity duration-1000 ${index === activeImageIndex ? 'opacity-100' : 'opacity-0'}`}
                >
                        {/* Single full viewport image with mosaic-style tiling */}
                        <div 
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${image.url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'repeat',
                            filter: 'blur(0px)',
                            boxShadow: 'none'
                          }}
                  />
                        {/* Overlay to reduce the tiling effect and create a more natural look */}
                  <div 
                          className="absolute inset-0"
                    style={{ 
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.1) 100%)'
                    }}
                  />
                </div>
              ))}
            </div>
            {activeTab === 0 && planImages.length > 1 && (
  <div className="z-30 absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 border border-white/20 flex gap-2 items-center">
                {planImages.map((_, index) => (
                  <button 
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
        className={`w-2 h-2 rounded-full transition-colors duration-200 ${index === activeImageIndex ? 'bg-white' : 'bg-white/40'}`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-purple-800 to-blue-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <CalendarDays className="h-20 w-20 text-white/30" />
            </div>
          </div>
        )}
      </div>
      {/* Header with back button - always visible container */}
      <div className="fixed top-0 left-0 right-0 z-20 p-2 flex items-center">
        <div className="bg-black/40 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push('/plans')}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="h-[30vh]" />
            {/* Plan name and host info */}
            <div className="mt-4 px-2 relative z-10 w-full max-w-full">
              <Card className="w-full max-w-full border-border/0 backdrop-blur-none bg-transparent relative z-20 drop-shadow-lg" style={{ boxShadow: 'none' }}>
                <CardContent className="w-full max-w-full p-2">
                  {/* Event Type Badge moved inside the card */}
      {plan?.eventType && (
        <span className="flex items-center gap-2 mb-2">
          <Badge 
            className="bg-black/40 text-white hover:bg-black/60" 
            style={{ filter: 'none', boxShadow: 'none', textShadow: 'none' }}
          >
            {plan?.eventType || plan?.type || 'Event'}
          </Badge>
          {/* Status indicators - moved next to category tag */}
          {plan?.status === 'completed' && (
            <span className="flex items-center justify-center w-7 h-7 bg-green-500 rounded-full shadow-lg">
              <Check className="h-4 w-4 text-white" strokeWidth={3} />
            </span>
          )}
          {plan?.status !== 'completed' && isPlanPast(plan?.eventTime) && (
            <span className="flex items-center justify-center w-7 h-7 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
              <Check className="h-4 w-4 text-white/80" strokeWidth={3} />
            </span>
          )}
        </span>
      )}
                  <div className="flex items-center gap-3 mb-4">
  <div className="relative inline-block w-max align-bottom mb-4" style={{minHeight: '2.5rem'}}>
    <h1 className="text-3xl font-bold text-white/75 block">{plan?.name || 'Unnamed Plan'}</h1>
  </div>
</div>
                  
                  {/* Rating Display for completed plans */}
                  {plan?.status === 'completed' && (plan.averageRating || plan.reviewCount > 0) && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= (plan.averageRating || 0)
                                ? "fill-orange-400 text-orange-400"
                                : "text-white/30"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-white/70">
                        {plan.averageRating?.toFixed(1) || '0.0'} ({plan.reviewCount || 0} reviews)
                      </span>
                    </div>
                  )}
            <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground mt-2 mb-2">
              <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
                <span>{formatDate(plan?.eventTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
              <span>{plan?.location || 'Location not set'}</span>
              </div>
            </div>
                  {/* Plan Description (Overview tab) */}
                  {plan?.description && (
                    <div className="mt-4">
                      <h2 className="font-medium mb-2">About this plan</h2>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.description}</p>
                    </div>
                  )}
            <div className="flex items-center mt-4">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={plan?.hostAvatarUrl || undefined} alt={plan?.hostName || 'Host'} />
                <AvatarFallback>{(plan?.hostName?.[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Hosted by <span className="font-medium">{plan?.creatorUsername || plan?.hostName || 'Unknown host'}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
            {/* RSVP Buttons (segmented control) - Only show if plan is not completed */}
            {plan?.status !== 'completed' && (
              <div className="mt-4 px-2 relative z-20 w-full max-w-full">
                <div className="flex flex-row items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 overflow-visible shadow-sm px-0.5 py-0.5 relative" style={{minHeight:'38px', height:'38px'}}>
                  {/* Going */}
                  <button
                    onClick={() => handleRSVP('going')}
                    disabled={rsvpLoading || isHost}
                    className={`relative flex-1 flex items-center justify-center transition-all duration-150 text-center focus:outline-none px-2 sm:px-3 py-0.5 font-medium rounded-full whitespace-nowrap
                      ${isGoing ? 'z-10' : ''} ${rsvpLoading || isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 0, height: '32px', minHeight: '32px', maxHeight: '32px' }}
                  >
                    {isGoing && (
                      <span className="absolute inset-y-0 left-0.5 right-0.5 my-auto h-7 bg-white shadow-md rounded-full z-[-1]" style={{top:'1px',bottom:'1px'}} />
                    )}
                    <span className={`flex items-center gap-1.5 text-sm ${isGoing ? 'text-green-600' : 'text-white/90'} whitespace-nowrap`}> 
                      <ThumbsUp className="h-4 w-4" fill={isGoing ? 'currentColor' : 'none'} />
                      Going
                    </span>
                  </button>
                  {/* Divider */}
                  <div className="flex items-center justify-center" style={{height:'60%'}}>
                    <div className="w-px h-4 mx-1 rounded-full" style={{background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.18) 60%, transparent 100%)'}} />
                  </div>
                  {/* Not Going */}
                  <button
                    onClick={() => handleRSVP('not-going')}
                    disabled={rsvpLoading || isHost}
                    className={`relative flex-1 flex items-center justify-center transition-all duration-150 text-center focus:outline-none px-2 sm:px-3 py-0.5 font-medium rounded-full whitespace-nowrap
                      ${hasDeclined ? 'z-10' : ''} ${rsvpLoading || isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 0, height: '32px', minHeight: '32px', maxHeight: '32px' }}
                  >
                    {hasDeclined && (
                      <span className="absolute inset-y-0 left-0.5 right-0.5 my-auto h-7 bg-white shadow-md rounded-full z-[-1]" style={{top:'1px',bottom:'1px'}} />
                    )}
                    <span className={`flex items-center gap-1.5 text-sm ${hasDeclined ? 'text-red-600' : 'text-white/90'} whitespace-nowrap`}> 
                      <ThumbsDown className="h-4 w-4" fill={hasDeclined ? 'currentColor' : 'none'} />
                      Not Going
                    </span>
                  </button>
                  {/* Divider */}
                  <div className="flex items-center justify-center" style={{height:'60%'}}>
                    <div className="w-px h-4 mx-1 rounded-full" style={{background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.18) 60%, transparent 100%)'}} />
                  </div>
                  {/* Maybe */}
                  <button
                    onClick={() => handleRSVP('maybe')}
                    disabled={rsvpLoading || isHost}
                    className={`relative flex-1 flex items-center justify-center transition-all duration-150 text-center focus:outline-none px-2 sm:px-3 py-0.5 font-medium rounded-full whitespace-nowrap
                      ${isMaybe ? 'z-10' : ''} ${rsvpLoading || isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 0, height: '32px', minHeight: '32px', maxHeight: '32px' }}
                  >
                    {isMaybe && (
                      <span className="absolute inset-y-0 left-0.5 right-0.5 my-auto h-7 bg-white shadow-md rounded-full z-[-1]" style={{top:'1px',bottom:'1px'}} />
                    )}
                    <span className={`flex items-center gap-1.5 text-sm ${isMaybe ? 'text-yellow-600' : 'text-white/90'} whitespace-nowrap`}> 
                      <HelpCircle className="h-4 w-4" />
                      Maybe
                    </span>
                  </button>
                </div>
              </div>
            )}
            {/* Swipe up prompt */}
            <div className="flex justify-center mt-6">
              <span className="text-xs text-white/70 animate-bounce">Swipe up for plan details</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ y: 0 }}
            animate={{ y: 0 }}
            exit={{ y: 0 }}
            transition={{ duration: 0, ease: 'linear' }}
            className="absolute inset-0 z-10"
            style={{ pointerEvents: activeTab === 1 ? 'auto' : 'none' }}
            ref={planDetailsRef}
          >
            {/* Plan Details Tab Background: Image slideshow, gradient, and LinearBlur overlays */}
            <div className="fixed top-0 left-0 right-0 bottom-0 z-0 overflow-hidden">
              {/* Progressive Blur Overlay */}
              <LinearBlur
                steps={5}
                strength={64}
                falloffPercentage={27}
                side="bottom"
                style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}
              />
              {/* Gradual blur overlay that starts at 38.5% and gets stronger to the bottom */}
              <div
                className="absolute inset-0 backdrop-blur-md"
                style={{ maskImage: 'linear-gradient(to bottom, transparent 38.5%, black 100%)' }}
              />
              {/* Progressive gradient overlay that adapts to color scheme - spans entire page with stronger bottom effect */}
              <div className="absolute inset-0 z-[8] pointer-events-none">
                {/* Dark mode gradient - completely opaque black at bottom */}
                <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-black/0 from-0% via-black/30 via-25% via-black/70 via-60% via-black/90 via-85% to-black"></div>
                {/* Light mode gradient - nearly opaque white at bottom */}
                <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-white/0 from-0% via-white/30 via-25% via-white/60 via-60% via-white/85 via-85% to-white"></div>
              </div>
              {planImages.length > 0 ? (
                <>
                  {/* Single full viewport image container */}
                  <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden" style={{ boxShadow: 'none', filter: 'none' }}>
                    {planImages.map((image, index) => (
                      <div 
                        key={`details-image-${index}`}
                        className={`absolute inset-0 transition-opacity duration-1000 ${index === activeImageIndex ? 'opacity-100' : 'opacity-0'}`}
                      >
                        <div 
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${image.url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'repeat',
                            filter: 'blur(0px)',
                            boxShadow: 'none'
                          }}
                        />
                        <div 
                          className="absolute inset-0"
                          style={{ 
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.1) 100%)'
                          }}
                        />
            </div>
                    ))}
                </div>
              </>
              ) : (
                <div className="h-full w-full bg-gradient-to-b from-purple-800 to-blue-900">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CalendarDays className="h-20 w-20 text-white/30" />
                  </div>
                </div>
              )}
            </div>
            {/* No back button in the second tab */}
            {/* Space to allow header to clear but still let content overlay images */}
            {/* Plan Details Tab Header */}
            <div className="px-4 mb-6 pt-16 relative z-30 flex items-center justify-between">
               <h1 className="text-2xl md:text-3xl font-bold text-foreground drop-shadow-lg">Plan Details</h1>
               {plan && (
                 <PlanDropdownMenu
                   plan={plan}
                   currentUserUid={user?.uid}
                   isHost={isHost}
                   onCopyLink={() => {}}
                   onQRCode={() => {}}
                   onShareWithFriends={() => {}}
                   onShareToFeed={() => {}}
                   onEdit={() => router.push(`/plans/create?editId=${plan.id}`)}
                   onDeleteRequest={() => {}}
                   variant="hero"
                   triggerClassName="h-8 w-8"
                   className="w-48"
                   open={menuOpen}
                   onOpenChange={setMenuOpen}
                 />
               )}
               {menuOpen && (
                 <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-all" />
               )}
            </div>
            {/* Add soft shadow to all main content elements */}
            <div className="space-y-8">
            {plan?.itinerary && plan.itinerary.length > 0 && (
              <div className="px-2 mt-4">
                {/* Swipeable Itinerary Cards: each card contains 3 items with the full timeline design */}
                <div className="shadow-lg shadow-black/10 rounded-3xl bg-black/40 backdrop-blur-sm pr-6 pb-3 pl-4 pt-4 flex flex-col justify-center" style={{ overflow: 'visible' }}>
                  <div
                    className="relative overflow-x-auto overflow-y-visible snap-x snap-mandatory scroll-smooth hide-scrollbar w-full pt-2"
                    style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                  >
                    <div className="flex w-full">
                      {itineraryChunks.map((group, cardIdx) => (
                        <div
                          key={`itinerary-card-${cardIdx}`}
                          className="w-full flex-shrink-0 snap-center"
                        >
                          <div className="flex flex-col justify-center h-full">
                            <CompactItinerary itinerary={group} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Navigation dots */}
                  <div className="flex justify-center gap-2 mt-2">
                    {itineraryChunks.map((_, idx) => (
                      <span key={idx} className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {plan?.itinerary && plan.itinerary.length > 0 && activeTab === 1 && (
              <div className="px-2 mt-4 shadow-lg shadow-black/10 rounded-2xl bg-background/80">
                <PlanMap 
                  itinerary={plan.itinerary} 
                  planName={plan.name || 'Plan'}
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                />
              </div>
            )}
            {plan?.photoHighlights && plan.photoHighlights.length > 0 && activeTab === 1 && (
              <div className="px-2 mt-4 shadow-lg shadow-black/10 rounded-2xl bg-background/80">
                <PlanPhotos 
                  highlights={plan.photoHighlights} 
                  itinerary={plan.itinerary || []}
                  planName={plan.name || 'Plan'}
                  className="backdrop-blur-sm bg-background/80"
                />
              </div>
            )}

            {plan?.id && activeTab === 1 && (
              <div className="px-2 mt-4 shadow-lg shadow-black/10 rounded-2xl bg-background/80">
                <PlanRatingSection 
                  isHost={isHost}
                  userRating={0} // TODO: Get from plan ratings
                  hasRated={false} // TODO: Check if user has rated
                  ratingLoading={false} // TODO: Add loading state
                  canRate={!isHost && (isInvited || isGoing)} // Only non-hosts who are invited or going can rate
                  onRatingChange={(rating: number) => {
                    // TODO: Handle rating change
                    console.log('Rating changed:', rating);
                  }}
                  onRatingSubmit={() => {
                    // TODO: Implement rating submission
                    console.log('Submit rating');
                    toast.success('Rating submitted!');
                  }}
                  onClearRating={() => {
                    // TODO: Implement rating deletion
                    console.log('Clear rating');
                    toast.success('Rating cleared!');
                  }}
                />
              </div>
            )}
            {/* Swipe down prompt */}
            <div className="flex justify-center mt-6 mb-10">
              <span className="text-xs text-muted-foreground animate-bounce">Swipe down to return</span>
            </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Full Screen Modal - Outside all containers */}
      <AnimatePresence>
        {isItineraryModalOpen && selectedItineraryItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-0 bg-background flex flex-col h-screen"
            >
              {/* Content - Full Screen Layout */}
              <div className="flex flex-col overflow-hidden h-full">
                {/* Image Section - Top Half with Overlaid Header */}
                <div className="relative h-[50vh] bg-muted overflow-hidden">
                  {/* Header Overlay */}
                  <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
                    <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
                      <h2 className="text-base font-bold text-white">Stop {selectedItineraryItem.index + 1}</h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={closeItineraryModal}
                      className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20 transition-all duration-200"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <Image
                    src={getItemImageUrl(selectedItineraryItem)}
                    alt={selectedItineraryItem.placeName}
                    fill
                    className="object-cover"
                    unoptimized={getItemImageUrl(selectedItineraryItem).includes('maps.googleapis.com')}
                  />
                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Linear blur at bottom of image container */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-sm" />
                  

                  
                  {/* Stop name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Stop name */}
                        <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                          {selectedItineraryItem.placeName}
                        </h3>
                        
                        {/* Rating badge */}
                        {typeof selectedItineraryItem.rating === 'number' && (
                          <div className="flex-shrink-0 bg-amber-500/10 backdrop-blur-md text-amber-500 dark:text-amber-400 flex items-center gap-1 text-sm px-3 py-1 rounded-full border border-amber-500/20">
                            <span>⭐</span>
                            <span className="font-medium">{selectedItineraryItem.rating.toFixed(1)}</span>
                            {selectedItineraryItem.reviewCount && (
                              <span className="text-white/70">({abbreviateNumber(selectedItineraryItem.reviewCount)})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Location and Time - positioned to the left */}
                    <div className="flex justify-start mt-2">
                      <div className="flex items-center gap-2 text-sm text-white/90">
                        {selectedItineraryItem.address && (
                          <span className="truncate max-w-[200px]" title={selectedItineraryItem.address}>
                            📍 {selectedItineraryItem.address.split(',').slice(0, 2).join(', ')}
                          </span>
                        )}
                        
                        {selectedItineraryItem.startTime && (
                          <span>
                            🕒 {formatTime(selectedItineraryItem.startTime)}-{formatTime(selectedItineraryItem.endTime)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text content container with background - Bottom Half */}
                <div className="flex-1 bg-black/80 backdrop-blur-sm px-2 pt-3 pb-3 relative min-h-0">
                  {/* Static map background at bottom */}
                  {selectedItineraryItem.lat && selectedItineraryItem.lng && (
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-muted overflow-hidden">
                      <Image
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${selectedItineraryItem.lat},${selectedItineraryItem.lng}&zoom=15&size=600x200&markers=color:red%7C${selectedItineraryItem.lat},${selectedItineraryItem.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                        alt="Location map"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {/* Gradient overlay to blend with content */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      {/* Top gradient for smooth transition */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-transparent" />
                      {/* Linear blur starting from top */}
                      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm" />
                    </div>
                  )}
                  {/* Description */}
                  <div className="mt-1" style={{maxWidth: '340px', margin: '0 auto'}}>
                    <div className="space-y-6">
                      {selectedItineraryItem.description && (
                        <p className="text-sm text-white/90 leading-relaxed">
                          {selectedItineraryItem.description}
                        </p>
                      )}
                      {/* Activity Suggestions */}
                      {selectedItineraryItem.activitySuggestions && selectedItineraryItem.activitySuggestions.length > 0 && (
                        <div className="bg-white/10 backdrop-blur-sm p-3 pt-4 rounded-lg border border-white/10">
                          <div className="flex items-center text-sm font-semibold text-white mb-2.5">
                            <span className="mr-1.5">🎯</span>
                            Suggested activities
                          </div>
                          <ul className="space-y-1.5">
                            {selectedItineraryItem.activitySuggestions.map((activity: string, idx: number) => {
                              // Extract the first emoji from the activity text
                              const emojiMatch = activity.match(/^([\p{Emoji}\p{Emoji_Modifier_Base}\p{Emoji_Component}]+)/u);
                              const emoji = emojiMatch ? emojiMatch[0] : '•';
                              const text = emojiMatch ? activity.slice(emojiMatch[0].length).trim() : activity;
                              
                              return (
                                <li 
                                  key={idx}
                                  className="flex items-start group"
                                >
                                  <span className="mr-2 mt-0.5 flex-shrink-0">{emoji}</span>
                                  <span className="text-sm text-white/80 leading-tight">
                                    {text}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View on Maps CTA */}
                  <div className="mt-3 pt-2 pb-4">
                    <button 
                      onClick={() => {
                        if (selectedItineraryItem.lat && selectedItineraryItem.lng) {
                          // Universal URL that works on both iOS and Android
                          const url = `https://www.google.com/maps/search/?api=1&query=${selectedItineraryItem.lat},${selectedItineraryItem.lng}`;
                          window.open(url, '_blank');
                        }
                      }}
                      disabled={!selectedItineraryItem.lat || !selectedItineraryItem.lng}
                      className="w-full bg-black/40 backdrop-blur-md rounded-full border border-white/20 p-3 flex items-center justify-between text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-black/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>View on Maps</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-0 bg-background flex flex-col h-screen"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
                <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
                  <h2 className="text-base font-bold text-white">Rate This Plan</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRatingModalOpen(false)}
                  className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20 transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-md space-y-8">
                  {/* Plan Info */}
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                      <Star className="h-10 w-10 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{plan?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {hasRated ? 'Update your rating for this plan' : 'How was your experience with this plan?'}
                      </p>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= userRating;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setUserRating(star)}
                            className="group relative p-3 rounded-full transition-all duration-200 ease-out hover:scale-110 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          >
                            <Star
                              className={`h-12 w-12 transition-all duration-200 ease-out ${
                                isFilled
                                  ? "fill-orange-400 text-orange-400 drop-shadow-sm"
                                  : "text-gray-300 hover:text-orange-300 dark:text-gray-600 dark:hover:text-orange-400"
                              } group-hover:scale-110`}
                            />
                            {isFilled && (
                              <div className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    {userRating > 0 && (
                      <div className="text-center">
                        <p className="text-lg font-medium text-orange-600 dark:text-orange-400">
                          {userRating === 1 ? 'Poor' : 
                           userRating === 2 ? 'Fair' : 
                           userRating === 3 ? 'Good' : 
                           userRating === 4 ? 'Very Good' : 'Excellent'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="space-y-3">
                    <Button
                      onClick={async () => {
                        if (userRating === 0) return;
                        
                        setRatingLoading(true);
                        try {
                          const idToken = await user?.getIdToken();
                          if (!idToken) {
                            toast.error('Authentication required');
                            return;
                          }

                          const result = await submitRatingAction(plan!.id, idToken, userRating);
                          
                          if (result.success) {
                            toast.success('Rating submitted successfully!');
                            setHasRated(true);
                            setRatingModalOpen(false);
                            // Refresh plan data to get updated ratings
                            await fetchPlanData();
                            console.log('Rating submitted successfully:', result);
                          } else {
                            console.error('Rating submission failed:', result.error);
                            toast.error(result.error || 'Failed to submit rating');
                          }
                        } catch (error) {
                          console.error('Rating submission error:', error);
                          toast.error('Failed to submit rating');
                        } finally {
                          setRatingLoading(false);
                        }
                      }}
                      disabled={userRating === 0 || ratingLoading}
                      size="lg"
                      className="w-full bg-gradient-primary hover:bg-gradient-primary-hover text-primary-foreground font-medium transition-all duration-200"
                    >
                      {ratingLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {hasRated ? 'Updating...' : 'Submitting...'}
                        </>
                      ) : (
                        <>
                          <Star className="h-4 w-4 mr-2" />
                          {hasRated ? 'Update Rating' : 'Submit Rating'}
                        </>
                      )}
                    </Button>
                    
                                         {hasRated && (
                       <Button
                         onClick={async () => {
                           setRatingLoading(true);
                           try {
                             const idToken = await user?.getIdToken();
                             if (!idToken) {
                               toast.error('Authentication required');
                               return;
                             }

                             const result = await deleteRatingAction(plan!.id, idToken);
                             
                             if (result.success) {
                               toast.success('Rating removed successfully!');
                               setHasRated(false);
                               setUserRating(0);
                               setRatingModalOpen(false);
                               // Refresh plan data to get updated ratings
                               await fetchPlanData();
                             } else {
                               toast.error(result.error || 'Failed to remove rating');
                             }
                           } catch (error) {
                             console.error('Rating deletion error:', error);
                             toast.error('Failed to remove rating');
                           } finally {
                             setRatingLoading(false);
                           }
                         }}
                         disabled={ratingLoading}
                         variant="outline"
                         size="lg"
                         className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                       >
                         {ratingLoading ? (
                           <>
                             <Loader2 className="h-4 w-4 animate-spin mr-2" />
                             Removing...
                           </>
                         ) : (
                           <>
                             <X className="h-4 w-4 mr-2" />
                             Remove Rating
                           </>
                         )}
                       </Button>
                     )}
                     
                     <Button
                       onClick={() => setRatingModalOpen(false)}
                       variant="outline"
                       size="lg"
                       className="w-full"
                     >
                       Cancel
                     </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          {/* Rating Button - Only show for completed plans */}
          {plan?.status === 'completed' && (
            <Button
              onClick={() => setRatingModalOpen(true)}
              variant="outline"
              size="icon"
              className="relative w-12 h-12 rounded-full bg-gradient-to-br from-background via-muted/5 to-muted/10 border border-border/50 shadow-lg backdrop-blur-sm hover:shadow-xl transition-all duration-200 hover:scale-110"
            >
              <Star className="h-6 w-6 text-white" />
            </Button>
          )}
          <PlanComments planId={plan.id} currentUserId={user?.uid} canComment={isHost || isInvited} />
        </div>
      )}
    </div>
  );
}

// Helper to abbreviate numbers (e.g., 1200 -> 1.2k)
function abbreviateNumber(value: number) {
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return value;
}
