'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid } from 'date-fns';
import { MapPin, Clock, Star, Users, Calendar, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlanImageLoader } from './PlanImageLoader';

interface HorizontalListPlanCardProps {
  plan: Plan;
  currentUserUid?: string;
}

export function HorizontalListPlanCard({ plan, currentUserUid }: HorizontalListPlanCardProps) {
  const isHost = plan.hostId === currentUserUid;
  
  // Format date and time
  const formattedDate = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'MMM d, yyyy')
    : null;
  
  const formattedTime = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'h:mm a')
    : null;

  // Get attendee info
  const attendeeCount = plan.participantUserIds?.length || 0;
  const maxAttendees = plan.rsvpSettings?.maxParticipants;

  // Mock attendee avatars (in real app, you'd fetch actual participant data)
  const mockAttendees = Array.from({ length: Math.min(attendeeCount, 4) }, (_, i) => ({
    id: `attendee-${i}`,
    name: `User ${i + 1}`,
    avatar: null
  }));

  return (
    <Link href={`/plans/${plan.id}`} className="block">
      <div className="group bg-card rounded-xl border border-border/50 p-4 hover:shadow-md transition-all duration-200 hover:border-border/80 h-32 flex items-center">
        <div className="flex gap-4 w-full">
          {/* Image Section */}
          <div className="flex-shrink-0">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shadow-md bg-muted">
              <PlanImageLoader
                plan={plan}
                width={80}
                height={80}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl plan-card-image"
                altText={plan.name || 'Plan image'}
                priority={false}
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                {plan.name}
              </h3>
              
              {/* More options menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild>
                    <Link href={`/p/${plan.id}`} className="flex items-center text-xs cursor-pointer">
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  {isHost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/plans/create?editId=${plan.id}`} className="flex items-center text-xs cursor-pointer">
                          Edit Plan
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Date and Time */}
            {(formattedDate || formattedTime) && (
              <div className="flex items-center text-sm text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span>
                  {formattedDate}
                  {formattedDate && formattedTime && ' • '}
                  {formattedTime}
                </span>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <MapPin className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              <span className="truncate">
                {plan.location}, {plan.city}
              </span>
            </div>

            {/* Bottom Row - Host and Attendees */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                                 {/* Host/Creator info */}
                 <div className="text-sm text-muted-foreground">
                   {isHost ? (
                     <span className="text-primary font-medium">You</span>
                   ) : (plan.creatorUsername || plan.hostName) ? (
                     <span>by @{plan.creatorUsername || plan.hostName}</span>
                   ) : (
                     <span>by Unknown</span>
                   )}
                 </div>
              </div>

              {/* Attendees */}
              {attendeeCount > 0 && (
                <div className="flex items-center gap-2">
                  {/* Attendee avatars */}
                  <div className="flex -space-x-2">
                    {mockAttendees.map((attendee, index) => (
                      <Avatar key={attendee.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={attendee.avatar || undefined} alt={attendee.name} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {attendee.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {attendeeCount > 4 && (
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          +{attendeeCount - 4}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Count */}
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="h-3 w-3 mr-1" />
                    <span>
                      {attendeeCount}
                      {maxAttendees && ` / ${maxAttendees}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
} 