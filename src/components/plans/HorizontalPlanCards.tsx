'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid, isPast, isFuture } from 'date-fns';
import { MapPin, Star, Calendar, Users, CheckCircle, Edit3, UsersIcon, MailQuestion, History, MoreVertical, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useRef, useEffect, useState } from 'react';
import { PlanImageLoader } from './PlanImageLoader';
import { usePlansPageContext } from '@/context/PlansPageContext';
import { PlanDropdownMenu } from './PlanDropdownMenu';

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
      scrollElement.addEventListener('scroll', checkScrollable);
      // Also check on resize in case container size changes
      window.addEventListener('resize', checkScrollable);
      
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
    icon: MailQuestion, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100/90'
  },
  [UserPlanViewStatus.MY_DRAFT_UPCOMING]: { 
    label: 'Draft', 
    icon: Edit3, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-100/90'
  },
  [UserPlanViewStatus.MY_AWAITING_RESPONSES]: { 
    label: 'Awaiting', 
    icon: UsersIcon, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100/90'
  },
  [UserPlanViewStatus.MY_CONFIRMED_READY]: { 
    label: 'Ready', 
    icon: CheckCircle, 
    color: 'text-green-600',
    bgColor: 'bg-green-100/90'
  },
  [UserPlanViewStatus.COMPLETED]: { 
    label: 'Done', 
    icon: CheckCircle, 
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

  // Determine plan status
  const getPlanStatus = (): UserPlanViewStatus | null => {
    if (!plan.eventTime || !isValid(parseISO(plan.eventTime))) {
      return plan.status === 'draft' ? UserPlanViewStatus.MY_DRAFT_UPCOMING : null;
    }

    const planEventDate = parseISO(plan.eventTime);
    const allRelevantUids = Array.from(new Set([plan.hostId, ...(plan.invitedParticipantUserIds || [])])).filter(Boolean);
    const isEveryoneGoing = allRelevantUids.length > 0 && allRelevantUids.every(uid => plan.participantResponses?.[uid] === 'going');

    if (isPast(planEventDate)) {
      return UserPlanViewStatus.COMPLETED;
    } else if (isFuture(planEventDate)) {
      if (isHost) {
        if (plan.status === 'draft') {
          return UserPlanViewStatus.MY_DRAFT_UPCOMING;
        } else if (plan.status === 'published') {
          return isEveryoneGoing ? UserPlanViewStatus.MY_CONFIRMED_READY : UserPlanViewStatus.MY_AWAITING_RESPONSES;
        }
      } else if (isInvited && plan.status === 'published') {
        const userRsvp = plan.participantResponses?.[currentUserUid || ''];
        if (!userRsvp || userRsvp === 'pending' || userRsvp === 'maybe') {
          return UserPlanViewStatus.INVITED_TO_PLAN;
        } else if (userRsvp === 'going') {
          return isEveryoneGoing ? UserPlanViewStatus.MY_CONFIRMED_READY : UserPlanViewStatus.MY_AWAITING_RESPONSES;
        }
      }
    }
    return null;
  };

  const planStatus = getPlanStatus();
  const statusConfig = planStatus ? userPlanViewStatusConfig[planStatus] : null;

  return (
    <div className="flex-shrink-0 w-72 relative group">
      <Link href={`/plans/${plan.id}`} className="block">
        <div className="bg-card rounded-xl overflow-hidden shadow-sm border border-border/50 group-hover:shadow-md transition-shadow h-80 flex flex-col">
          {/* Image Section */}
          <div className="relative h-40 overflow-hidden rounded-xl bg-muted m-3 mb-0">
            <PlanImageLoader
              plan={plan}
              width={300}
              height={160}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl plan-card-image"
              altText={plan.name || 'Plan image'}
              priority={false}
            />
            
            {/* Status indicator */}
            {statusConfig && (
              <div className={cn(
                "absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center shadow-sm z-10",
                statusConfig.bgColor
              )}>
                <statusConfig.icon className={cn("h-4 w-4", statusConfig.color)} />
              </div>
            )}

            {/* Event Type Badge */}
            {plan.eventType && (
              <Badge variant="secondary" className="absolute top-3 left-3 text-xs px-2 py-1 bg-black/70 text-white border-0">
                {plan.eventType}
              </Badge>
            )}

            {/* Date overlay */}
            {formattedDate && (
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-gray-900">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formattedDate}
                  {formattedTime && <span className="text-gray-600">• {formattedTime}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors" title={plan.name}>
              {plan.name}
            </h3>

            {/* Location */}
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate" title={`${plan.location}, ${plan.city}`}>
                {plan.location}, {plan.city}
              </span>
            </div>

            {/* Host/Author info - Fixed height container */}
            <div className="h-6 mb-2">
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
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
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

            {/* Bottom row - Rating and Attendees - Push to bottom */}
            <div className="flex items-center justify-between mt-auto">
              {/* Rating */}
              <div className="flex items-center">
                {(plan.averageRating !== undefined && plan.averageRating !== null && typeof plan.averageRating === 'number') ? (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium">{plan.averageRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({plan.reviewCount || 0})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground">No reviews</span>
                  </div>
                )}
              </div>

              {/* Attendees */}
              {attendeeCount > 0 && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Users className="h-3 w-3 mr-1" />
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

      {/* Dropdown Menu - Positioned absolutely over the card */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
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