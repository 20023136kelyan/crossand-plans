'use client';

import { useEffect, useState } from 'react';
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
    <div className="pb-16 flex flex-col">
      {/* Header with back button */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md p-2 flex items-center border-b">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/plans')}
          className="mr-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1">Plan Details</h1>
      </div>

      {/* Hero image with gradient overlay */}
      <div className="relative w-full h-60 mt-12">
        <div className="absolute inset-0 bg-muted">
          {plan.images?.length > 0 ? (
            <Image
              src={plan.images[0].url}
              alt={plan.images[0].alt || plan.name || 'Plan'}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-700 to-blue-500">
              <CalendarDays className="h-12 w-12 text-white opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Event Type Badge */}
        {plan.eventType && (
          <Badge variant="secondary" className="absolute top-2 right-2 bg-black/70 text-white border-0">
            {plan.eventType}
          </Badge>
        )}
      </div>

      {/* Plan name and host info */}
      <div className="px-4 -mt-8 relative z-10">
        <Card className="shadow-lg border-border/50">
          <CardContent className="p-4">
            <h1 className="text-2xl font-bold">{plan.name}</h1>
            
            <div className="flex items-center mt-2">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={plan.hostAvatarUrl || undefined} alt={plan.hostName || 'Host'} />
                <AvatarFallback>{(plan.hostName?.[0] || '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Hosted by <span className="font-medium">{plan.creatorUsername || plan.hostName}</span>
              </span>
            </div>

            {/* Date/time and location */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm">
                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{formatDate(plan.eventTime)}</span>
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{plan.location || 'Location not set'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan description */}
      {plan.description && (
        <div className="px-4 mt-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-medium mb-2">About this plan</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.description}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Participants */}
      <div className="px-4 mt-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">Participants</h2>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {(plan.participantUserIds?.length || 0) + (isHost ? 0 : 1)}
                </span>
              </div>
            </div>

            <div className="flex -space-x-2 overflow-hidden my-2">
              {/* Host avatar */}
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={plan.hostAvatarUrl || undefined} alt={plan.hostName || 'Host'} />
                <AvatarFallback>{(plan.hostName?.[0] || '?').toUpperCase()}</AvatarFallback>
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
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/90 backdrop-blur-md border-t flex justify-around">
        <Button variant="ghost" className="flex flex-col items-center text-xs w-16">
          <MessageSquare className="h-5 w-5 mb-1" />
          Chat
        </Button>
        <Button variant="ghost" className="flex flex-col items-center text-xs w-16">
          <Share2 className="h-5 w-5 mb-1" />
          Share
        </Button>
        {isHost && (
          <Button variant="ghost" className="flex flex-col items-center text-xs w-16">
            <Users className="h-5 w-5 mb-1" />
            Manage
          </Button>
        )}
      </div>
    </div>
  );
}
