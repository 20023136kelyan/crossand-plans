'use client';

import React, { useState, useMemo, memo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarDaysIcon,
  MapPinIcon,
  StarIcon,
  UsersIcon,
  ShareIcon,
  HeartIcon,
  ClockIcon,
  ChevronLeftIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  QrCodeIcon,
  ChatBubbleLeftRightIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon as CalendarCheckIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { format, parseISO, isValid, isPast, isFuture, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Plan as PlanType } from '@/types/user';
import { VerificationBadge } from '@/components/ui/verification-badge';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import { User } from 'firebase/auth';
import { PlanDropdownMenu } from './PlanDropdownMenu';

type UserRole = 'host' | 'confirmed' | 'invited' | 'public' | 'authenticated';

interface PlanHeroProps {
  plan: PlanType;
  userRole: UserRole;
  currentUser: User | null;
  isHost: boolean;
  copyLoading: boolean;
  onCopyToMyPlans: () => void;
  onSharePlanLink: () => void;
  onOpenQRCodeDialog: () => void;
  onShowFriendPicker: () => void;
  onShowShareToFeedDialog: () => void;
  onDeletePlanRequest: () => void;
}

const PlanHero = memo(function PlanHero({
  plan,
  userRole,
  currentUser,
  isHost,
  copyLoading,
  onCopyToMyPlans,
  onSharePlanLink,
  onOpenQRCodeDialog,
  onShowFriendPicker,
  onShowShareToFeedDialog,
  onDeletePlanRequest,
}: PlanHeroProps) {
  const router = useRouter();
  // Calculate main plan image
  const mainPlanImage = useMemo(() => {
    if (plan.photoHighlights && plan.photoHighlights.length > 0) {
      return plan.photoHighlights[0];
    }
    
    const firstItemWithImage = plan.itinerary?.find(item => 
      item.googlePhotoReference || item.googleMapsImageUrl
    );
    
    if (firstItemWithImage?.googlePhotoReference) {
      // Check if it's already a direct URL (from place-autocomplete)
      if (firstItemWithImage.googlePhotoReference.startsWith('http://') || firstItemWithImage.googlePhotoReference.startsWith('https://')) {
        return firstItemWithImage.googlePhotoReference;
      } else {
        return getGooglePlacePhotoUrl(firstItemWithImage.googlePhotoReference, 800, 600);
      }
    }
    
    if (firstItemWithImage?.googleMapsImageUrl) {
      return firstItemWithImage.googleMapsImageUrl;
    }
    
    // Fallback image
    return '/images/crossand-logo.svg';
  }, [plan.photoHighlights, plan.itinerary]);

  const planStatus = useMemo(() => {
    if (!plan.eventTime) return null;
    
    const eventDate = typeof plan.eventTime === 'string' 
      ? parseISO(plan.eventTime) 
      : plan.eventTime;
    if (!isValid(eventDate)) return null;
    
    if (isPast(eventDate) && !isToday(eventDate)) {
      return { label: 'Completed', variant: 'secondary' as const, icon: CheckCircleIcon };
    }
    if (isToday(eventDate)) {
      return { label: 'Today', variant: 'default' as const, icon: CalendarCheckIcon };
    }
    if (isFuture(eventDate)) {
      return { label: 'Upcoming', variant: 'outline' as const, icon: CalendarIcon };
    }
    return null;
  }, [plan.eventTime]);
  
  // Format event date time
  const clientFormattedEventDateTime = useMemo(() => {
    if (!plan.eventTime) return null;
    
    try {
      const date = typeof plan.eventTime === 'string' 
        ? parseISO(plan.eventTime) 
        : plan.eventTime;
      
      if (isValid(date)) {
        return format(date, 'MMM d, yyyy • h:mm a');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
    }
    
    return null;
  }, [plan.eventTime]);
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/40 rounded-2xl overflow-hidden shadow-lg ring-1 ring-border/20">

      {/* Hero Image Section */}
      <div className="relative w-full h-64 md:h-80 lg:h-96">
        <Image
          src={mainPlanImage}
          alt={plan.name}
          fill
          style={{ objectFit: 'cover' }}
          priority
          unoptimized={mainPlanImage.includes('maps.googleapis.com')}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Status Badges */}
        <div className="absolute top-4 right-4 flex gap-2">
          {planStatus && (
              <Badge 
                variant={planStatus.variant} 
                className="bg-black/20 backdrop-blur-sm border-0 text-white px-3 py-1.5 flex items-center gap-1.5"
              >
                {React.createElement(planStatus.icon, { className: "h-3.5 w-3.5" })}
                {planStatus.label}
              </Badge>
            )}
          <Badge
            variant={
              plan.status === 'published' ? 'default' :
              plan.status === 'draft' ? 'secondary' :
              plan.status === 'completed' ? 'default' :
              plan.status === 'cancelled' ? 'destructive' :
              plan.status === 'archived' ? 'outline' : 'secondary'
            }
            className="bg-black/20 backdrop-blur-sm border-0"
          >
            {plan.status === 'published' ? 'Published' :
             plan.status === 'draft' ? 'Draft' :
             plan.status === 'completed' ? 'Completed' :
             plan.status === 'cancelled' ? 'Cancelled' :
             plan.status === 'archived' ? 'Archived' : plan.status}
          </Badge>
          {plan.eventType && (
            <Badge className="bg-black/20 backdrop-blur-sm border-0 text-white">
              {plan.eventType}
            </Badge>
          )}
          {plan.planType && (
            <Badge variant="secondary" className="bg-black/20 backdrop-blur-sm border-0 text-white">
              {plan.planType}
            </Badge>
          )}
        </div>
        
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">
            {plan.name}
          </h1>
          <div className="flex items-center gap-4 text-white/90">
            <div className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4" />
              <span className="text-sm font-medium drop-shadow">{plan.location || 'Location not specified'}</span>
            </div>
            {typeof plan.averageRating === 'number' && (
              <div className="flex items-center gap-1">
                <StarIcon className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-medium drop-shadow">{plan.averageRating?.toFixed(1)}</span>
              </div>
            )}
            {clientFormattedEventDateTime && (
              <div className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                <span className="text-sm font-medium drop-shadow">{clientFormattedEventDateTime}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Creator Info Section */}
      <div className="bg-background/30 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20">
              <AvatarImage src={plan.hostAvatarUrl} alt={plan.hostName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {plan.hostName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{plan.hostName || 'Anonymous'}</h3>
                {plan.creatorIsVerified && <VerificationBadge />}
              </div>
              <p className="text-sm text-muted-foreground">Plan Creator</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center px-2 py-1.5 rounded-md bg-muted/50 text-sm text-muted-foreground gap-1">
              <MapPinIcon className="h-3 w-3" />
              <span className="font-medium">{plan.itinerary?.length || 0}</span>
            </div>
            
            {!isHost && (
              <Button
                onClick={onCopyToMyPlans}
                disabled={copyLoading}
                variant="outline"
                size="sm"
              >
                {copyLoading ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <DocumentDuplicateIcon className="h-4 w-4" />
                )}
                Copy Plan
              </Button>
            )}

            <PlanDropdownMenu
              plan={plan}
              currentUserUid={currentUser?.uid}
              isHost={isHost}
              onCopyLink={onSharePlanLink}
              onQRCode={onOpenQRCodeDialog}
              onShareWithFriends={onShowFriendPicker}
              onShareToFeed={onShowShareToFeedDialog}
              onEdit={() => router.push(`/plans/create?editId=${plan.id}`)}
              onDeleteRequest={onDeletePlanRequest}
              variant="hero"
              triggerClassName="h-8 w-8"
              className="w-48"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default PlanHero;