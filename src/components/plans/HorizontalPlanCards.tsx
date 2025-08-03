'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid, isPast, isFuture } from 'date-fns';

import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BalancedText } from "@/components/ui/BalancedText";
import { useRef, useEffect, useState } from 'react';
import { PlanImageLoader } from './PlanImageLoader';
import { usePlansPageContext } from '@/context/PlansPageContext';
import { PlanDropdownMenu } from './PlanDropdownMenu';

import { MapPinIcon, CalendarIcon, UsersIcon, CheckCircleIcon, PencilIcon, UsersIcon as UsersIconAlt, EnvelopeOpenIcon, ClockIcon, EllipsisVerticalIcon, EyeIcon, TrashIcon, PlayIcon, QuestionMarkCircleIcon, CheckIcon, XMarkIcon, ExclamationCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

interface HorizontalPlanCardsProps {
  plans: Plan[];
  currentUserUid?: string;
}

export function HorizontalPlanCards({ plans, currentUserUid }: HorizontalPlanCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const checkScrollable = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const isScrolledToEnd = scrollLeft + clientWidth >= scrollWidth - 1; // -1 for potential rounding
        setShowRightFade(!isScrolledToEnd && scrollWidth > clientWidth);
      }
    };

    checkScrollable();
    
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      // Make scroll and resize listeners passive for better performance
      const options = { passive: true };
      scrollElement.addEventListener('scroll', checkScrollable, options);
      
      // Resize events don't need to block scrolling, so we can use passive
      window.addEventListener('resize', checkScrollable, options);
      
      return () => {
        scrollElement.removeEventListener('scroll', checkScrollable);
        window.removeEventListener('resize', checkScrollable);
      };
    }
  }, [plans]);

  if (plans.length === 0) return null;

  return (
    <div className="relative -mx-4 px-4">
      {/* Right fade gradient - only show when cards are cut off */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />
      )}
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
      >
        {plans.map((plan) => (
          <HorizontalPlanCard 
            key={plan.id} 
            plan={plan} 
            currentUserUid={currentUserUid}
          />
        ))}
      </div>
    </div>
  );
}

interface HorizontalPlanCardProps {
  plan: Plan;
  currentUserUid?: string;
}

// Plan status types and config (matching the main plans page)
enum UserPlanViewStatus {
  INVITED_TO_PLAN = 'INVITED_TO_PLAN',
  MY_DRAFT_UPCOMING = 'MY_DRAFT_UPCOMING',
  MY_AWAITING_RESPONSES = 'MY_AWAITING_RESPONSES',
  MY_CONFIRMED_READY = 'MY_CONFIRMED_READY',
  COMPLETED = 'COMPLETED',
}

const userPlanViewStatusConfig: Record<UserPlanViewStatus, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  bgColor: string;
}> = {
  [UserPlanViewStatus.INVITED_TO_PLAN]: { 
    label: 'Invited', 
    icon: EnvelopeOpenIcon, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100/90'
  },
  [UserPlanViewStatus.MY_DRAFT_UPCOMING]: { 
    label: 'Draft', 
    icon: PencilIcon, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-100/90'
  },
  [UserPlanViewStatus.MY_AWAITING_RESPONSES]: { 
    label: 'Awaiting', 
    icon: UsersIconAlt, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100/90'
  },
  [UserPlanViewStatus.MY_CONFIRMED_READY]: { 
    label: 'Ready', 
    icon: CheckCircleIcon, 
    color: 'text-green-600',
    bgColor: 'bg-green-100/90'
  },
  [UserPlanViewStatus.COMPLETED]: { 
    label: 'Done', 
    icon: CheckCircleIcon, 
    color: 'text-green-700',
    bgColor: 'bg-green-200/90'
  },
};

