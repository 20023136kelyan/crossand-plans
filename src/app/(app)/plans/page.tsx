'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Edit3, Trash2, Share2, CalendarDays, MapPin, Eye,
  Users as UsersIcon, MailQuestion, UserCheck, History, MoreVertical,
  ChevronDown, ChevronUp, Loader2, Star, ListChecks, CheckCircle2, CheckCircle,
  Mail, FileText, Clock, Users
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import React, { useState, useMemo, useEffect, useCallback, useContext } from 'react';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid, startOfDay, endOfWeek, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getUserPlans, getPendingPlanSharesForUser, getPlanById } from '@/services/planService';
import { getUserSavedPlans } from '@/services/userService';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import { deletePlanAction, acceptPlanShareAction, declinePlanShareAction } from '@/app/actions/planActions';
import { markPlanAsCompletedAction, confirmPlanCompletionAction } from '@/app/actions/planCompletionActions';
import type { Plan as PlanType, PlanShare, RSVPStatusType, UserRoleType } from '@/types/user';
import { useToast } from "@/hooks/use-toast";

import { useRouter } from "next/navigation";
import { PlansPageProvider, usePlansPageContext } from '@/context/PlansPageContext';
import { PlansPageHeader } from '@/components/plans/PlansPageHeader';
import { PlansEmptyState } from '@/components/plans/PlansEmptyState';
import { HorizontalPlanCards } from '@/components/plans/HorizontalPlanCards';
import { HorizontalListPlanCard } from '@/components/plans/HorizontalListPlanCard';

// Define UserPlanViewStatus enum and its configuration
export enum UserPlanViewStatus {
  INVITED_TO_PLAN = 'INVITED_TO_PLAN',
  MY_DRAFT_UPCOMING = 'MY_DRAFT_UPCOMING',
  MY_AWAITING_RESPONSES = 'MY_AWAITING_RESPONSES',
  MY_CONFIRMED_READY = 'MY_CONFIRMED_READY',
  COMPLETED = 'COMPLETED',
}

export const userPlanViewStatusConfig: Record<UserPlanViewStatus, { label: string; icon: React.ElementType; badgeVariant: "default" | "secondary" | "destructive" | "outline" | string }> = {
  [UserPlanViewStatus.INVITED_TO_PLAN]: { label: 'Invitation', icon: MailQuestion, badgeVariant: 'primary' },
  [UserPlanViewStatus.MY_DRAFT_UPCOMING]: { label: 'Draft', icon: Edit3, badgeVariant: 'outline' },
  [UserPlanViewStatus.MY_AWAITING_RESPONSES]: { label: 'Awaiting Confirmations', icon: UsersIcon, badgeVariant: 'secondary' },
  [UserPlanViewStatus.MY_CONFIRMED_READY]: { label: 'Confirmed & Ready', icon: CheckCircle2, badgeVariant: 'default' },
  [UserPlanViewStatus.COMPLETED]: { label: 'Completed', icon: History, badgeVariant: 'outline' },
};

interface PlanCardProps {
  plan: PlanType;
  currentUserUid: string | undefined;
}

