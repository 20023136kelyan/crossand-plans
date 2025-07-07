'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid, isPast } from 'date-fns';
import { MapPin, Clock, Star, Users, Calendar, MoreVertical, CheckCircle, Edit3, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlanImageLoader } from './PlanImageLoader';
import { usePlansPageContext } from '@/context/PlansPageContext';
import { PlanDropdownMenu } from './PlanDropdownMenu';

interface HorizontalListPlanCardProps {
  plan: Plan;
  currentUserUid: string | undefined;
}

export function HorizontalListPlanCard({ plan, currentUserUid }: HorizontalListPlanCardProps) {
  const isHost = plan.hostId === currentUserUid;
  const { handleDeleteRequest, handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion } = usePlansPageContext();

  // Format date
  const formattedDate = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'MMM d')
    : null;
  
  const formattedTime = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'h:mm a')
    : null;

  // Count attendees
  const attendeeCount = plan.invitedParticipantUserIds?.length || 0;
  const hostInitial = plan.hostName ? plan.hostName.charAt(0).toUpperCase() : (plan.hostId ? plan.hostId.charAt(0).toUpperCase() : '?');

  return (
    <div className="group relative bg-card border border-border/20 rounded-xl p-3 hover:shadow-md hover:border-primary/30 transition-all duration-300 hover:scale-[1.01] cursor-pointer">
      <div className="flex items-start gap-3">
        {/* Image Section */}
        <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg">
          <PlanImageLoader
            plan={plan}
            width={64}
            height={64}
            className="h-full w-full object-cover"
            altText={plan.name || 'Plan image'}
            priority={false}
          />
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {plan.name}
            </h3>
            
            {/* More options menu - using centralized component */}
            <PlanDropdownMenu
              plan={plan}
              currentUserUid={currentUserUid}
              isHost={isHost}
              onMarkAsCompleted={handleMarkAsCompleted}
              onConfirmCompletion={handleConfirmCompletion}
              onDeleteRequest={handleDeleteRequest}
              isConfirmingCompletion={isConfirmingCompletion}
              triggerClassName="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Host Info */}
          {plan.hostName && (
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <Avatar className="h-4 w-4 mr-2">
                <AvatarImage src={plan.hostAvatarUrl || undefined} alt={plan.hostName}/>
                <AvatarFallback className="text-xs">{hostInitial}</AvatarFallback>
              </Avatar>
              <span className="truncate">by {plan.hostName}</span>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate" title={`${plan.location}, ${plan.city}`}>
              {plan.location}, {plan.city}
            </span>
          </div>

          {/* Rating or Brief */}
          <div className="flex items-start text-sm text-muted-foreground mb-2">
            {(plan.averageRating !== undefined && plan.averageRating !== null && typeof plan.averageRating === 'number') ? (
              <div className="flex items-center">
                <span className="text-amber-400 mr-1">⭐</span>
                <span>{plan.averageRating.toFixed(1)} ({plan.reviewCount || 0})</span>
              </div>
            ) : (
              plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime)) && 
              <div className="flex items-center">
                <span className="text-muted-foreground/50 mr-2">⭐</span> 
                <span>No reviews yet</span>
              </div>
            )}
          </div>

          {/* Date and Time */}
          {formattedDate && formattedTime && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{formattedDate} at {formattedTime}</span>
            </div>
          )}

          {/* Attendee count */}
          {attendeeCount > 0 && (
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 