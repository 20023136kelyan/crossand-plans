'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid, isPast } from 'date-fns';
import { MapPinIcon, ClockIcon, UsersIcon, EllipsisVerticalIcon, CheckCircleIcon, PencilIcon, EyeIcon, TrashIcon, ArrowsPointingOutIcon, CalendarIcon, UserIcon, PlayIcon, QuestionMarkCircleIcon, CheckIcon, XMarkIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlanImageLoader } from './PlanImageLoader';
import { usePlansPageContext } from '@/context/PlansPageContext';
import { PlanDropdownMenu } from './PlanDropdownMenu';
import { PlanTitleWrapper } from './PlanTitleWrapper';

interface HorizontalListPlanCardProps {
  plan: Plan;
  currentUserUid: string | undefined;
}

export function HorizontalListPlanCard({ plan, currentUserUid }: HorizontalListPlanCardProps) {
  const isHost = plan.hostId === currentUserUid;
  const { handleDeleteRequest, handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion } = usePlansPageContext();
  
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

  // Format time for display
  const formattedTime = plan.eventTime && isValid(parseISO(plan.eventTime)) ? 
    format(parseISO(plan.eventTime), 'h:mmaaa - ') + 
    format(parseISO(new Date(new Date(plan.eventTime).getTime() + 90 * 60000).toISOString()), 'h:mmaaa') : 
    null;

  // For production - get actual participants from the plan
  // First get confirmed participants, excluding host if present
  const participantUserIds = plan.participantUserIds?.filter(id => id !== plan.hostId) || [];
  
  // If we have invited users but no confirmed participants, use those instead
  const displayIds = participantUserIds.length > 0 ? 
    participantUserIds : 
    (plan.invitedParticipantUserIds?.filter(id => id !== plan.hostId) || []);
    
  const participantCount = displayIds.length;
  
  // We'll show up to 3 avatars total (including host)
  const maxVisibleAvatars = 3;
  const additionalAttendees = Math.max(0, participantCount - (maxVisibleAvatars - 1)); // -1 because one slot is for host
  
  // Get host initial for avatar
  const hostInitial = plan.hostName ? plan.hostName.charAt(0).toUpperCase() : (plan.hostId ? plan.hostId.charAt(0).toUpperCase() : '?');
  
  // In production, the Plan object would have access to participant data including avatars
  // The app likely has a way to access participant profiles from the participantUserIds
  // Here we're using the structure as it would be in production
  
  // Format location for display in a smarter way
  const formatLocation = (location: string | null | undefined, city: string | null | undefined): string => {
    if (!location) return city || 'Unknown location';
    
    // If it's a proper business name (like "Al Pastor Papi"), keep it intact
    if (location.length < 25 && !location.includes(',')) {
      return `${location}${city ? `, ${city}` : ''}`;
    }
    
    // For addresses, extract meaningful parts
    const parts = location.split(',').map(p => p.trim());
    
    // If we have something like "123 Main St, San Francisco", just return "123 Main St"
    if (parts.length >= 1) {
      const firstPart = parts[0];
      // If first part is very long, try to shorten it intelligently
      if (firstPart.length > 25) {
        // Try to keep street number and name, remove apartment/unit info
        const streetParts = firstPart.split(' ');
        if (streetParts.length > 2) {
          return `${streetParts.slice(0, 2).join(' ')}...${city ? `, ${city}` : ''}`;
        }
      }
      return `${firstPart}${city ? `, ${city}` : ''}`;
    }
    
    // Fallback to original behavior
    return `${location}${city ? `, ${city}` : ''}`;
  };
  
  // No category icon overlay needed anymore

  return (
    <Link href={`/plans/${plan.id}`} className="block w-full outline-none focus:outline-none focus-visible:outline-none">
      <div className="group relative bg-card border border-border/20 rounded-xl hover:shadow-md hover:border-primary/30 transition-all duration-300 hover:scale-[1.01] focus:scale-100 focus:shadow-none focus:border-border/20 cursor-pointer overflow-hidden w-full min-w-[350px]">
        {/* Top section */}
        <div className="flex items-start pl-1.5 pr-3 pt-1.5 pb-2">
          {/* Plan Image with Category Icon Overlay */}
          <div className="relative w-24 h-20 flex-shrink-0 mr-2">
            <div className="h-full w-full overflow-hidden rounded-lg">
              <PlanImageLoader
                plan={plan}
                width={96}
                height={80}
                className="h-full w-full object-cover"
                altText={plan.name || 'Plan image'}
                priority={false}
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-normal text-base leading-tight mb-1.5 line-clamp-2 overflow-hidden">
                  <PlanTitleWrapper title={plan.name} />
                </h3>
              </div>
              
              {/* No host avatar here anymore */}
            </div>
            
            {/* Time row and menu */}
            <div className="flex justify-between items-center mt-1">
              {formattedTime && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <ClockIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="text-sm">{formattedTime}</span>
                </div>
              )}
              
              {/* Dropdown Menu - aligned with time display */}
              <div>
                <PlanDropdownMenu
                  plan={plan}
                  currentUserUid={currentUserUid}
                  isHost={isHost}
                  onMarkAsCompleted={handleMarkAsCompleted}
                  onConfirmCompletion={handleConfirmCompletion}
                  onDeleteRequest={handleDeleteRequest}
                  isConfirmingCompletion={isConfirmingCompletion}
                  triggerClassName="h-7 w-7 text-foreground/70 hover:text-foreground hover:bg-accent/50 active:bg-accent/80 active:scale-90 active:text-foreground rounded-full transition-all duration-150"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom section with location - separated by divider */}
        <div className="border-t-[2.5px] border-dashed border-border/60 w-[92%] mx-auto"></div>
        <div className="pl-1.5 pr-3 py-2.5 flex items-center justify-between">
          {/* Location with static map */}
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
              {/* Static map styled with CSS */}
              <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800">
                {/* Horizontal roads */}
                <div className="absolute h-[1px] bg-slate-300/50 dark:bg-slate-600/50 left-0 right-0 top-[30%]"></div>
                <div className="absolute h-[2px] bg-slate-300/60 dark:bg-slate-600/60 left-0 right-0 top-[60%]"></div>
                
                {/* Vertical roads */}
                <div className="absolute w-[1px] bg-slate-300/50 dark:bg-slate-600/50 top-0 bottom-0 left-[35%]"></div>
                <div className="absolute w-[2px] bg-slate-300/60 dark:bg-slate-600/60 top-0 bottom-0 left-[70%]"></div>
                
                {/* Buildings */}
                <div className="absolute w-[3px] h-[3px] bg-slate-400/30 dark:bg-slate-500/30 top-[20%] left-[20%]"></div>
                <div className="absolute w-[4px] h-[4px] bg-slate-400/30 dark:bg-slate-500/30 top-[45%] left-[50%]"></div>
                <div className="absolute w-[3px] h-[5px] bg-slate-400/30 dark:bg-slate-500/30 top-[75%] left-[25%]"></div>
                <div className="absolute w-[5px] h-[3px] bg-slate-400/30 dark:bg-slate-500/30 top-[65%] left-[80%]"></div>
              </div>
              
              {/* Pin overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPinIcon className="h-4 w-4 text-primary drop-shadow-sm" />
              </div>
            </div>
            <span className="truncate" title={`${plan.location}, ${plan.city}`}>
              {formatLocation(plan.location, plan.city)}
            </span>
          </div>
          
          {/* Participants & Completion Status */}
          <div className="flex items-center gap-3">
            {/* Host & Participants Display */}
            <div className="flex items-center -space-x-1.5">
              {/* Host Avatar */}
              <Avatar className="h-7 w-7 border-2 border-background shadow-sm">
                {plan.hostAvatarUrl ? (
                  <AvatarImage src={plan.hostAvatarUrl} alt={plan.hostName || ''}/>
                ) : (
                  <AvatarFallback className="text-xs bg-primary/20 text-primary-foreground">{hostInitial}</AvatarFallback>
                )}
              </Avatar>

              {/* Show participant avatars */}
              {participantCount > 0 && displayIds.slice(0, Math.min(2, participantCount)).map((userId, i) => {
                return (
                  <Avatar key={`participant-${userId}`} className="h-7 w-7 border-2 border-background shadow-sm">
                    <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800">
                      <UserIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    </AvatarFallback>
                  </Avatar>
                );
              })}

              {/* Show +N for remaining participants */}
              {additionalAttendees > 0 && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background shadow-sm">
                  +{additionalAttendees}
                </div>
              )}
            </div>

            {/* Multi-state Status Indicator */}
            <div 
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center",
                {
                  "bg-emerald-500 text-white shadow-sm": statusType === 'completed',
                  "bg-zinc-400 text-white shadow-sm": statusType === 'attended',
                  "bg-blue-500 text-white shadow-sm": statusType === 'ongoing',
                  "bg-teal-500 text-white shadow-sm": statusType === 'going',
                  "bg-amber-500 text-white shadow-sm": statusType === 'maybe',
                  "bg-red-500/90 text-white shadow-sm": statusType === 'declined',
                  "bg-muted/30 text-muted-foreground/50 border border-border/50": statusType === 'noresponse',
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
        </div>
        
        {/* No more dropdown menu here - moved next to avatar */}
      </div>
    </Link>
  );
}