export const PlanCard = React.memo(({ plan, currentUserUid }: PlanCardProps) => {
  const { handleDeleteRequest } = usePlansPageContext();
  const { handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion } = usePlansPageContext();
  const [formattedDay, setFormattedDay] = useState<string | null>(null);
  const [formattedMonth, setFormattedMonth] = useState<string | null>(null);
  const [formattedTime, setFormattedTime] = useState<string | null>(null);
  const [displayStatus, setDisplayStatus] = useState<UserPlanViewStatus | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [itineraryBrief, setItineraryBrief] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const isHost = plan.hostId === currentUserUid;
  const isInvited = (plan.invitedParticipantUserIds || []).includes(currentUserUid || '');
  const isParticipant = isHost || isInvited;

  useEffect(() => {
    setIsClient(true);
    let day = null;
    let month = null;
    let time = null;
    let currentDisplayStatus: UserPlanViewStatus | null = null;
    let planEventDate: Date | null = null;

    if (plan.eventTime && isValid(parseISO(plan.eventTime))) {
      planEventDate = parseISO(plan.eventTime);
      day = format(planEventDate, 'd');
      month = format(planEventDate, 'MMM').toUpperCase();
      time = format(planEventDate, 'p');

      const allRelevantUidsPlusHost = Array.from(new Set([plan.hostId, ...(plan.invitedParticipantUserIds || [])])).filter(Boolean);
      const isEveryoneGoing = allRelevantUidsPlusHost.length > 0 && allRelevantUidsPlusHost.every(uid => plan.participantResponses?.[uid] === 'going');

      if (isPast(planEventDate)) {
        currentDisplayStatus = UserPlanViewStatus.COMPLETED;
      } else if (isFuture(planEventDate)) {
        if (isHost) {
          if (plan.status === 'draft') {
            currentDisplayStatus = UserPlanViewStatus.MY_DRAFT_UPCOMING;
          } else if (plan.status === 'published') {
            if (isEveryoneGoing) {
              currentDisplayStatus = UserPlanViewStatus.MY_CONFIRMED_READY;
            } else {
              currentDisplayStatus = UserPlanViewStatus.MY_AWAITING_RESPONSES;
            }
          }
        } else if (isInvited && plan.status === 'published') {
          const userRsvp = plan.participantResponses?.[currentUserUid || ''];
          if (!userRsvp || userRsvp === 'pending' || userRsvp === 'maybe') {
            currentDisplayStatus = UserPlanViewStatus.INVITED_TO_PLAN;
          } else if (userRsvp === 'going') {
            if (isEveryoneGoing) {
              currentDisplayStatus = UserPlanViewStatus.MY_CONFIRMED_READY;
            } else {
              currentDisplayStatus = UserPlanViewStatus.MY_AWAITING_RESPONSES;
            }
          }
        }
      }
    } else {
      day = "??"; month = "???"; time = "N/A";
      if (plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime))) {
        currentDisplayStatus = UserPlanViewStatus.COMPLETED;
      }
    }
    setFormattedDay(day);
    setFormattedMonth(month);
    setFormattedTime(time);
    setDisplayStatus(currentDisplayStatus);

    // Set itinerary brief
    const firstItemDesc = plan.itinerary?.[0]?.description;
    const planDesc = plan.description;
    let brief = firstItemDesc || planDesc || null;
    if (brief && brief.length > 60) {
      brief = brief.substring(0, 57) + "...";
    }
    setItineraryBrief(brief);

  }, [plan, currentUserUid]);

  if (!isClient) {
    return (
      <Card className="overflow-hidden shadow-md bg-card text-card-foreground flex flex-col h-full rounded-lg animate-pulse border border-border/30">
        <div className="flex p-3 items-start gap-3 flex-grow">
          <div className="flex flex-col items-center shrink-0 w-20">
            <div className="bg-muted h-20 w-20 rounded-lg"></div>
            <div className="bg-card border border-border/50 shadow-sm rounded-md p-1 text-center w-full mt-2 min-h-[60px]">
              <div className="h-6 bg-muted rounded-sm w-1/2 mx-auto mb-1"></div>
              <div className="h-3 bg-muted rounded-sm w-1/3 mx-auto mb-1"></div>
              <div className="h-3 bg-muted rounded-sm w-1/4 mx-auto"></div>
            </div>
          </div>
          <div className="flex-grow space-y-2 pt-1">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
            <div className="h-3 bg-muted rounded w-full mt-1"></div>
            <div className="flex gap-1 mt-2">
                <div className="h-4 w-16 bg-muted rounded-full"></div>
                <div className="h-4 w-20 bg-muted rounded-full"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const StatusIcon = displayStatus ? userPlanViewStatusConfig[displayStatus]?.icon : CalendarDays;
  const statusBadgeVariant = displayStatus ? userPlanViewStatusConfig[displayStatus]?.badgeVariant : 'outline';
  const statusLabel = displayStatus ? userPlanViewStatusConfig[displayStatus]?.label : (plan.status ? (plan.status.charAt(0).toUpperCase() + plan.status.slice(1)) : "Status Unknown");

  const staticMapApiKeyConst = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  let planImageSrc = `https://placehold.co/80x80.png?text=${encodeURIComponent(plan.name ? plan.name.substring(0, 10) : 'Plan')}&font=Montserrat`;
  let imageHint = plan.eventType || 'event';

  if (plan.photoHighlights && plan.photoHighlights.length > 0 && plan.photoHighlights[0]) {
    planImageSrc = plan.photoHighlights[0];
    imageHint = 'plan highlight';
  } else {
    const firstItineraryItemWithImage = plan.itinerary?.find(item => item.googlePhotoReference || item.googleMapsImageUrl);
    if (firstItineraryItemWithImage?.googlePhotoReference && typeof firstItineraryItemWithImage.googlePhotoReference === 'string' && firstItineraryItemWithImage.googlePhotoReference.trim() !== '') {
      if (staticMapApiKeyConst) {
          // Check if it's already a direct URL (from place-autocomplete)
          if (firstItineraryItemWithImage.googlePhotoReference.startsWith('http://') || firstItineraryItemWithImage.googlePhotoReference.startsWith('https://')) {
            planImageSrc = firstItineraryItemWithImage.googlePhotoReference;
          } else {
            // Use Google Place photo reference
            planImageSrc = getGooglePlacePhotoUrl(firstItineraryItemWithImage.googlePhotoReference, 160, undefined, staticMapApiKeyConst);
          }
          imageHint = firstItineraryItemWithImage.types?.[0] || imageHint;
        } else {
          if (isClient) console.warn(`[PlanCard] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing for Google Place Photo. Plan: ${plan.name}`);
        }
    } else if (firstItineraryItemWithImage?.googleMapsImageUrl) {
        planImageSrc = firstItineraryItemWithImage.googleMapsImageUrl;
        imageHint = 'map location';
    }
  }
  const hostInitial = plan.hostName ? plan.hostName.charAt(0).toUpperCase() : (plan.hostId ? plan.hostId.charAt(0).toUpperCase() : '?');
  const placeholderImageUrl = `https://placehold.co/80x80.png?text=${encodeURIComponent(plan.name ? plan.name.substring(0,10) : 'Img')}&font=Montserrat`;

  return (
    <Card className="group relative overflow-hidden bg-card border border-border/20 rounded-2xl transition-all duration-200 hover:shadow-lg hover:border-border/40">
      <div className="flex flex-col sm:flex-row">
        {/* Image Section */}
        <div className="relative w-full h-40 sm:h-auto sm:w-40 flex-shrink-0 overflow-hidden">
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
          {/* Event & Status Badges */}
          <div className="absolute top-2 left-2 space-y-1">
            {plan.eventType && (
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/70 text-white border-0">
                {plan.eventType}
              </Badge>
            )}
            {displayStatus && (
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/70 text-white border-0 flex items-center">
                <StatusIcon className="h-3 w-3 mr-1" />
                <span className="truncate text-[10px]">{statusLabel}</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="relative flex-1 p-4 pt-6 sm:pt-4 min-w-0">
          {/* More Options – mobile */}
          <div className="absolute top-6 right-0 sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/p/${plan.id}`} className="flex items-center text-xs cursor-pointer">
                    <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                  </Link>
                </DropdownMenuItem>
                {isHost && (
                  <DropdownMenuItem asChild>
                    <Link href={`/plans/create?editId=${plan.id}`} className="flex items-center text-xs cursor-pointer">
                      <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Plan
                    </Link>
                  </DropdownMenuItem>
                )}
                {isHost && plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime)) && plan.status !== 'completed' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMarkAsCompleted(plan.id, plan.name);
                      }}
                      className="flex items-center text-xs cursor-pointer"
                    >
                      <CheckCircle className="mr-2 h-3.5 w-3.5" /> Mark as Completed
                    </DropdownMenuItem>
                  </>
                )}
                {!isHost && plan.status === 'completed' && plan.completionConfirmedBy && !plan.completionConfirmedBy.includes(currentUserUid || '') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleConfirmCompletion(plan.id);
                      }}
                      disabled={isConfirmingCompletion}
                      className="flex items-center text-xs cursor-pointer"
                    >
                      <CheckCircle className="mr-2 h-3.5 w-3.5" /> Confirm Completion
                    </DropdownMenuItem>
                  </>
                )}
                {isHost && handleDeleteRequest && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteRequest(plan.id, plan.name);
                      }}
                      className="flex items-center text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Plan
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Link href={`/plans/${plan.id}`} className="block group-hover:text-primary transition-colors">
            <h3 className="font-semibold text-base leading-tight line-clamp-1 mb-1" title={plan.name}>
              {plan.name}
            </h3>
          </Link>
          
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
          <div className="flex items-start text-sm text-muted-foreground">
            {(plan.averageRating !== undefined && plan.averageRating !== null && typeof plan.averageRating === 'number') ? (
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-1 text-amber-400 fill-amber-400 flex-shrink-0" />
                <span>{plan.averageRating.toFixed(1)} ({plan.reviewCount || 0})</span>
              </div>
            ) : itineraryBrief ? (
              <div className="flex items-start">
                <ListChecks className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-1">{itineraryBrief}</span>
              </div>
            ) : (
              plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime)) && 
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-2 text-muted-foreground/50"/> 
                <span>No reviews yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Date & Status Section */}
        <div className="w-full sm:w-24 p-3 sm:p-4 flex flex-row sm:flex-col items-center sm:items-end justify-between">
          {/* Date Display - Prominent */}
          {/* Mobile overlay for date/template badge */}
          {(
            plan.isTemplate ? true : (formattedDay && formattedMonth && formattedTime)
          ) && (
            <div className="absolute top-2 right-2 sm:hidden">
              {plan.isTemplate ? (
                <div className="bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/30 rounded-xl p-2 text-center min-w-[60px]">
                  <div className="text-[10px] font-semibold text-primary leading-none">TEMPLATE</div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-2 text-center min-w-[60px]">
                  <div className="text-lg font-bold text-primary leading-none">{formattedDay}</div>
                  <div className="text-[9px] font-medium uppercase text-muted-foreground tracking-wide leading-none mt-0.5">{formattedMonth}</div>
                  <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{formattedTime}</div>
                </div>
              )}
            </div>
          )}

          {plan.isTemplate ? (
            <div className="hidden sm:flex bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/30 rounded-xl p-2 text-center w-full flex-col justify-center items-center min-h-[64px]">
              <div className="text-xs font-semibold text-primary leading-none">TEMPLATE</div>
              <div className="text-[10px] text-muted-foreground mt-1">Guide</div>
              {plan.averageRating && (
                <div className="flex items-center text-[10px] text-amber-600 mt-1">
 <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
 {plan.averageRating.toFixed(1)}
                </div>
              )}
            </div>
          ) : (formattedDay && formattedMonth && formattedTime) && (
            <div className="hidden sm:flex bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-2 text-center w-full min-h-[64px] flex-col justify-center">
              <div className="text-2xl font-bold text-primary leading-none">{formattedDay}</div>
              <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide leading-none mt-1">{formattedMonth}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-1">{formattedTime}</div>
            </div>
          )}

          

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-6 w-6 ml-auto sm:ml-0 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/p/${plan.id}`} className="flex items-center text-xs cursor-pointer">
 <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                </Link>
              </DropdownMenuItem>
              {isHost && (
                <DropdownMenuItem asChild>
 <Link href={`/plans/create?editId=${plan.id}`} className="flex items-center text-xs cursor-pointer">
   <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Plan
 </Link>
                </DropdownMenuItem>
              )}
              {/* Completion options for hosts when plan is past event time */}
              {isHost && plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime)) && plan.status !== 'completed' && (
                <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
   onClick={(e) => {
     e.preventDefault();
     e.stopPropagation();
     handleMarkAsCompleted(plan.id, plan.name);
   }}
   className="flex items-center text-xs cursor-pointer"
 >
   <CheckCircle className="mr-2 h-3.5 w-3.5" /> Mark as Completed
 </DropdownMenuItem>
                </>
              )}
              {/* Confirmation option for participants when plan is completed but not confirmed by them */}
              {!isHost && plan.status === 'completed' && plan.completionConfirmedBy && !plan.completionConfirmedBy.includes(currentUserUid || '') && (
                <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
   onClick={(e) => {
     e.preventDefault();
     e.stopPropagation();
     handleConfirmCompletion(plan.id);
   }}
   disabled={isConfirmingCompletion}
   className="flex items-center text-xs cursor-pointer"
 >
   <CheckCircle className="mr-2 h-3.5 w-3.5" /> Confirm Completion
 </DropdownMenuItem>
                </>
              )}
              {isHost && handleDeleteRequest && (
                <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
   onClick={(e) => {
     e.preventDefault();
     e.stopPropagation();
     handleDeleteRequest(plan.id, plan.name);
   }}
   className="flex items-center text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
 >
   <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Plan
 </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
});
PlanCard.displayName = 'PlanCard';

interface PlanStackSectionProps {
  title: string;
  plans: PlanType[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  emptyMessage: string;
  currentUserUid: string | undefined;
  isLoading?: boolean;
  children?: React.ReactNode;
}

const PlanStackSection: React.FC<PlanStackSectionProps> = React.memo(({ title, plans, isExpanded, onToggleExpand, emptyMessage, currentUserUid, isLoading, children }) => {
  const { handleDeleteRequest } = usePlansPageContext();
  
  // Determine section type for ranking
  const sectionType = title.toLowerCase().includes('invitation') ? 'invitations' :
                     title.toLowerCase().includes('awaiting') ? 'awaitingConfirmations' :
                     title.toLowerCase().includes('confirmed') ? 'confirmedReady' :
                     title.toLowerCase().includes('draft') ? 'drafts' : 'upcoming';
  
  // Get appropriate icon for section
  const getSectionIcon = (title: string) => {
    if (title.toLowerCase().includes('invitation')) return Mail;
    if (title.toLowerCase().includes('draft')) return FileText;
    if (title.toLowerCase().includes('awaiting')) return Clock;
    if (title.toLowerCase().includes('confirmed')) return CheckCircle2;
    if (title.toLowerCase().includes('saved templates')) return Star;
    return CalendarDays;
  };
  
  const SectionIcon = getSectionIcon(title);
  
  const plansToShowHorizontally = useMemo(() => {
    if (!plans || plans.length === 0) return [];
    return getRankedPlansForSection(plans, sectionType);
  }, [plans, sectionType]);

  // Number of additional plans not shown when the section is collapsed (over the 4 displayed horizontally)
  const extraCount = Math.max(0, plans.length - 4);
  const formattedExtraCount = extraCount > 999 ? '1k' : extraCount;


  if (isLoading && (!plans || plans.length === 0)) { 
    return (
      <div className="mt-6 mb-8">
        <div className="flex justify-between items-center mb-3 pb-1 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <div className="relative mt-3 space-y-3">
          {[...Array(1)].map((_, index) => ( // Show one skeleton card for loading
            <Card key={index} className="overflow-hidden shadow-md bg-card text-card-foreground flex flex-col h-full rounded-lg animate-pulse border border-border/30">
              <div className="flex p-3 items-start gap-3 flex-grow">
                <div className="flex flex-col items-center shrink-0 w-20">
 <div className="bg-muted h-20 w-20 rounded-lg"></div>
 <div className="bg-card border border-border/50 shadow-sm rounded-md p-1 text-center w-full mt-2 min-h-[60px]">
   <div className="h-6 bg-muted rounded-sm w-1/2 mx-auto mb-1"></div>
   <div className="h-3 bg-muted rounded-sm w-1/3 mx-auto mb-1"></div>
   <div className="h-3 bg-muted rounded-sm w-1/4 mx-auto"></div>
 </div>
                </div>
                <div className="flex-grow space-y-2 pt-1">
 <div className="h-4 bg-muted rounded w-3/4"></div>
 <div className="h-3 bg-muted rounded w-1/2"></div>
 <div className="h-3 bg-muted rounded w-full mt-1"></div>
 <div className="flex gap-1 mt-2">
     <div className="h-4 w-16 bg-muted rounded-full"></div>
     <div className="h-4 w-20 bg-muted rounded-full"></div>
 </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (plans.length === 0 && !isExpanded) { // Don't show empty sections if collapsed
     return null;
  }
  
  return (
    <div className="mt-6 mb-8">
       <div className="flex justify-between items-center mb-4 pb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <SectionIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{title} ({plans.length})</h2>
        </div>
        {plans.length > 0 && (
           <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-7 p-1 text-xs text-white hover:text-primary-foreground hover:bg-primary/90 transition-colors"
            aria-label={isExpanded ? `Collapse ${title} section` : `View all ${plans.length} items in ${title}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                View All
                {extraCount > 0 && (
                  <span className="ml-2 bg-primary/20 text-white px-2 rounded-full text-[10px] font-medium">
                    +{formattedExtraCount} more
                  </span>
                )}
              </>
            )}

          </Button>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className={cn(
            "transition-all duration-500 ease-in-out",
            isExpanded ? "opacity-100 max-h-[2000px]" : "opacity-0 max-h-0"
          )}
        >
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">{emptyMessage}</p>
          ) : (
            <div className="space-y-3 mt-3 pb-2">
              {plans.map((plan, index) => (
                <div
                  key={plan.id}
                  className="transform transition-all duration-300 ease-out"
                  style={{
                    transitionDelay: `${index * 50}ms`,
                  }}
                >
                  <HorizontalListPlanCard plan={plan} currentUserUid={currentUserUid} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "transition-all duration-500 ease-in-out",
            !isExpanded ? "opacity-100 max-h-[400px]" : "opacity-0 max-h-0"
          )}
        >
          {plansToShowHorizontally.length > 0 && (
            <div className="mt-3">
              <HorizontalPlanCards 
                plans={plansToShowHorizontally} 
                currentUserUid={currentUserUid} 
              />
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
});
PlanStackSection.displayName = 'PlanStackSection';

// Mixed Status Priority + Hybrid Ranking Logic
const getRankedPlansForSection = (plans: PlanType[], sectionType: string) => {
  const now = new Date();
  const today = startOfDay(now);
  const endOfWeekDate = endOfWeek(now);
  const endOfMonthDate = endOfMonth(now);

  return [...plans]
    .map(plan => ({
      ...plan,
      priority: calculatePriority(plan, sectionType, today, endOfWeekDate, endOfMonthDate),
      eventDate: plan.eventTime ? parseISO(plan.eventTime) : null
    }))
    .sort((a, b) => {
      // Primary: Status priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Secondary: Date-based hybrid approach
      return compareByDateHybrid(a, b, sectionType);
    })
    .slice(0, 4); // Top 4 for horizontal display
};

const calculatePriority = (plan: PlanType, sectionType: string, today: Date, endOfWeekDate: Date, endOfMonthDate: Date) => {
  const eventDate = plan.eventTime ? parseISO(plan.eventTime) : null;
  
  switch(sectionType) {
    case 'invitations':
      if (eventDate && isSameDay(eventDate, today)) return 1;
      if (eventDate && isWithinInterval(eventDate, {start: today, end: endOfWeekDate})) return 2;
      return 3;
      
    case 'awaitingConfirmations':
      if (eventDate && isSameDay(eventDate, today)) return 1;
      if (eventDate && isWithinInterval(eventDate, {start: today, end: endOfWeekDate})) return 2;
      // Note: rsvpDeadline field would need to be added to plan type for this to work
      // if (plan.rsvpDeadline && isWithinInterval(parseISO(plan.rsvpDeadline), {start: today, end: endOfWeekDate})) return 3;
      return 4;
      
    case 'confirmedReady':
      if (eventDate && isSameDay(eventDate, today)) return 1;
      if (eventDate && isWithinInterval(eventDate, {start: today, end: endOfWeekDate})) return 2;
      if (eventDate && isWithinInterval(eventDate, {start: today, end: endOfMonthDate})) return 3;
      return 4;
      
    case 'drafts':
      if (eventDate && isWithinInterval(eventDate, {start: today, end: endOfWeekDate})) return 1;
      if (plan.updatedAt && isWithinInterval(parseISO(plan.updatedAt), {start: subDays(today, 7), end: today})) return 2;
      return 3;
      
    default:
      return 1;
  }
};

const compareByDateHybrid = (a: any, b: any, sectionType: string) => {
  const timeA = a.eventDate ? a.eventDate.getTime() : 0;
  const timeB = b.eventDate ? b.eventDate.getTime() : 0;
  
  if (sectionType === 'upcoming' || sectionType === 'invitations' || sectionType === 'awaitingConfirmations' || sectionType === 'confirmedReady') {
    // For upcoming: soonest first (ascending)
    if (timeA === 0 && timeB === 0) {
      // Both have no dates, sort by updatedAt or createdAt
      const updateA = a.updatedAt ? parseISO(a.updatedAt).getTime() : (a.createdAt ? parseISO(a.createdAt).getTime() : 0);
      const updateB = b.updatedAt ? parseISO(b.updatedAt).getTime() : (b.createdAt ? parseISO(b.createdAt).getTime() : 0);
      return updateB - updateA; // Most recent first
    }
    if (timeA === 0) return 1; // No date goes to end
    if (timeB === 0) return -1;
    return timeA - timeB; // Soonest first
  } else {
    // For past: most recent first (descending)
    if (timeA === 0 && timeB === 0) {
      const updateA = a.updatedAt ? parseISO(a.updatedAt).getTime() : (a.createdAt ? parseISO(a.createdAt).getTime() : 0);
      const updateB = b.updatedAt ? parseISO(b.updatedAt).getTime() : (b.createdAt ? parseISO(b.createdAt).getTime() : 0);
      return updateB - updateA;
    }
    return timeB - timeA; // Most recent first
  }
};

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const currentUserId = user?.uid;

  const [allUserPlans, setAllUserPlans] = useState<PlanType[]>([]);
  const [savedPlans, setSavedPlans] = useState<PlanType[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSavedPlans, setLoadingSavedPlans] = useState(true);
  const [pendingShares, setPendingShares] = useState<PlanShare[]>([]);

  const [shareToAccept, setShareToAccept] = useState<PlanShare | null>(null);
  const [isAcceptingShare, setIsAcceptingShare] = useState(false);
  const [shareToDecline, setShareToDecline] = useState<PlanShare | null>(null);
  const [isDecliningShare, setIsDecliningShare] = useState(false);

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'saved'>('upcoming');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedSections, setExpandedSections] = useState({
    shares: false,
    invitations: false,
    myAwaitingResponses: false,
    myConfirmedReady: false,
    savedDrafts: false,
    savedTemplates: false,
  });

  const toggleSectionExpansion = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Handle date selection with filtering
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsDateFilterActive(!isSameDay(date, new Date()));
  }, []);

  // Handle search query changes
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Clear search function
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Clear all filters function
  const handleClearFilters = useCallback(() => {
    setSelectedDate(new Date());
    setIsDateFilterActive(false);
    setSearchQuery('');
  }, []);

  // Apply search filtering to plans
  const applySearchFilter = useCallback((plans: PlanType[]) => {
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase().trim();
    return plans.filter(plan => {
      // Search in plan name
      if (plan.name?.toLowerCase().includes(query)) return true;
      
      // Search in plan description
      if (plan.description?.toLowerCase().includes(query)) return true;
      
      // Search in itinerary items
      if (plan.itinerary?.some(item => 
        item.placeName?.toLowerCase().includes(query) || 
        item.description?.toLowerCase().includes(query) ||
        item.address?.toLowerCase().includes(query)
      )) return true;
      
      // Search in event type
      if (plan.eventType?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [searchQuery]);

  // Apply date filtering to plans
  const applyDateFilter = useCallback((plans: PlanType[]) => {
    if (!isDateFilterActive) return plans;
    
    return plans.filter(plan => {
      if (!plan.eventTime) return false;
      try {
        const planDate = parseISO(plan.eventTime);
        return isValid(planDate) && isSameDay(planDate, selectedDate);
      } catch (e) {
        return false;
      }
    });
  }, [isDateFilterActive, selectedDate]);

  // Combined filtering function
  const applyAllFilters = useCallback((plans: PlanType[]) => {
    return applySearchFilter(applyDateFilter(plans));
  }, [applyDateFilter, applySearchFilter]);
  
  const onPlansUpdateCallback = useCallback((plans: PlanType[], initialLoadComplete: boolean) => {
    setAllUserPlans(plans);
    if (initialLoadComplete) {
      setLoadingPlans(false);
      console.log(`[PlansPage onPlansUpdateCallback] Initial load complete. setLoadingPlans to false. Plans count: ${plans.length}`);
    } else {
      console.log(`[PlansPage onPlansUpdateCallback] Incremental update. Plans count: ${plans.length}`);
    }
  }, [setAllUserPlans, setLoadingPlans]);

  const onPendingSharesUpdate = useCallback((shares: PlanShare[]) => {
    console.log(`[PlansPage onPendingSharesUpdate] Received ${shares.length} pending shares.`);
    setPendingShares(shares);
  }, [setPendingShares]);

  // Effect for listener management based on currentUserId
  useEffect(() => {
    console.log("[PlansPage] Listener useEffect. UserID:", currentUserId);
    if (!currentUserId) {
      console.log("[PlansPage] No user for listeners. Clearing data, setting loadingPlans false.");
      setAllUserPlans([]);
      setPendingShares([]);
      setLoadingPlans(false); // No user, so not loading plans.
      return () => {
        console.log("[PlansPage] Cleanup: No user, no listeners to unsubscribe.");
      };
    }

    // User is present, set up listeners
    console.log(`[PlansPage] User identified: ${currentUserId}. Setting up listeners. Setting loadingPlans true.`);
    setLoadingPlans(true); // Start loading state for this user's plans
    setAllUserPlans([]);   // Clear previous data
    setPendingShares([]);

    const unsubPlans = getUserPlans(
      currentUserId,
      onPlansUpdateCallback // This callback handles setLoadingPlans(false) after initial load
    );
    const unsubShares = getPendingPlanSharesForUser(currentUserId, onPendingSharesUpdate);

    return () => {
      console.log(`[PlansPage] Cleanup: Unsubscribing listeners for user: ${currentUserId}`);
      if (unsubPlans) unsubPlans();
      if (unsubShares) unsubShares();
    };
  }, [currentUserId, onPlansUpdateCallback, onPendingSharesUpdate]); // Callbacks are stable

  // Effect to handle visual loading state based on authLoading
  useEffect(() => {
    console.log("[PlansPage] AuthLoading useEffect. AuthLoading:", authLoading, "UserID:", currentUserId);
    if (authLoading) {
      console.log("[PlansPage] Auth is loading. Setting loadingPlans to true.");
      setLoadingPlans(true);
    } else {
      // Auth is no longer loading.
      // If there's no currentUserId, the other effect will have set loadingPlans to false.
      // If there IS a currentUserId, loading state is managed by the listener setup and its callback.
      // This effect primarily ensures loading is true if auth is happening.
      // If auth just finished AND we don't have a user, ensure loading is false.
      if (!currentUserId) {
        console.log("[PlansPage] Auth finished, no user. Setting loadingPlans to false.");
        setLoadingPlans(false);
      }
    }
  }, [authLoading, currentUserId]);

  // Memoize the saved plans fetch function to prevent unnecessary re-creation
  const fetchSavedPlans = useCallback(async (userId: string) => {
    setLoadingSavedPlans(true);
    try {
      const savedPlanIds = await getUserSavedPlans(userId);
      if (savedPlanIds.length === 0) {
        setSavedPlans([]);
        return;
      }

      // Fetch each saved plan
      const planPromises = savedPlanIds.map(planId => getPlanById(planId));
      const plans = await Promise.all(planPromises);
      
      // Filter out null results and ensure we have valid plans
      const validPlans = plans.filter((plan): plan is PlanType => plan !== null);
      setSavedPlans(validPlans);
    } catch (error) {
      console.error('Error fetching saved plans:', error);
      setSavedPlans([]);
    } finally {
      setLoadingSavedPlans(false);
    }
  }, []);

  // Effect to fetch saved plans - optimized to prevent unnecessary calls
  useEffect(() => {
    if (!currentUserId) {
      setSavedPlans([]);
      setLoadingSavedPlans(false);
      return;
    }

    fetchSavedPlans(currentUserId);
  }, [currentUserId, fetchSavedPlans]);

  // Simple date-based sorting for plans (newest first)
  const sortedPlans = useMemo(() => {
    return [...allUserPlans].sort((a, b) => {
      const timeA = a.eventTime && isValid(parseISO(a.eventTime)) 
        ? parseISO(a.eventTime).getTime() 
        : -Infinity;
      const timeB = b.eventTime && isValid(parseISO(b.eventTime)) 
        ? parseISO(b.eventTime).getTime() 
        : -Infinity;
      
      return timeB - timeA; // Newest first
    });
  }, [allUserPlans]);

  const upcomingPlansBase = useMemo(() => {
    if (!currentUserId) return [];
    return sortedPlans.filter(plan => {
      if (!plan.eventTime) return false;
      try {
        const planDate = parseISO(plan.eventTime);
        return isValid(planDate) && isFuture(planDate);
      } catch (e) { return false; }
    });
  }, [sortedPlans, currentUserId]);

  const invitedToPlans = useMemo(() => {
    if (!currentUserId) return [];
    const baseInvited = upcomingPlansBase.filter(plan => {
      const isInvitedUser = (plan.invitedParticipantUserIds || []).includes(currentUserId);
      const isHost = plan.hostId === currentUserId;
      if (isHost) return false; // Exclude plans hosted by the user from "Invitations"
  
      const currentUserRsvp = plan.participantResponses?.[currentUserId];
      return isInvitedUser && plan.status === 'published' &&
             (!currentUserRsvp || currentUserRsvp === 'pending' || currentUserRsvp === 'maybe');
    });
    return applyAllFilters(baseInvited);
  }, [upcomingPlansBase, currentUserId, applyAllFilters]);
  
  // Saved plans categorization
  const savedDrafts = useMemo(() => {
    if (!currentUserId) return [];
    const baseDrafts = sortedPlans.filter(plan => plan.hostId === currentUserId && plan.status === 'draft');
    return applyAllFilters(baseDrafts);
  }, [sortedPlans, currentUserId, applyAllFilters]);

  const savedTemplates = useMemo(() => {
    if (!currentUserId) return [];
    const baseTemplates = savedPlans.filter(plan => plan.isTemplate || plan.hostId !== currentUserId);
    return applyAllFilters(baseTemplates);
  }, [savedPlans, currentUserId, applyAllFilters]);
  
  const myPublishedHostedUpcoming = useMemo(() => {
    if (!currentUserId) return [];
    const basePublished = upcomingPlansBase.filter(plan => plan.hostId === currentUserId && plan.status === 'published');
    return applyAllFilters(basePublished);
  }, [upcomingPlansBase, currentUserId, applyAllFilters]);

  const myAwaitingResponsesPlans = useMemo(() => {
    if (!currentUserId) return [];
    return myPublishedHostedUpcoming.filter(plan => {
      const allRelevantUidsPlusHost = Array.from(new Set([plan.hostId, ...(plan.invitedParticipantUserIds || [])])).filter(Boolean);
      if (allRelevantUidsPlusHost.length <= 1 && plan.hostId === currentUserId) return false; // Host-only plan isn't "awaiting others"
      return !allRelevantUidsPlusHost.every(uid => plan.participantResponses?.[uid] === 'going');
    });
  }, [myPublishedHostedUpcoming, currentUserId]);
  
  const myConfirmedReadyPlans = useMemo(() => {
    if (!currentUserId) return [];
    const baseConfirmed = upcomingPlansBase.filter(plan => { // Filter from all upcoming plans the user is involved in
        const isHost = plan.hostId === currentUserId;
        const isInvitedAndGoing = (plan.invitedParticipantUserIds || []).includes(currentUserId) && plan.participantResponses?.[currentUserId] === 'going';
        
        if (!isHost && !isInvitedAndGoing) return false; // User not involved or not going
        if (plan.status !== 'published') return false;

        const allRelevantUidsPlusHost = Array.from(new Set([plan.hostId, ...(plan.invitedParticipantUserIds || [])])).filter(Boolean);
        if (allRelevantUidsPlusHost.length === 0) return false; // Should not happen
        return allRelevantUidsPlusHost.every(uid => plan.participantResponses?.[uid] === 'going');
    });
    return applyAllFilters(baseConfirmed);
  }, [upcomingPlansBase, currentUserId, applyAllFilters]);

  const upcomingPlansExist = useMemo(() => 
    invitedToPlans.length > 0 ||
    pendingShares.length > 0 || 
    myAwaitingResponsesPlans.length > 0 ||
    myConfirmedReadyPlans.length > 0,
    [invitedToPlans, pendingShares, myAwaitingResponsesPlans, myConfirmedReadyPlans]
  );

  const pastPlans = useMemo(() => {
    if (!currentUserId) return [];
    const basePast = sortedPlans.filter(plan => {
      const isUserRelated = plan.hostId === currentUserId || (plan.invitedParticipantUserIds || []).includes(currentUserId);
      if (!isUserRelated || !plan.eventTime) return false;
      try {
        const planDate = parseISO(plan.eventTime);
        return isValid(planDate) && isPast(planDate);
      } catch (e) { return false; }
    });
    return applyAllFilters(basePast);
  }, [sortedPlans, currentUserId, applyAllFilters]);

  const handleAcceptShareRequest = useCallback(async (share: PlanShare) => {
    if (!user || !currentUserId) return;
    setShareToAccept(share);
    setIsAcceptingShare(true);

    try {
      const idToken = await user.getIdToken();
      const result = await acceptPlanShareAction(share.id, idToken);
      if (result.success && result.newPlanId) {
        toast({ title: "Plan Accepted!", description: `"${share.originalPlanName}" added to your plans as a draft.` });
        router.push(`/plans/${result.newPlanId}`); 
      } else {
        throw new Error(result.error || 'Failed to accept plan');
      }
    } catch (error) {
      console.error('Error accepting plan share:', error);
      toast({ title: "Error", description: "Failed to accept the plan. Please try again.", variant: "destructive" });
    } finally {
      setIsAcceptingShare(false);
      setShareToAccept(null);
    }
  }, [user, currentUserId, toast, router]);
  
  const handleDeclineShareRequest = useCallback(async (share: PlanShare) => {
    if (!user || !currentUserId) return;
    setShareToDecline(share);
    setIsDecliningShare(true);

    try {
      const idToken = await user.getIdToken();
      const result = await declinePlanShareAction(share.id, idToken);
      if (result.success) {
        toast({ title: "Plan Declined", description: "You have declined the shared plan." });
      } else {
        throw new Error(result.error || 'Failed to decline plan');
      }
    } catch (error) {
      console.error('Error declining plan share:', error);
      toast({ title: "Error", description: "Failed to decline the plan. Please try again.", variant: "destructive" });
    } finally {
      setIsDecliningShare(false);
      setShareToDecline(null);
    }
  }, [user, currentUserId, toast]);

  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [planToComplete, setPlanToComplete] = useState<{ id: string; name: string } | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isConfirmingCompletion, setIsConfirmingCompletion] = useState(false);

  const handleDeleteRequest = useCallback((planId: string, planName: string) => {
    setPlanToDelete({ id: planId, name: planName });
  }, []);

  const confirmDeletePlan = useCallback(async () => {
    if (!planToDelete || !user || !currentUserId) return; 
    setIsDeletingPlan(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token is missing.");
      const result = await deletePlanAction(planToDelete.id, idToken);
      if (result.success) {
        toast({ title: "Plan Deleted", description: `"${planToDelete.name}" has been removed.` });
        // Optimistic update handled by onSnapshot if it's fast enough
        // Or, if direct removal is preferred:
        // setAllUserPlans(prev => prev.filter(p => p.id !== planToDelete.id));
      } else {
        toast({ title: "Error Deleting Plan", description: result.error || "Could not delete the plan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsDeletingPlan(false);
      setPlanToDelete(null);
    }
  }, [planToDelete, user, currentUserId, toast]);

  const handleMarkAsCompleted = useCallback((planId: string, planName: string) => {
    setPlanToComplete({ id: planId, name: planName });
  }, []);

  const confirmMarkAsCompleted = useCallback(async () => {
    if (!planToComplete || !user || !currentUserId) return;
    
    setIsMarkingComplete(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token is missing.");
      const result = await markPlanAsCompletedAction(planToComplete.id, idToken);
      if (result.success) {
        toast({
          title: "Plan marked as completed",
          description: `"${planToComplete.name}" has been marked as completed and will appear in the explore section.`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to mark the plan as completed.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingComplete(false);
      setPlanToComplete(null);
    }
  }, [planToComplete, user, currentUserId, toast]);

  const handleConfirmCompletion = useCallback(async (planId: string) => {
    if (!user || !currentUserId) return;
    
    setIsConfirmingCompletion(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token is missing.");
      const result = await confirmPlanCompletionAction(planId, idToken);
      if (result.success) {
        toast({
          title: "Completion confirmed",
          description: "You have confirmed this plan's completion.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to confirm completion.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsConfirmingCompletion(false);
    }
  }, [user, currentUserId, toast]);

  // Filtered plan categories
  const filteredInvitedToPlans = useMemo(() => {
    return applyAllFilters(invitedToPlans);
  }, [invitedToPlans, applyAllFilters]);

  const filteredSavedDrafts = useMemo(() => {
    return applyAllFilters(savedDrafts);
  }, [savedDrafts, applyAllFilters]);

  const filteredSavedTemplates = useMemo(() => {
    return applyAllFilters(savedTemplates);
  }, [savedTemplates, applyAllFilters]);

  const filteredMyAwaitingResponsesPlans = useMemo(() => {
    return applyAllFilters(myAwaitingResponsesPlans);
  }, [myAwaitingResponsesPlans, applyAllFilters]);

  const filteredMyConfirmedReadyPlans = useMemo(() => {
    return applyAllFilters(myConfirmedReadyPlans);
  }, [myConfirmedReadyPlans, applyAllFilters]);

  const filteredUpcomingPlans = useMemo(() => {
    const plans = [
      ...filteredInvitedToPlans,
      ...filteredMyAwaitingResponsesPlans,
      ...filteredMyConfirmedReadyPlans
    ];
    return plans;
  }, [filteredInvitedToPlans, filteredMyAwaitingResponsesPlans, filteredMyConfirmedReadyPlans]);

  const allFilteredSavedPlans = useMemo(() => {
    return [
      ...filteredSavedDrafts,
      ...filteredSavedTemplates
    ];
  }, [filteredSavedDrafts, filteredSavedTemplates]);

  const filteredPastPlans = useMemo(() => {
    return applyAllFilters(pastPlans);
  }, [pastPlans, applyAllFilters]);

  const filteredSavedPlans = useMemo(() => {
    // Sort saved plans by event time (newest first)
    const plans = [...savedPlans];
    plans.sort((a, b) => {
      const timeA = a.eventTime && isValid(parseISO(a.eventTime)) ? parseISO(a.eventTime).getTime() : -Infinity;
      const timeB = b.eventTime && isValid(parseISO(b.eventTime)) ? parseISO(b.eventTime).getTime() : -Infinity;
      return timeB - timeA;
    });
    return applyAllFilters(plans);
  }, [savedPlans, applyAllFilters]);

  // Check if we have any results to show
  const hasUpcomingResults = filteredUpcomingPlans.length > 0 || pendingShares.length > 0;
  const hasPastResults = filteredPastPlans.length > 0;
  const hasSavedResults = allFilteredSavedPlans.length > 0;

  if (authLoading && !currentUserId) { 
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!currentUserId && !authLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center text-center">
         <h2 className="text-xl font-semibold">Please Log In</h2>
         <p className="text-muted-foreground mb-4">Log in to see and manage your plans.</p>
         <Button asChild><Link href="/login">Login</Link></Button>
      </div>
    );
  }

  return (
    <PlansPageProvider 
          handleDeleteRequest={handleDeleteRequest}
          handleMarkAsCompleted={handleMarkAsCompleted}
          handleConfirmCompletion={handleConfirmCompletion}
          isConfirmingCompletion={isConfirmingCompletion}
        >
      <div className="flex flex-col h-screen bg-background text-foreground">
        <PlansPageHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          userName={user?.displayName || user?.email?.split('@')[0] || 'User'}
          plansForDate={allUserPlans}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upcoming' | 'past')} className="h-full flex flex-col">
            <div className="flex-1 overflow-auto px-4 pt-4">
              <TabsContent value="upcoming" className="mt-0 h-full">
                {loadingPlans && !upcomingPlansExist && (
                  <div className="flex justify-center items-center py-10 min-h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {!loadingPlans && !hasUpcomingResults && (
                  <PlansEmptyState 
                    title="No Upcoming Plans" 
                    message="You have no upcoming plans. Ready to create your next adventure?"
                    searchQuery={searchQuery}
                    selectedDate={selectedDate}
                    isSearchActive={searchQuery.trim().length > 0}
                    isDateFilterActive={isDateFilterActive}
                    onClearSearch={handleClearSearch}
                    onClearFilters={handleClearFilters}
                  />
                )}

                {pendingShares.length > 0 && (
                  <PlanStackSection
                    title="Shared With You"
                    plans={[]} 
                    isExpanded={expandedSections.shares}
                    onToggleExpand={() => toggleSectionExpansion('shares')}
                    emptyMessage="No new plans shared with you."
                    currentUserUid={currentUserId}
                    isLoading={loadingPlans && pendingShares.length === 0} 
                  >
                    {expandedSections.shares && (
                      <div className="space-y-3 mt-3">
                        {pendingShares.map(share => (
                          <Card key={share.id} className="p-3 bg-card/80 border border-border/50">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={share.sharedByAvatarUrl || undefined} alt={share.sharedByName} data-ai-hint="person avatar"/>
                                <AvatarFallback className="text-sm">{share.sharedByName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                              </Avatar>
                              <div className="flex-grow">
                                <p className="text-sm font-medium text-foreground/90">
                                  <span className="font-semibold text-primary">{share.sharedByName}</span> shared:
                                </p>
                                <p className="text-xs text-muted-foreground">"{share.originalPlanName}"</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" asChild className="h-7 w-7 text-muted-foreground hover:text-primary" aria-label="View Original Plan">
                                  <Link href={`/p/${share.originalPlanId}`}><Eye className="h-3.5 w-3.5"/></Link>
                                </Button>
                                <Button size="icon" className="h-7 w-7" onClick={() => handleAcceptShareRequest(share)} disabled={isAcceptingShare && shareToAccept?.id === share.id} aria-label="Accept Plan">
                                  {(isAcceptingShare && shareToAccept?.id === share.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="mr-0 h-3.5 w-3.5"/>}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeclineShareRequest(share)} disabled={isDecliningShare && shareToDecline?.id === share.id} aria-label="Decline Plan">
                                  {(isDecliningShare && shareToDecline?.id === share.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </PlanStackSection>
                )}
                
                {filteredInvitedToPlans.length > 0 && (
                  <PlanStackSection
                    title="Your Invitations"
                    plans={filteredInvitedToPlans}
                    isExpanded={expandedSections.invitations}
                    onToggleExpand={() => toggleSectionExpansion('invitations')}
                    emptyMessage="You have no pending invitations."
                    currentUserUid={currentUserId}
                  />
                )}

                {filteredMyAwaitingResponsesPlans.length > 0 && (
                  <PlanStackSection
                    title="Awaiting Guest Confirmations"
                    plans={filteredMyAwaitingResponsesPlans}
                    isExpanded={expandedSections.myAwaitingResponses}
                    onToggleExpand={() => toggleSectionExpansion('myAwaitingResponses')}
                    emptyMessage="All published plans have full attendance or no invitees pending."
                    currentUserUid={currentUserId}
                  />
                )}
                {filteredMyConfirmedReadyPlans.length > 0 && (
                  <PlanStackSection
                    title="Confirmed & Ready"
                    plans={filteredMyConfirmedReadyPlans}
                    isExpanded={expandedSections.myConfirmedReady}
                    onToggleExpand={() => toggleSectionExpansion('myConfirmedReady')}
                    emptyMessage="No confirmed plans ready to go."
                    currentUserUid={currentUserId}
                  />
                )}
              </TabsContent>

              <TabsContent value="past" className="mt-0">
                {loadingPlans && pastPlans.length === 0 && (
                  <div className="flex justify-center items-center py-10 min-h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {!loadingPlans && !hasPastResults && (
                  <PlansEmptyState 
                    title="No Past Plans" 
                    message="Looks like your adventure log is empty here. Completed plans will show up once they're done!"
                    searchQuery={searchQuery}
                    selectedDate={selectedDate}
                    isSearchActive={searchQuery.trim().length > 0}
                    isDateFilterActive={isDateFilterActive}
                    onClearSearch={handleClearSearch}
                    onClearFilters={handleClearFilters}
                  />
                )}
                {!loadingPlans && hasPastResults && (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredPastPlans.map(plan => (
                      <PlanCard key={plan.id} plan={plan} currentUserUid={currentUserId} />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="saved" className="mt-0">
                {loadingSavedPlans && savedPlans.length === 0 && savedDrafts.length === 0 && (
                  <div className="flex justify-center items-center py-10 min-h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {!loadingSavedPlans && !hasSavedResults && (
                  <PlansEmptyState 
                    title="No Saved Plans" 
                    message="You have no drafts or saved templates. Create a plan or explore to find great activity ideas!" 
                    showCreateButton={true}
                    searchQuery={searchQuery}
                    selectedDate={selectedDate}
                    isSearchActive={searchQuery.trim().length > 0}
                    isDateFilterActive={isDateFilterActive}
                    onClearSearch={handleClearSearch}
                    onClearFilters={handleClearFilters}
                  />
                )}

                {filteredSavedDrafts.length > 0 && (
                  <PlanStackSection
                    title="My Drafts"
                    plans={filteredSavedDrafts}
                    isExpanded={expandedSections.savedDrafts}
                    onToggleExpand={() => toggleSectionExpansion('savedDrafts')}
                    emptyMessage="You have no draft plans."
                    currentUserUid={currentUserId}
                    isLoading={loadingSavedPlans && savedDrafts.length === 0}
                  />
                )}
                {filteredSavedTemplates.length > 0 && (
                  <PlanStackSection
                    title="Saved Templates"
                    plans={filteredSavedTemplates}
                    isExpanded={expandedSections.savedTemplates}
                    onToggleExpand={() => toggleSectionExpansion('savedTemplates')}
                    emptyMessage="You have no saved templates."
                    currentUserUid={currentUserId}
                    isLoading={loadingSavedPlans && savedPlans.length === 0}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
        
        <AlertDialog open={!!shareToAccept} onOpenChange={(open) => { if (!open) setShareToAccept(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept Shared Plan?</AlertDialogTitle>
              <AlertDialogDescription>
                Accepting "{shareToAccept?.originalPlanName}" from <span className="font-semibold">{shareToAccept?.sharedByName}</span> will add it to your plans as a new draft.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShareToAccept(null)} disabled={isAcceptingShare} aria-label="Cancel Share Acceptance">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
 if (shareToAccept) await handleAcceptShareRequest(shareToAccept);
              }} disabled={isAcceptingShare} aria-label="Confirm Share Acceptance">
                {(isAcceptingShare) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4"/>}
                Accept & Add
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!shareToDecline} onOpenChange={(open) => { if (!open) setShareToDecline(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline Shared Plan?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to decline the plan "{shareToDecline?.originalPlanName}" shared by <span className="font-semibold">{shareToDecline?.sharedByName}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShareToDecline(null)} disabled={isDecliningShare} aria-label="Cancel Share Decline">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
 if(shareToDecline) await handleDeclineShareRequest(shareToDecline);
              }} disabled={isDecliningShare} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" aria-label="Confirm Share Decline">
{(isDecliningShare) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4"/>}
                Decline
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!planToDelete} onOpenChange={(open) => { if (!open) setPlanToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the plan "{planToDelete?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPlanToDelete(null)} disabled={isDeletingPlan} aria-label="Cancel Delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePlan} disabled={isDeletingPlan} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" aria-label="Confirm Delete">
                {isDeletingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!planToComplete} onOpenChange={(open) => { if (!open) setPlanToComplete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Plan as Completed?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark "{planToComplete?.name}" as completed? This will make it visible in the explore section for other users to discover.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPlanToComplete(null)} disabled={isMarkingComplete} aria-label="Cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmMarkAsCompleted} disabled={isMarkingComplete} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isMarkingComplete ? "Marking..." : "Mark as Completed"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PlansPageProvider>
  );
}
