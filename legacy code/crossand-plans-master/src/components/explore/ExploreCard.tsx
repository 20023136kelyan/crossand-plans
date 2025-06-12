'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Calendar, BadgeCheck } from "lucide-react";
import type { Plan } from '@/types/user';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

interface ExploreCardProps {
  plan: Plan;
}

export const ExploreCard = React.memo(({ plan }: ExploreCardProps) => {
  const { user } = useAuth();
  const isParticipant = user?.uid && (
    plan.hostId === user.uid || 
    plan.invitedParticipantUserIds?.includes(user.uid)
  );

  // Determine the correct link based on user's relationship to the plan
  const planLink = isParticipant ? `/plans/${plan.id}` : `/p/${plan.id}`;

  const [imageError, setImageError] = React.useState(false);
  const creatorInitial = plan.creatorUsername ? plan.creatorUsername.charAt(0).toUpperCase() : (plan.creatorName ? plan.creatorName.charAt(0).toUpperCase() : '?');
  const placeholderImageUrl = `https://placehold.co/80x80.png?text=${encodeURIComponent(plan.name ? plan.name.substring(0,10) : 'Img')}&font=Montserrat`;

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

  // Get the plan image
  let planImageSrc = placeholderImageUrl;
  let imageHint = plan.eventType || 'event';

  if (plan.photoHighlights && plan.photoHighlights.length > 0 && plan.photoHighlights[0]) {
    planImageSrc = plan.photoHighlights[0];
    imageHint = 'plan highlight';
  }

  return (
    <Link href={planLink} className="block group">
      <div className="relative bg-card rounded-xl overflow-hidden border border-border/50 hover:border-border transition-colors">
        {/* Main Image */}
        <div className="relative aspect-[2/1] bg-muted">
          {plan.photoHighlights?.[0] ? (
            <Image
              src={plan.photoHighlights[0]}
              alt={plan.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold line-clamp-2">{plan.name}</h3>
              {plan.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {plan.location}
                </p>
              )}
            </div>
            
            {/* Rating */}
            {plan.averageRating && plan.averageRating > 0 && (
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-sm font-medium">{plan.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-2 mt-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={plan.creatorAvatarUrl} />
              <AvatarFallback>
                {creatorInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{plan.creatorUsername || plan.creatorName}</span>
              {plan.creatorIsVerified && (
                <BadgeCheck className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

ExploreCard.displayName = 'ExploreCard'; 