function HorizontalPlanCard({ plan, currentUserUid }: HorizontalPlanCardProps) {
  const isHost = plan.hostId === currentUserUid;
  const isInvited = (plan.invitedParticipantUserIds || []).includes(currentUserUid || '');
  const { handleDeleteRequest, handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion } = usePlansPageContext();
  
  // Format date
  const formattedDate = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'MMM d')
    : null;
  
  const formattedTime = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'h:mm a')
    : null;

  // Count attendees
  const attendeeCount = plan.participantUserIds?.length || 0;
  const maxAttendees = plan.rsvpSettings?.maxParticipants;
  
  // Get current time for status calculations
  const currentTime = new Date();
  const eventTime = plan.eventTime ? parseISO(plan.eventTime) : null;
  
  // Calculate the end time of the plan based on the last itinerary item or default to 90 minutes
  const lastItineraryItem = plan.itinerary && plan.itinerary.length > 0 ? 
    plan.itinerary[plan.itinerary.length - 1] : null;
  
  const estimatedEndTime = lastItineraryItem?.startTime ? 
    parseISO(lastItineraryItem.startTime) : 
    (eventTime ? new Date(eventTime.getTime() + 90 * 60000) : null);
  
  // Check if plan is explicitly completed
  const isCompleted = plan.status === 'completed';
  
  // Check if plan time is in the past
  const isPastTime = eventTime ? isPast(eventTime) : false;
  
  // Check if plan is currently ongoing (between start and end time)
  const isOngoing = eventTime && estimatedEndTime && 
    currentTime >= eventTime && 
    currentTime <= estimatedEndTime;
  
  // Get the user's RSVP status - safely access participantResponses
  // Define the type for ParticipantResponse since it's not exported from types
  type ParticipantResponseType = 'going' | 'maybe' | 'declined';
  
  // Safely access and cast the response
  const userResponse = currentUserUid && plan.participantResponses ? 
    (plan.participantResponses[currentUserUid] as ParticipantResponseType) : undefined;
  
  // Check if the user has RSVP'd and what their response was
  const isGoing = userResponse === 'going';
  const isMaybe = userResponse === 'maybe';
  const hasDeclined = userResponse === 'declined';
  
  // Determine the status to display based on priority
  const statusType = isCompleted ? 'completed' : // Explicitly completed plans take highest priority
    (isPastTime && isGoing) ? 'attended' : // Past plans you RSVP'd to but didn't mark complete
    isOngoing && isGoing ? 'ongoing' : // Then ongoing plans you're attending
    isGoing ? 'going' : // Then plans you're going to
    isMaybe ? 'maybe' : // Then plans you might attend
    hasDeclined ? 'declined' : // Then declined plans
    'noresponse'; // Default - no response yet

  return (
    <div className="flex-shrink-0 w-80 relative group">
      <Link href={`/plans/${plan.id}`} className="block">
        <div className="bg-card rounded-xl overflow-hidden shadow-sm border border-border/50 group-hover:shadow-md transition-shadow flex flex-col h-[16rem] relative">
          {/* Full-height Image Section */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-xl bg-muted">
            <PlanImageLoader
              plan={plan}
              width={400}
              height={300}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 plan-card-image"
              altText={plan.name || 'Plan image'}
              priority={false}
            />
            
            {/* Gradient and blur overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10"></div>
            <div className="absolute inset-x-0 bottom-0 h-1/3 backdrop-blur-[1.5px] z-10"></div>
            

          </div>

          {/* Content Section - Positioned over the gradient */}

          {/* Event Type Badge */}
          {plan.eventType && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-xs px-2 py-1 bg-black/70 text-white border-0 z-20 font-medium">
              {plan.eventType}
            </Badge>
          )}

          {/* Date overlay */}
          {formattedDate && (
            <div className="absolute bottom-24 left-2 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-gray-900 z-20">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {formattedDate}
                {formattedTime && <span className="text-gray-600">• {formattedTime}</span>}
              </div>
            </div>
          )}
          
          <div className="px-4 pt-[10rem] pb-10 flex-1 flex flex-col relative z-20 text-white">
            <BalancedText 
              text={plan.name} 
              className="font-semibold text-lg leading-tight mb-1 group-hover:text-white/90 transition-colors min-h-[2.25rem] text-white drop-shadow-md" 
              title={plan.name} 
              maxLines={2} 
              minCharsPerLine={15}
            />

            {/* Location */}
            <div className="flex items-center gap-1 text-xs text-white/90 mb-1 drop-shadow-sm">
              <MapPinIcon className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate" title={`${plan.location}, ${plan.city}`}>
                {plan.location}, {plan.city}
              </span>
            </div>

            {/* Host/Author info */}
            <div className="mb-1 drop-shadow-sm">
              {plan.isTemplate ? (
                // Template - show creator/original host info
                plan.creatorName || plan.templateOriginalHostName ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      <AvatarImage 
                        src={plan.creatorAvatarUrl || undefined} 
                        alt={plan.creatorName || plan.templateOriginalHostName || ''} 
                      />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {(plan.creatorName || plan.templateOriginalHostName || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>by {plan.creatorName || plan.templateOriginalHostName}</span>
                    {plan.creatorIsVerified && (
                      <span className="ml-0.5 text-blue-500 text-[10px]">✓</span>
                    )}
                  </div>
                ) : null
              ) : (
                // Regular plan - show host info
                plan.hostName ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0">
                    <Avatar className="h-4 w-4">
                      <AvatarImage 
                        src={plan.hostAvatarUrl || undefined} 
                        alt={plan.hostName || ''} 
                      />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {(plan.hostName || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{isHost ? 'Hosted by you' : `by ${plan.hostName}`}</span>
                  </div>
                ) : null
              )}
            </div>

            {/* Attendees */}
            <div className="flex items-center mt-auto">
              {attendeeCount > 0 && (
                <div className="flex items-center text-xs text-white/90 drop-shadow-sm">
                  <UsersIcon className="h-3 w-3 mr-1" />
                  <span>
                    {attendeeCount}
                    {maxAttendees && ` / ${maxAttendees}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      
      {/* Status Indicator - Positioned in the top-right corner */}
      <div className="absolute top-2 right-2 z-30">
        <div 
          className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center shadow-md border border-white/20",
            {
              "bg-emerald-500 text-white": statusType === 'completed',
              "bg-zinc-400 text-white": statusType === 'attended',
              "bg-blue-500 text-white": statusType === 'ongoing',
              "bg-teal-500 text-white": statusType === 'going',
              "bg-amber-500 text-white": statusType === 'maybe',
              "bg-red-500/90 text-white": statusType === 'declined',
              "bg-muted/50 text-muted-foreground/70 backdrop-blur-sm": statusType === 'noresponse',
            }
          )}
          title={statusType === 'completed' ? "Plan completed" : 
                 statusType === 'attended' ? "Attended but not marked complete" :
                 statusType === 'ongoing' ? "Plan in progress" : 
                 statusType === 'going' ? "You're attending" : 
                 statusType === 'maybe' ? "Might attend" : 
                 statusType === 'declined' ? "Declined" : 
                 "No RSVP yet"}
        >
          {statusType === 'completed' && <CheckCircleIcon className="h-4 w-4" />}
          {statusType === 'attended' && <CheckCircleIcon className="h-4 w-4" />}
          {statusType === 'ongoing' && <PlayIcon className="h-3.5 w-3.5" />}
          {statusType === 'going' && <CheckIcon className="h-4 w-4" />}
          {statusType === 'maybe' && <QuestionMarkCircleIcon className="h-3.5 w-3.5" />}
          {statusType === 'declined' && <XMarkIcon className="h-4 w-4" />}
          {statusType === 'noresponse' && <ExclamationCircleIcon className="h-3.5 w-3.5" />}
        </div>
      </div>

      {/* Dropdown Menu - Positioned at bottom-right */}
      <div className="absolute bottom-2 right-2 z-30">
        <PlanDropdownMenu
          plan={plan}
          currentUserUid={currentUserUid}
          isHost={isHost}
          onMarkAsCompleted={handleMarkAsCompleted}
          onConfirmCompletion={handleConfirmCompletion}
          onDeleteRequest={handleDeleteRequest}
          isConfirmingCompletion={isConfirmingCompletion}
          triggerClassName="h-8 w-8 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
        />
      </div>
    </div>
  );
}