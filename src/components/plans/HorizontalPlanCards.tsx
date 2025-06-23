'use client';

import { Plan } from '@/types/plan';
import { format, parseISO, isValid } from 'date-fns';
import { MapPin, Star, Heart, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRef, useEffect, useState } from 'react';

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

function HorizontalPlanCard({ plan, currentUserUid }: HorizontalPlanCardProps) {
  const isHost = plan.hostId === currentUserUid;
  
  // Format date
  const formattedDate = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'MMM d')
    : null;
  
  const formattedTime = plan.eventTime && isValid(parseISO(plan.eventTime)) 
    ? format(parseISO(plan.eventTime), 'h:mm a')
    : null;

  // Get plan image
  const planImageSrc = plan.photoHighlights?.[0] || 
    (plan.itinerary?.[0]?.googleMapsImageUrl) || 
    `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(plan.location + ', ' + plan.city)}&zoom=13&size=300x200&maptype=roadmap&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

  // Count attendees
  const attendeeCount = plan.participantUserIds?.length || 0;
  const maxAttendees = plan.rsvpSettings?.maxParticipants;

  return (
    <div className="flex-shrink-0 w-72 bg-card rounded-xl overflow-hidden shadow-sm border border-border/50 group hover:shadow-md transition-shadow">
      {/* Image Section */}
      <div className="relative h-40 overflow-hidden rounded-xl shadow-lg">
        <Image
          src={planImageSrc}
          alt={plan.name || 'Plan image'}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
          unoptimized={planImageSrc.includes('maps.googleapis.com')}
        />
        
        {/* Heart icon */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 bg-white/90 hover:bg-white text-gray-700 hover:text-red-500 shadow-sm"
        >
          <Heart className="h-4 w-4" />
        </Button>

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
      <div className="p-4">
        <Link href={`/plans/${plan.id}`} className="block group-hover:text-primary transition-colors">
          <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-2" title={plan.name}>
            {plan.name}
          </h3>
        </Link>

        {/* Location */}
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="truncate" title={`${plan.location}, ${plan.city}`}>
            {plan.location}, {plan.city}
          </span>
        </div>

        {/* Host info */}
        {plan.hostName && !isHost && (
          <div className="text-xs text-muted-foreground mb-2">
            by {plan.hostName}
          </div>
        )}

        {/* Bottom row - Rating and Attendees */}
        <div className="flex items-center justify-between">
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
  );
} 