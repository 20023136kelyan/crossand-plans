// src/app/p/[planId]/page.tsx - Public Plan View Page
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getPublicPlanByIdAction } from '@/app/actions/planActions';
import { copyPlanToMyAccountAction } from '@/app/actions/planActions';
import { useAuth } from '@/context/AuthContext';
import type { Plan as PlanType } from '@/types/user';

// Import new components
import { PlanHero } from '@/components/plans/PlanHero';
import { PlanItinerary } from '@/components/plans/PlanItinerary';
import { PlanMap } from '@/components/plans/PlanMap';
import { PlanPhotos } from '@/components/plans/PlanPhotos';
import { PlanWeather } from '@/components/plans/PlanWeather';
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading plan...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <span className="text-destructive text-2xl">!</span>
          </div>
          <h1 className="text-3xl font-semibold mb-2">{error || 'Plan Not Found'}</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            {error || "The plan you're looking for doesn't exist, has been moved, or is not public."}
          </p>
          <Button onClick={() => router.push('/')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isParticipant = userRole === 'host' || userRole === 'confirmed' || userRole === 'invited';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border/20">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <CrossandLogo />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Section */}
            <PlanHero plan={plan} userRole={userRole} />
            
            {/* Quick Actions */}
            <PlanActions 
              plan={plan} 
              userRole={userRole} 
              onRSVP={handleRSVP}
              onJoinRequest={handleJoinRequest}
              onCopyPlan={handleCopyPlan}
            />
            
            {/* Itinerary */}
            {plan.itinerary && plan.itinerary.length > 0 && (
              <PlanItinerary itinerary={plan.itinerary} />
            )}
            
            {/* Photos Gallery */}
            {((plan.photoHighlights && plan.photoHighlights.length > 0) || 
              (plan.itinerary && plan.itinerary.some(item => item.googlePhotoReference || item.googleMapsImageUrl))) && (
              <PlanPhotos 
                highlights={plan.photoHighlights || []} 
                itinerary={plan.itinerary || []} 
                planName={plan.name}
              />
            )}
            
            {/* Group Chat */}
            {isParticipant && (
              <PlanChat 
                plan={plan}
                planId={plan.id} 
                currentUser={user} 
                isParticipant={isParticipant}
              />
            )}
          </div>
          
          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Interactive Map */}
            {plan.itinerary && plan.itinerary.length > 0 && (
              <PlanMap 
                itinerary={plan.itinerary}
                planName={plan.name}
                apiKey={staticMapApiKey}
              />
            )}
            
            {/* Weather Widget */}
            {plan.location && plan.eventTime && (
              <PlanWeather 
                location={plan.location}
                date={plan.eventTime}
                showForecast={true}
                coordinates={plan.coordinates ? {
                  lat: plan.coordinates.latitude,
                  lon: plan.coordinates.longitude
                } : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

    