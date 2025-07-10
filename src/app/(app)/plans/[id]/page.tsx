'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import { 
  CalendarDays, 
  MapPin, 
  Users, 
  MessageSquare, 
  Share2, 
  ThumbsUp, 
  ChevronLeft,
  Loader2
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { getPlanById } from '@/services/clientServices';
import { Plan, ParticipantResponse } from '@/types/user';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import toast from 'react-hot-toast';

export default function PlanDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const slideInterval = useRef<NodeJS.Timeout>();
  
  // Extract image data from plan using similar logic as PlanImageLoader component
  const planImages = useMemo(() => {
    if (!plan) return [];
    
    const images: {url: string; alt: string}[] = [];
    
    // Priority 1: Photo highlights (uploaded by users)
    if (plan.photoHighlights?.length > 0) {
      plan.photoHighlights.forEach(url => {
        images.push({
          url, 
          alt: plan.name || 'Plan image'
        });
      });
    }
    
    // Priority 2: Itinerary items with images
    if (images.length === 0 && plan.itinerary?.length > 0) {
      for (const item of plan.itinerary) {
        // Add items with Google photo references
        if (item.googlePhotoReference) {
          // This URL would normally be constructed with your backend API endpoint
          // that handles Google Places photo references and API keys securely
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            images.push({
              url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${item.googlePhotoReference}&key=${apiKey}`,
              alt: item.placeName || plan.name || 'Plan location'
            });
          }
        }
        // Add Google Maps image URLs as fallback
        else if (item.googleMapsImageUrl) {
          images.push({
            url: item.googleMapsImageUrl,
            alt: item.placeName || plan.name || 'Plan location'
          });
        }
        
        // Break after finding first image
        if (images.length > 0) break;
      }
    }
    
    // Priority 3: Static map for first location if we have coordinates
    if (images.length === 0 && plan.itinerary?.[0]?.lat && plan.itinerary[0].lng) {
      const firstItem = plan.itinerary[0];
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (apiKey) {
        images.push({
          url: `https://maps.googleapis.com/maps/api/staticmap?center=${firstItem.lat},${firstItem.lng}&zoom=15&size=1200x1200&markers=color:red%7C${firstItem.lat},${firstItem.lng}&key=${apiKey}`,
          alt: firstItem.placeName || plan.name || 'Plan location map'
        });
      }
    }
    
    return images;
  }, [plan]);
  
  useEffect(() => {
    if (planImages.length > 1) {
      slideInterval.current = setInterval(() => {
        setActiveImageIndex(prev => (prev + 1) % planImages.length);
      }, 5000); // Change image every 5 seconds
    }

    return () => {
      if (slideInterval.current) {
        clearInterval(slideInterval.current);
      }
    };
  }, [planImages.length]);

  useEffect(() => {
    const fetchPlanData = async () => {
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
    };

    if (id) {
      fetchPlanData();
    }
  }, [id, router]);

  const isHost = user?.uid === plan?.hostId;
  const isInvited = plan?.invitedParticipantUserIds?.includes(user?.uid || '') || false;
  const userResponse = user?.uid && plan?.participantResponses ? 
    plan.participantResponses[user.uid] : undefined;
  
  const isGoing = userResponse === 'going';
  const isMaybe = userResponse === 'maybe';
  const hasDeclined = userResponse === 'not-going';

  const handleRSVP = async (response: ParticipantResponse) => {
    if (!user || !plan) return;

    try {
      setRsvpLoading(true);
      // In real implementation, call your API to update RSVP status
      // await updateRsvpStatus(plan.id, user.uid, response);
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
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString || !isValid(parseISO(dateString))) return 'Date not set';
    return format(parseISO(dateString), 'EEEE, MMMM d, yyyy • h:mm a');
  };

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
    <div className="min-h-screen flex flex-col relative">
      {/* Full screen background image with gradient overlay */}
      <div className="fixed top-0 left-0 right-0 h-[40vh] z-0 overflow-hidden">
        {planImages.length > 0 ? (
          <>
            {/* Image slideshow */}
            {planImages.map((image, index) => (
              <div 
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === activeImageIndex ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={image.url}
                    alt={image.alt || plan?.name || 'Plan'}
                    fill
                    className="object-contain object-top"
                    priority={index === 0}
                    quality={85}
                    unoptimized={image.url.startsWith('http')}
                  />
                </div>
              </div>
            ))}
            
            {/* Image navigation dots if multiple images */}
            {planImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1.5 z-10">
                {planImages.map((_, index) => (
                  <button 
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
                    className={`w-2.5 h-2.5 rounded-full ${index === activeImageIndex ? 'bg-white' : 'bg-white/50'}`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-purple-800 to-blue-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <CalendarDays className="h-20 w-20 text-white/30" />
            </div>
          </div>
        )}
        
        {/* Gradient overlay - subtle at top, stronger fade at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
      </div>
      
      {/* Shadow gradient to connect image to content seamlessly */}
      <div className="fixed top-[40vh] left-0 right-0 h-16 z-0 bg-gradient-to-b from-background/90 to-transparent pointer-events-none" />
      
      {/* Header with back button - now transparent on top of image */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-black/30 backdrop-blur-md p-2 flex items-center">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/plans')}
          className="mr-2 text-white hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1 text-white drop-shadow-md">Plan Details</h1>
      </div>
      
      {/* Empty space to push content below the full-bleed image */}
      <div className="h-[30vh]" />

      {/* Event Type Badge */}
      {plan?.eventType && (
        <div className="px-4 z-10 relative mb-2">
          <Badge className="bg-primary text-white hover:bg-primary">{plan?.eventType || plan?.type || 'Event'}</Badge>
        </div>
      )}

      {/* Plan name and host info */}
      <div className="px-4 relative z-10">
        <Card className="shadow-lg border-border/50 backdrop-blur-sm bg-background/80">
          <CardContent className="p-4">
            <h1 className="text-2xl font-bold">{plan?.name || 'Unnamed Plan'}</h1>
            
            <div className="flex items-center mt-2">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={plan?.hostAvatarUrl || undefined} alt={plan?.hostName || 'Host'} />
                <AvatarFallback>{(plan?.hostName?.[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Hosted by <span className="font-medium">{plan?.creatorUsername || plan?.hostName || 'Unknown host'}</span>
              </span>
            </div>

            {/* Date/time and location */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm">
                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{formatDate(plan?.eventTime)}</span>
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{plan?.location || 'Location not set'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan description */}
      {plan?.description && (
        <div className="px-4 mt-4">
          <Card className="backdrop-blur-sm bg-background/80">
            <CardContent className="p-4">
              <h2 className="font-medium mb-2">About this plan</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan?.description}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Participants */}
      <div className="px-4 mt-4">
        <Card className="backdrop-blur-sm bg-background/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">Participants</h2>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {(plan?.participantUserIds?.length || 0) + (isHost ? 0 : 1)}
                </span>
              </div>
            </div>

            <div className="flex -space-x-2 overflow-hidden my-2">
              {/* Host avatar */}
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={plan?.hostAvatarUrl || undefined} alt={plan?.hostName || 'Host'} />
                <AvatarFallback>{(plan?.hostName?.[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>

              {/* Only show up to 5 participants for simplicity */}
              {(plan.participantUserIds || []).slice(0, 4).map((participantId, index) => (
                <Avatar key={participantId} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback>{index + 1}</AvatarFallback>
                </Avatar>
              ))}

              {/* Show count if there are more */}
              {(plan.participantUserIds?.length || 0) > 4 && (
                <Avatar className="h-8 w-8 border-2 border-background bg-muted">
                  <AvatarFallback>+{(plan.participantUserIds?.length || 0) - 4}</AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* RSVP section for invited users */}
            {(isInvited || isHost) && (
              <>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={isGoing ? "default" : "outline"}
                    onClick={() => handleRSVP('going')}
                    disabled={rsvpLoading || isHost}
                    className={isGoing ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {rsvpLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                    Going
                  </Button>
                  <Button
                    size="sm"
                    variant={isMaybe ? "default" : "outline"}
                    onClick={() => handleRSVP('maybe')}
                    disabled={rsvpLoading || isHost}
                    className={isMaybe ? "bg-amber-500 hover:bg-amber-600" : ""}
                  >
                    Maybe
                  </Button>
                  <Button
                    size="sm"
                    variant={hasDeclined ? "default" : "outline"}
                    onClick={() => handleRSVP('not-going')}
                    disabled={rsvpLoading || isHost}
                    className={hasDeclined ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    Decline
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile action buttons - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-black/40 backdrop-blur-md border-t border-white/10 flex justify-around">
        <Button variant="ghost" className="flex flex-col items-center text-xs w-16 text-white hover:bg-white/20">
          <MessageSquare className="h-5 w-5 mb-1" />
          Chat
        </Button>
        <Button variant="ghost" className="flex flex-col items-center text-xs w-16 text-white hover:bg-white/20">
          <Share2 className="h-5 w-5 mb-1" />
          Share
        </Button>
        {isHost && (
          <Button variant="ghost" className="flex flex-col items-center text-xs w-16 text-white hover:bg-white/20">
            <Users className="h-5 w-5 mb-1" />
            Manage
          </Button>
        )}
      </div>
    </div>
  );
}
