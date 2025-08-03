// src/app/p/[planId]/page.tsx - Public Plan View Page
'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ShareIcon, ChevronUpIcon, CalendarIcon, ClockIcon, MapPinIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getPublicPlanByIdAction } from '@/app/actions/planActions';
import { copyPlanToMyAccountAction } from '@/app/actions/planActions';
import { useAuth } from '@/context/AuthContext';
import type { Plan as PlanType } from '@/types/user';
import { motion, AnimatePresence, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format, parseISO, isValid, isPast, isFuture, isToday } from 'date-fns';
import { PlanDropdownMenu } from '@/components/plans/PlanDropdownMenu';

// Import new components
import PlanHero from '@/components/plans/PlanHero';
import { PlanItinerary } from '@/components/plans/PlanItinerary';
import { PlanMap } from '@/components/plans/PlanMap';
import { PlanPhotos } from '@/components/plans/PlanPhotos';
import { PlanChat } from '@/components/plans/PlanChat';
import { PlanActions } from '@/components/plans/PlanActions';

// Crossand Logo Component
function CrossandLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">C</span>
      </div>
      <span className="font-semibold text-lg">Crossand</span>
    </div>
  );
}

type UserRole = 'host' | 'confirmed' | 'invited' | 'public' | 'authenticated';

