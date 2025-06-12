'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Calendar, BadgeCheck } from "lucide-react";
import type { Plan } from '@/types/user';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';

interface ExploreCardProps {
  plan: Plan;
}

export const ExploreCard = React.memo(({ plan }: ExploreCardProps) => {
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);
  
  const isParticipant = user?.uid && (
    plan.hostId === user.uid || 
    plan.participantUserIds?.includes(user.uid)
  );
  
  const planLink = isParticipant ? `/plans/${plan.id}` : `/p/${plan.id}`;
  
  const creatorInitial = (plan.creatorUsername || plan.creatorName || '').charAt(0).toUpperCase();
  
  // Image source logic
  const placeholderImageUrl = '/images/placeholder-plan.jpg';
  let planImageSrc = placeholderImageUrl;
  let imageHint = 'placeholder';
  
  if (plan.photoHighlights && plan.photoHighlights.length > 0) {
    planImageSrc = plan.photoHighlights[0];
    imageHint = 'photo highlight';
  } else if (plan.itinerary?.[0]?.googlePhotoReference) {
    // Check if it's already a direct URL (from place-autocomplete)
    if (plan.itinerary[0].googlePhotoReference.startsWith('http://') || plan.itinerary[0].googlePhotoReference.startsWith('https://')) {
      planImageSrc = plan.itinerary[0].googlePhotoReference;
    } else {
      planImageSrc = getGooglePlacePhotoUrl(plan.itinerary[0].googlePhotoReference, 400);
    }
    imageHint = 'Google Place photo';
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return '';
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      return '';
    }
  };



  return (
    <Card className="group overflow-hidden bg-card border border-border/20 rounded-2xl transition-all duration-200 hover:shadow-lg hover:border-border/40">
      <div className="flex h-28">
        {/* Image Section */}
        <div className="relative w-28 flex-shrink-0 overflow-hidden">
          {imageError ? (
            <img
              src={placeholderImageUrl}
              alt={plan.name || 'Placeholder image'}
              className="h-full w-full object-cover"
              data-ai-hint="placeholder fallback"
            />
          ) : (
            <Image
              src={planImageSrc}
              alt={plan.name || 'Plan image'}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              data-ai-hint={imageHint}
              unoptimized={planImageSrc.includes('maps.googleapis.com')}
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 min-w-0">
          <Link href={planLink} className="block group-hover:text-primary transition-colors">
            <h3 className="font-semibold text-base leading-tight line-clamp-1 mb-2" title={plan.name}>
              {plan.name}
            </h3>
          </Link>
          
          {/* Creator Info */}
          {(plan.creatorUsername || plan.creatorName) && (
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <Avatar className="h-4 w-4 mr-2">
                <AvatarImage src={plan.creatorAvatarUrl} alt={plan.creatorUsername || plan.creatorName}/>
                <AvatarFallback className="text-xs">{creatorInitial}</AvatarFallback>
              </Avatar>
              <span className="truncate">by {plan.creatorUsername || plan.creatorName}</span>
              {plan.creatorIsVerified && (
                <BadgeCheck className="h-3 w-3 text-primary ml-1" />
              )}
            </div>
          )}

          {/* Location */}
          {plan.location && (
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate" title={plan.location}>
                {plan.location}
              </span>
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center text-sm text-muted-foreground">
            {(plan.averageRating !== undefined && plan.averageRating !== null && typeof plan.averageRating === 'number' && plan.averageRating > 0) ? (
              <>
                <Star className="h-4 w-4 mr-1 text-amber-400 fill-amber-400 flex-shrink-0" />
                <span>{plan.averageRating.toFixed(1)}</span>
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2 text-muted-foreground/50 flex-shrink-0" />
                <span>No reviews yet</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

ExploreCard.displayName = 'ExploreCard';