export default function PublicPlanPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const planId = params.planId as string;
  
  const [plan, setPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('public');
  
  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideshow = useRef(null);
  const { scrollY } = useScroll();
  const scrollYProgress = useTransform(scrollY, [0, 400], [0, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  
  // When scroll position changes, determine if drawer should be open
  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 100 && !isDrawerOpen) {
      setIsDrawerOpen(true);
    } else if (latest <= 100 && isDrawerOpen) {
      setIsDrawerOpen(false);
    }
  });

  // Fetch plan data
  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getPublicPlanByIdAction(planId);
      
      if (result.plan) {
        setPlan(result.plan);
        
        // Determine user role
        if (user) {
          if (result.plan.hostId === user.uid) {
            setUserRole('host');
          } else if (result.plan.participantResponses[user.uid] === 'going') {
            setUserRole('confirmed');
          } else if (result.plan.participantUserIds.includes(user.uid)) {
            setUserRole('invited');
          } else {
            setUserRole('authenticated');
          }
        } else {
          setUserRole('public');
        }
      } else {
        setError(result.error || 'Plan not found');
      }
    } catch (err) {
      setError('Failed to load plan');
      console.error('Error fetching plan:', err);
    } finally {
      setLoading(false);
    }
  }, [planId, user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Handle copy plan action
  const handleCopyPlan = useCallback(async () => {
    if (!plan) {
      toast.error('No plan to copy');
      return;
    }
    
    if (!user) {
      router.push(`/login?redirect=/p/${planId}&action=copy`);
      return;
    }
    
    if (plan.hostId === user.uid) {
      toast.error('You cannot copy your own plan');
      return;
    }

    setCopying(true);
    try {
      if (!user) {
        toast.error('You must be logged in to copy a plan');
        return;
      }
      const idToken = await user.getIdToken();
      const result = await copyPlanToMyAccountAction(planId, idToken);
      if (result.success && result.newPlanId) {
        toast.success('Plan copied successfully!');
        router.push(`/plans/${result.newPlanId}`);
      } else {
        toast.error(result.error || 'Failed to copy plan');
      }
    } catch (error) {
      console.error('Error copying plan:', error);
      toast.error('Failed to copy plan');
    } finally {
      setCopying(false);
    }
  }, [plan, user, planId, router]);

  // Handle copy action from URL params
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'copy' && plan && user && !copying) {
      handleCopyPlan();
      // Clean up URL
      router.replace(`/p/${planId}`, { scroll: false });
    }
  }, [searchParams, plan, user, copying, handleCopyPlan, router, planId]);

  // Handle RSVP
  const handleRSVP = useCallback(async (response: 'yes' | 'no' | 'maybe') => {
    if (!user || !plan) return;
    
    try {
      // This would be implemented with actual RSVP action
      toast.success(`RSVP updated: ${response}`);
    } catch (error) {
      toast.error('Failed to update RSVP');
    }
  }, [user, plan]);

  // Handle join request
  const handleJoinRequest = useCallback(async () => {
    if (!user || !plan) return;
    
    try {
      // This would be implemented with actual join request action
      toast.success('Join request sent!');
    } catch (error) {
      toast.error('Failed to send join request');
    }
  }, [user, plan]);

  // Get slideshow images from plan
  const planImages = React.useMemo(() => {
    if (!plan) return [];
    
    // Collect all possible images
    const images = [...(plan.photoHighlights || [])];
    
    // Add images from itinerary items
    if (plan.itinerary) {
      plan.itinerary.forEach(item => {
        if (item.googlePhotoReference) {
          // Check if it's already a direct URL
          if (item.googlePhotoReference.startsWith('http')) {
            images.push(item.googlePhotoReference);
          }
        }
        if (item.googleMapsImageUrl) {
          images.push(item.googleMapsImageUrl);
        }
      });
    }
    
    // If no images, add a fallback
    if (images.length === 0) {
      images.push('/images/crossand-logo.svg');
    }
    
    return images;
  }, [plan]);

  // Format event date and time
  const formattedDateTime = React.useMemo(() => {
    if (!plan?.eventTime) return null;
    
    try {
      const date = typeof plan.eventTime === 'string' 
        ? parseISO(plan.eventTime) 
        : plan.eventTime;
      
      if (isValid(date)) {
        return format(date, 'MMM d, yyyy • h:mm a');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
    }
    
    return null;
  }, [plan?.eventTime]);

  // Function to handle drawer open
  const openDrawer = useCallback(() => {
    window.scrollTo({
      top: 400,
      behavior: 'smooth'
    });
  }, []);

  // Function to close drawer (scroll back up)
  const closeDrawer = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    if (planImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlide(current => (current + 1) % planImages.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [planImages.length]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-lg font-medium">Loading plan...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="text-center p-8 rounded-xl backdrop-blur-sm bg-card/90 border border-border shadow-lg">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="h-8 w-8 rounded-full border-2 border-current animate-pulse" />
          </div>
          <h1 className="text-3xl font-semibold mb-2">{error || 'Plan Not Found'}</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            {error || "The plan you're looking for doesn't exist, has been moved, or is not public."}
          </p>
          <Button onClick={() => router.push('/')} variant="outline">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isParticipant = userRole === 'host' || userRole === 'confirmed' || userRole === 'invited';

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Sticky Minimal Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 backdrop-blur-sm bg-black/20">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-white/10 transition-colors"
          onClick={() => {}}
        >
          <ShareIcon className="h-5 w-5" />
        </Button>
      </header>

      {/* Full Screen Slideshow Background */}
      <motion.div 
        className="fixed inset-0 -z-10"
        style={{ opacity, scale }}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <Image
              src={planImages[currentSlide] || '/images/crossand-logo.svg'}
              alt={`Slide ${currentSlide + 1} for ${plan.name}`}
              fill
              style={{ objectFit: 'cover' }}
              priority={currentSlide === 0}
              unoptimized={planImages[currentSlide]?.includes('maps.googleapis.com')}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/80" />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Title & Basic Info (Visible on first screen) */}
      <motion.div 
        className="relative min-h-[100vh] flex flex-col justify-end pb-20 px-6 z-0"
        style={{ opacity }}
      >
        <div className="space-y-3 text-white">
          {/* Category Tags */}
          <div className="flex flex-wrap gap-2">
            {plan.status && (
              <Badge className="bg-black/20 backdrop-blur-sm border-0 text-white">
                {plan.status === 'completed' ? 'Completed' : 
                plan.status === 'published' ? 'Published' :
                plan.status === 'archived' ? 'Archived' : 
                plan.status === 'cancelled' ? 'Cancelled' : plan.status}
              </Badge>
            )}
            {plan.eventType && (
              <Badge className="bg-black/20 backdrop-blur-sm border-0 text-white">
                {plan.eventType}
              </Badge>
            )}
          </div>
          
          {/* Plan Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white drop-shadow-lg tracking-tight">
            {plan.name}
          </h1>
          
          {/* Basic Info */}
          <div className="flex flex-col gap-3 pt-2">
            {formattedDateTime && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>{formattedDateTime}</span>
              </div>
            )}
            
            {plan.location && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                <span>{plan.location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-4 w-4" />
              <span>
                {plan.participantsCount || Object.keys(plan.participantResponses || {}).length} participants
              </span>
            </div>
            
            {/* Host Info */}
            <div className="flex items-center gap-2 pt-2">
              <Avatar className="h-6 w-6 ring-2 ring-white/20">
                <AvatarImage src={plan.hostAvatarUrl} alt={plan.hostName} />
                <AvatarFallback className="bg-white/10 text-white">
                  {plan.hostName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">Created by {plan.hostName || 'Anonymous'}</span>
            </div>
          </div>
          
          {/* Swipe Indicator */}
          <motion.div 
            className="absolute bottom-8 left-0 right-0 flex justify-center"
            initial={{ y: 0 }}
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            onClick={openDrawer}
          >
            <div className="flex flex-col items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium">Swipe up for details</span>
              <ChevronUpIcon className="h-6 w-6" />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scrollable Content Drawer */}
      <div className="relative min-h-screen bg-background rounded-t-3xl shadow-2xl z-10 overflow-hidden">
        {/* Drawer Handle */}
        <div className="sticky top-0 flex justify-center pt-4 pb-2 bg-background z-20 border-b border-border/10">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Close Button (when drawer is open) */}
        {isDrawerOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-30"
            onClick={closeDrawer}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
        
        {/* Drawer Content */}
        <div className="p-6 space-y-8">
          {/* Quick Actions */}
          <PlanActions 
            plan={plan} 
            userRole={userRole} 
            onRSVP={handleRSVP}
            onJoinRequest={handleJoinRequest}
            onCopyPlan={handleCopyPlan}
          />
          
          {/* Host Info with Actions */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                <AvatarImage src={plan.hostAvatarUrl} alt={plan.hostName} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {plan.hostName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium">{plan.hostName || 'Anonymous'}</h3>
                <p className="text-sm text-muted-foreground">Plan Creator</p>
              </div>
            </div>
            
            <PlanDropdownMenu
              plan={plan}
              currentUserUid={user?.uid}
              isHost={userRole === 'host'}
              onCopyLink={() => {}}
              onQRCode={() => {}}
              onShareWithFriends={() => {}}
              onShareToFeed={() => {}}
              onEdit={() => router.push(`/plans/create?editId=${plan.id}`)}
              onDeleteRequest={() => {}}
              variant="hero"
              triggerClassName="h-8 w-8"
              className="w-48"
            />
          </div>
          
          {/* Itinerary */}
          {plan.itinerary && plan.itinerary.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Itinerary</h2>
              <PlanItinerary itinerary={plan.itinerary} />
            </div>
          )}
          
          {/* Map */}
          {plan.itinerary && plan.itinerary.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Map</h2>
              <div className="rounded-xl overflow-hidden border border-border">
                <PlanMap 
                  itinerary={plan.itinerary}
                  planName={plan.name}
                  apiKey={staticMapApiKey}
                />
              </div>
            </div>
          )}
          
          {/* Photos Gallery */}
          {((plan.photoHighlights && plan.photoHighlights.length > 0) || 
            (plan.itinerary && plan.itinerary.some(item => item.googlePhotoReference || item.googleMapsImageUrl))) && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Photos</h2>
              <PlanPhotos 
                highlights={plan.photoHighlights || []} 
                itinerary={plan.itinerary || []} 
                planName={plan.name}
              />
            </div>
          )}
          
          {/* Group Chat */}
          {isParticipant && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Chat</h2>
              <PlanChat 
                plan={plan}
                planId={plan.id} 
                currentUser={user} 
                isParticipant={isParticipant}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}