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
  PlusCircle, Edit3, Trash2, Share2, CalendarDays, MapPin, Eye, Search,
  ArrowUpDown, Users as UsersIcon, MailQuestion, UserCheck, History, MoreVertical,
  List as ListIconLucide, ChevronDown, ChevronUp, PackageOpen, Loader2, Star, ListChecks, CheckCircle2, CheckCircle
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import React, { useState, useMemo, useEffect, useCallback, useContext } from 'react';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getUserPlans, getPendingPlanSharesForUser, getPlanById } from '@/services/planService';
import { getUserSavedPlans } from '@/services/userService';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import { deletePlanAction, acceptPlanShareAction, declinePlanShareAction } from '@/app/actions/planActions';
import { markPlanAsCompletedAction, confirmPlanCompletionAction } from '@/app/actions/planCompletionActions';
import type { Plan as PlanType, PlanShare, RSVPStatusType, UserRoleType } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useRouter } from "next/navigation";
import { PlansPageProvider, usePlansPageContext } from '@/context/PlansPageContext';

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
    <Card className="group overflow-hidden bg-card border border-border/20 rounded-2xl transition-all duration-200 hover:shadow-lg hover:border-border/40">
      <div className="flex h-32">
        {/* Image Section */}
        <div className="relative w-32 flex-shrink-0 overflow-hidden">
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
          {/* Event Type Badge */}
          {plan.eventType && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/70 text-white border-0">
                {plan.eventType}
              </Badge>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 min-w-0">
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
        <div className="w-20 p-4 flex flex-col items-center justify-between">
          {/* Date Display - Prominent */}
          {plan.isTemplate ? (
            <div className="bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/30 rounded-xl p-2 text-center w-full flex flex-col justify-center items-center min-h-[64px]">
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
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-2 text-center w-full min-h-[64px] flex flex-col justify-center">
              <div className="text-2xl font-bold text-primary leading-none">{formattedDay}</div>
              <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide leading-none mt-1">{formattedMonth}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-1">{formattedTime}</div>
            </div>
          )}

          {/* Status Badge */}
          {displayStatus && (
            <Badge
              variant={statusBadgeVariant as any}
              className="text-xs px-2 py-1 mt-2 w-full justify-center"
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              <span className="truncate text-[10px]">{statusLabel}</span>
            </Badge>
          )}

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 mt-1 text-muted-foreground hover:text-foreground">
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
              {isHost && plan.eventTime && isValid(parseISO(plan.eventTime)) && isPast(parseISO(plan.eventTime)) && !plan.isCompleted && (
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
              {!isHost && plan.isCompleted && plan.completionConfirmedBy && !plan.completionConfirmedBy.includes(currentUserUid || '') && (
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
  
  const plansToShowInStack = useMemo(() => {
    if (!plans || plans.length === 0) return [];
    // Sort by eventTime descending for the stack view, regardless of global sort
    return [...plans]
      .sort((a, b) => {
        const timeA = a.eventTime && isValid(parseISO(a.eventTime)) ? parseISO(a.eventTime).getTime() : 0;
        const timeB = b.eventTime && isValid(parseISO(b.eventTime)) ? parseISO(b.eventTime).getTime() : 0;
        return timeB - timeA; 
      })
      .slice(0, 3);
  }, [plans]);

  if (isLoading && (!plans || plans.length === 0)) { 
    return (
      <div className="mt-6">
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
    <div className="mt-6">
       <div className="flex justify-between items-center mb-4 pb-1 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{title} ({plans.length})</h2>
        {plans.length > 0 && (
           <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-7 p-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? `Collapse ${title} section` : `View all ${plans.length} items in ${title}`}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {isExpanded ? "Collapse" : `View All`}
          </Button>
        )}
      </div>

      {isExpanded ? (
        plans.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-3">{emptyMessage}</p>
        ) : (
            <div className="grid grid-cols-1 gap-4 mt-3">
              {plans.map(plan => <PlanCard key={plan.id} plan={plan} currentUserUid={currentUserUid} />)}
            </div>
        )
      ) : (
        plansToShowInStack.length > 0 && (
          <div
            className="relative cursor-pointer mt-3"
            onClick={onToggleExpand}
            style={{ minHeight: `${100 + Math.min(plansToShowInStack.length > 1 ? plansToShowInStack.length - 1 : 0, 2) * 10}px` }} 
            role="button"
            tabIndex={0}
            aria-label={`View ${plans.length} items in ${title}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand();}}
          >
            {plansToShowInStack.map((plan, index) => (
              <div
                key={plan.id}
                className={cn(
                  "absolute w-full transition-all duration-300 ease-out origin-top",
                  index === 0 && "z-[3]",
                  index === 1 && "z-[2] opacity-80",
                  index === 2 && "z-[1] opacity-60",
                )}
                style={{
                  transform: `translateY(${index * 10}px) scale(${1 - index * 0.02})`, 
                  pointerEvents: index === 0 ? 'auto' : 'none', 
                }}
              >
                 <div 
                    className={cn(index === 0 && "shadow-xl rounded-lg", "pointer-events-auto")}
                    onClick={(e) => { if (index !== 0) e.stopPropagation(); else onToggleExpand(); }}
                 >
                    <PlanCard plan={plan} currentUserUid={currentUserUid} />
                </div>
              </div>
            ))}
            {plans.length > 3 && ( 
              <div className="absolute bottom-0 right-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full shadow-lg z-[4]"
                style={{ transform: `translateY(${Math.min(2, plansToShowInStack.length > 0 ? plansToShowInStack.length -1 : 0) * 10 + 5}px)` }}
              >
                +{plans.length - plansToShowInStack.length} more
              </div>
            )}
          </div>
        )
      )}
      {children}
    </div>
  );
});
PlanStackSection.displayName = 'PlanStackSection';

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();
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

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'saved'>('upcoming');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  const [expandedSections, setExpandedSections] = useState({
    shares: false,
    invitations: false,
    myDrafts: false,
    myAwaitingResponses: false,
    myConfirmedReady: false,
  });

  const toggleSectionExpansion = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);
  
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


  const handleSortCycle = () => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === 'date' && prevConfig.direction === 'desc') return { key: 'date', direction: 'asc' };
      if (prevConfig.key === 'date' && prevConfig.direction === 'asc') return { key: 'name', direction: 'asc' };
      if (prevConfig.key === 'name' && prevConfig.direction === 'asc') return { key: 'name', direction: 'desc' };
      return { key: 'date', direction: 'desc' };
    });
  };

  // Memoize expensive filtering and sorting operations
  const baseFilteredPlans = useMemo(() => {
    if (searchTerm && viewMode === 'list') {
      const searchTermLower = searchTerm.toLowerCase();
      return allUserPlans.filter(plan =>
        plan.name.toLowerCase().includes(searchTermLower) ||
        (plan.description && plan.description.toLowerCase().includes(searchTermLower)) ||
        plan.location.toLowerCase().includes(searchTermLower)
      );
    }
    return allUserPlans;
  }, [allUserPlans, searchTerm, viewMode]);

  const sortedPlans = useMemo(() => {
    if (viewMode !== 'list') return baseFilteredPlans;
    
    return [...baseFilteredPlans].sort((a, b) => {
      if (sortConfig.key === 'name') {
        const comparison = (a.name || '').localeCompare(b.name || '');
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      const timeA = a.eventTime && isValid(parseISO(a.eventTime)) 
        ? parseISO(a.eventTime).getTime() 
        : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      const timeB = b.eventTime && isValid(parseISO(b.eventTime)) 
        ? parseISO(b.eventTime).getTime() 
        : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      
      return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [baseFilteredPlans, sortConfig, viewMode]);

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
    return upcomingPlansBase.filter(plan => {
      const isInvitedUser = (plan.invitedParticipantUserIds || []).includes(currentUserId);
      const isHost = plan.hostId === currentUserId;
      if (isHost) return false; // Exclude plans hosted by the user from "Invitations"
  
      const currentUserRsvp = plan.participantResponses?.[currentUserId];
      return isInvitedUser && plan.status === 'published' &&
             (!currentUserRsvp || currentUserRsvp === 'pending' || currentUserRsvp === 'maybe');
    });
  }, [upcomingPlansBase, currentUserId]);
  
  const myDrafts = useMemo(() => {
    if (!currentUserId) return [];
    return upcomingPlansBase.filter(plan => plan.hostId === currentUserId && plan.status === 'draft');
  }, [upcomingPlansBase, currentUserId]);
  
  const myPublishedHostedUpcoming = useMemo(() => {
    if (!currentUserId) return [];
    return upcomingPlansBase.filter(plan => plan.hostId === currentUserId && plan.status === 'published');
  }, [upcomingPlansBase, currentUserId]);

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
    return upcomingPlansBase.filter(plan => { // Filter from all upcoming plans the user is involved in
        const isHost = plan.hostId === currentUserId;
        const isInvitedAndGoing = (plan.invitedParticipantUserIds || []).includes(currentUserId) && plan.participantResponses?.[currentUserId] === 'going';
        
        if (!isHost && !isInvitedAndGoing) return false; // User not involved or not going
        if (plan.status !== 'published') return false;

        const allRelevantUidsPlusHost = Array.from(new Set([plan.hostId, ...(plan.invitedParticipantUserIds || [])])).filter(Boolean);
        if (allRelevantUidsPlusHost.length === 0) return false; // Should not happen
        return allRelevantUidsPlusHost.every(uid => plan.participantResponses?.[uid] === 'going');
    });
  }, [upcomingPlansBase, currentUserId]);

  const upcomingPlansExist = useMemo(() => 
    invitedToPlans.length > 0 ||
    pendingShares.length > 0 || 
    myDrafts.length > 0 ||
    myAwaitingResponsesPlans.length > 0 ||
    myConfirmedReadyPlans.length > 0,
    [invitedToPlans, pendingShares, myDrafts, myAwaitingResponsesPlans, myConfirmedReadyPlans]
  );

  const pastPlans = useMemo(() => {
    if (!currentUserId) return [];
    return sortedPlans.filter(plan => {
      const isUserRelated = plan.hostId === currentUserId || (plan.invitedParticipantUserIds || []).includes(currentUserId);
      if (!isUserRelated || !plan.eventTime) return false;
      try {
        const planDate = parseISO(plan.eventTime);
        return isValid(planDate) && isPast(planDate);
      } catch (e) { return false; }
    });
  }, [sortedPlans, currentUserId]);

  const filteredSavedPlans = useMemo(() => {
    let plans = [...savedPlans];
    if (searchTerm && viewMode === 'list') {
      plans = plans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        plan.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // Sort saved plans by event time (newest first)
    plans.sort((a, b) => {
      const timeA = a.eventTime && isValid(parseISO(a.eventTime)) ? parseISO(a.eventTime).getTime() : -Infinity;
      const timeB = b.eventTime && isValid(parseISO(b.eventTime)) ? parseISO(b.eventTime).getTime() : -Infinity;
      return timeB - timeA;
    });
    return plans;
  }, [savedPlans, searchTerm, viewMode]);

  const plansForCalendar = useMemo(() => {
    const uniqueUpcomingPlans = new Map<string, PlanType>();
    [
      ...invitedToPlans, 
      ...myDrafts, 
      ...myAwaitingResponsesPlans, 
      ...myConfirmedReadyPlans,
    ].forEach(p => uniqueUpcomingPlans.set(p.id, p));
    
    return activeTab === 'upcoming' ? Array.from(uniqueUpcomingPlans.values()) : pastPlans;
  }, [activeTab, invitedToPlans, myDrafts, myAwaitingResponsesPlans, myConfirmedReadyPlans, pastPlans]);

  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    plansForCalendar.forEach(plan => {
      if (plan.eventTime && isValid(parseISO(plan.eventTime))) {
        dates.push(parseISO(plan.eventTime));
      }
    });
    return dates;
  }, [plansForCalendar]);

  const plansForSelectedDate = useMemo(() => {
    if (!selectedDate || !isValid(selectedDate)) return [];
    return plansForCalendar.filter(plan => {
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isSameDay(planDate, selectedDate);
    });
  }, [selectedDate, plansForCalendar]);
  
  let calendarFooter = <p className="text-sm text-muted-foreground p-3 text-center">Please pick a day to see plans.</p>;
  if (selectedDate && isValid(selectedDate)) {
    if (plansForSelectedDate.length > 0) {
      calendarFooter = (
        <div className="p-3 pt-2 max-h-48 overflow-y-auto custom-scrollbar-vertical">
          <h4 className="font-medium text-sm mb-1.5 text-foreground/80">
            Plans for {format(selectedDate, 'PPP')}
          </h4>
          <ul className="space-y-1.5">
            {plansForSelectedDate.map(plan => (
              <li key={plan.id} className="text-xs">
                <Link href={currentUserId && (currentUserId === plan.hostId || plan.invitedParticipantUserIds?.includes(currentUserId)) ? `/plans/${plan.id}` : `/p/${plan.id}`} className="hover:underline text-primary flex items-center gap-1.5">
                  <span className="truncate">{plan.name}</span>
                  <Badge variant="outline" className="text-xs px-1 py-0 leading-tight">{plan.eventTime && isValid(parseISO(plan.eventTime)) ? format(parseISO(plan.eventTime), 'p') : 'No time'}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    } else {
      calendarFooter = <p className="text-sm text-muted-foreground p-3 text-center">No plans for {format(selectedDate, 'PPP')}.</p>;
    }
  }

  const handleAcceptShareRequest = useCallback(async (share: PlanShare) => {
    if (!user || !currentUserId) return;
    setShareToAccept(share);
    setIsAcceptingShare(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token is missing.");
      const result = await acceptPlanShareAction(share.id, idToken);
      if (result.success && result.newPlanId) {
        toast({ title: "Plan Accepted!", description: `"${share.originalPlanName}" added to your plans as a draft.` });
        router.push(`/plans/${result.newPlanId}`); 
      } else {
        toast({ title: "Accept Failed", description: result.error || "Could not accept shared plan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to accept share.", variant: "destructive" });
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
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token is missing.");
      const result = await declinePlanShareAction(share.id, idToken);
      if (result.success) {
        toast({ title: "Share Declined", description: "The shared plan invitation has been declined." });
      } else {
        toast({ title: "Decline Failed", description: result.error || "Could not decline share.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to decline share.", variant: "destructive" });
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

  const EmptyState = ({ title, message, showCreateButton = true }: { title: string; message: string, showCreateButton?: boolean }) => (
    <div className="text-center py-12 sm:py-16 flex flex-col items-center">
      <PackageOpen className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground/30 mb-6" />
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm text-sm sm:text-base">{message}</p>
      {showCreateButton && (
         <Button variant="outline" size="lg" className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary" asChild>
            <Link href="/plans/generate" className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" /> Create New Plan
            </Link>
          </Button>
      )}
    </div>
  );

  interface DayWithDotProps { date: Date; displayMonth: Date; }
  const DayWithDot = ({ date, displayMonth }: DayWithDotProps): React.ReactElement | null => {
    const isCurrentDisplayMonth = isValid(date) && isValid(displayMonth) && date.getMonth() === displayMonth.getMonth();
    const hasEvent = isValid(date) && eventDates.some(eventDateItem => isValid(eventDateItem) && isSameDay(eventDateItem, date));
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        {isValid(date) ? format(date, 'd') : ''}
        {hasEvent && isCurrentDisplayMonth && selectedDate && isValid(selectedDate) && isSameDay(date, selectedDate) && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
        {hasEvent && isCurrentDisplayMonth && selectedDate && isValid(selectedDate) && !isSameDay(date, selectedDate) && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
        {hasEvent && isCurrentDisplayMonth && (!selectedDate || !isValid(selectedDate)) && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </div>
    );
  };
  
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
      <div className="space-y-0"> 
        <div className="px-4 sm:px-0 pt-4 sm:pt-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground/60 opacity-60 mb-2 sm:mb-4">My Plans</h1>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upcoming' | 'past')} className="w-full">
          {/* Mobile-optimized header with reorganized layout */}
          <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border shadow-sm px-4 sm:px-0">
            {/* Top row: Search, List/Calendar buttons, and Sort button */}
            <div className="flex items-center justify-between gap-2 w-full py-2">
              <div className={cn("relative flex-1 min-w-0", isSearchFocused && "flex-grow")}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Add a small delay to ensure any tap/click events are processed first
                    setTimeout(() => setIsSearchFocused(false), 200);
                  }}
                  className="pl-8 sm:pl-10 bg-card border-border text-sm h-8 sm:h-9 rounded-lg focus:ring-primary focus:border-primary w-full"
                  disabled={viewMode === 'calendar'}
                  placeholder="Search plans..."
                />
              </div>
              
              {/* View mode buttons next to search */}
              <div className="flex items-center gap-1 ml-3">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200",
                    viewMode === 'list'
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-card border-border hover:bg-secondary/50"
                  )}
                >
                  <ListIconLucide className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline ml-1.5">List</span>
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm transition-all duration-200",
                    viewMode === 'calendar'
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-card border-border hover:bg-secondary/50"
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline ml-1.5">Calendar</span>
                </Button>
              </div>
              
              {/* Sort button - only show when not searching on mobile */}
              {viewMode === 'list' && (
                <Button 
                  variant="outline" 
                  onClick={handleSortCycle} 
                  size="sm" 
                  className={cn(
                    "bg-card border-border hover:bg-secondary/50 text-xs sm:text-sm rounded-lg h-8 sm:h-9 flex-shrink-0 transition-all duration-300 ml-2",
                    isSearchFocused && isMobile && "w-0 opacity-0 scale-x-0 invisible overflow-hidden"
                  )}
                >
                  <span className="hidden sm:inline">{sortConfig.key === 'date' ? 'Date' : 'Name'}</span>
                  <ArrowUpDown className="h-3.5 w-3.5 sm:ml-1.5 sm:h-4 sm:w-4" />
                  <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                </Button>
              )}
            </div>
            
            {/* Second row: Centered plan switcher with icons */}
            <div className="flex justify-center pb-2">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors relative flex items-center",
                    activeTab === 'upcoming'
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Upcoming
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors relative flex items-center",
                    activeTab === 'saved'
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Saved Templates</span>
                  <span className="sm:hidden">Saved</span>
                </button>
                <button
                  onClick={() => setActiveTab('past')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors relative flex items-center",
                    activeTab === 'past'
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="h-4 w-4 mr-1.5" />
                  Past
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 px-4 sm:px-0">
            {viewMode === 'list' ? (
                <>
                <TabsContent value="upcoming" className="mt-0">
                    {loadingPlans && !upcomingPlansExist && (
                        <div className="flex justify-center items-center py-10 min-h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    {!loadingPlans && !upcomingPlansExist && searchTerm === '' && (
                        <EmptyState title="No Upcoming Plans" message="You have no upcoming plans. Ready to create your next adventure?" />
                    )}
                    {!loadingPlans && !upcomingPlansExist && searchTerm !== '' && (
                        <EmptyState title="No Plans Found" message={`Your search for "${searchTerm}" did not match any upcoming plans.`} showCreateButton={false} />
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
                    
                     {invitedToPlans.length > 0 && (
                        <PlanStackSection
                            title="Your Invitations"
                            plans={invitedToPlans}
                            isExpanded={expandedSections.invitations}
                            onToggleExpand={() => toggleSectionExpansion('invitations')}
                            emptyMessage="You have no pending invitations."
                            currentUserUid={currentUserId}
                        />
                    )}
                    {myDrafts.length > 0 && (
                    <PlanStackSection
                        title="My Drafts"
                        plans={myDrafts}
                        isExpanded={expandedSections.myDrafts}
                        onToggleExpand={() => toggleSectionExpansion('myDrafts')}
                        emptyMessage="You have no draft plans."
                        currentUserUid={currentUserId}
                        isLoading={loadingPlans && myDrafts.length === 0 && allUserPlans.length === 0 && pendingShares.length === 0 && invitedToPlans.length === 0}
                    />
                    )}
                     {myAwaitingResponsesPlans.length > 0 && (
                        <PlanStackSection
                            title="Awaiting Guest Confirmations"
                            plans={myAwaitingResponsesPlans}
                            isExpanded={expandedSections.myAwaitingResponses}
                            onToggleExpand={() => toggleSectionExpansion('myAwaitingResponses')}
                            emptyMessage="All published plans have full attendance or no invitees pending."
                            currentUserUid={currentUserId}
                        />
                    )}
                    {myConfirmedReadyPlans.length > 0 && (
                        <PlanStackSection
                            title="Confirmed & Ready"
                            plans={myConfirmedReadyPlans}
                            isExpanded={expandedSections.myConfirmedReady}
                            onToggleExpand={() => toggleSectionExpansion('myConfirmedReady')}
                            emptyMessage="No upcoming plans are fully confirmed by all participants yet."
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
                    {!loadingPlans && pastPlans.length === 0 && searchTerm === '' && (
                        <EmptyState title="No Past Plans" message="Looks like your adventure log is empty here. Completed plans will show up once they're done!" />
                    )}
                    {!loadingPlans && pastPlans.length === 0 && searchTerm !== '' && (
                        <EmptyState title="No Past Plans Found" message={`Your search for "${searchTerm}" did not match any past plans.`} showCreateButton={false} />
                    )}
                    {!loadingPlans && pastPlans.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {pastPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} currentUserUid={currentUserId} />
                        ))}
                    </div>
                    )}
                </TabsContent>
                
                <TabsContent value="saved" className="mt-0">
                    {loadingSavedPlans && savedPlans.length === 0 && (
                        <div className="flex justify-center items-center py-10 min-h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    {!loadingSavedPlans && savedPlans.length === 0 && searchTerm === '' && (
                        <EmptyState title="No Saved Templates" message="You haven't saved any activity templates yet. Explore the discover page to find great activity ideas and save them for later!" showCreateButton={false} />
                    )}
                    {!loadingSavedPlans && filteredSavedPlans.length === 0 && searchTerm !== '' && (
                        <EmptyState title="No Templates Found" message={`Your search for "${searchTerm}" did not match any saved activity templates.`} showCreateButton={false} />
                    )}
                    {!loadingSavedPlans && filteredSavedPlans.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredSavedPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} currentUserUid={currentUserId} />
                        ))}
                    </div>
                    )}
                </TabsContent>
                </>
            ) : ( 
                <TabsContent value={activeTab} className="mt-0">
                {(loadingPlans && plansForCalendar.length === 0 && !searchTerm) ? (
                    <div className="flex justify-center items-center py-20 min-h-[300px]">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : plansForCalendar.length === 0 ? (
                    <EmptyState
                        title={activeTab === 'upcoming' ? "No Upcoming Plans" : "No Past Plans"}
                        message={activeTab === 'upcoming' ? "No upcoming plans to show on the calendar." : "No past plans to show on the calendar."}
                    />
                ) : (
                    <div className="bg-card p-2 sm:p-4 rounded-lg shadow">
                        <CalendarComponent
                            mode="single"
                            selected={selectedDate}
                            onSelect={(day) => {
                                if (day && isValid(day)) {
                                setSelectedDate(day);
                                setCurrentMonth(startOfMonth(day));
                                } else {
                                setSelectedDate(undefined);
                                }
                            }}
                            month={currentMonth}
                            onMonthChange={setCurrentMonth}
                            className="rounded-md [&_button[name=day]]:rounded-md"
                            classNames={{
                                day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground',
                                day_today: 'bg-accent text-accent-foreground',
                                months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center',
                                month: 'space-y-4 w-full sm:w-auto',
                                caption_label: 'text-lg font-medium text-foreground/90',
                                head_cell: 'text-muted-foreground rounded-md w-full sm:w-10 font-normal text-[0.8rem]',
                                cell: 'h-10 w-full sm:w-10 text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                                day: 'h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-md',
                                nav_button: cn(
                                buttonVariants({ variant: "outline" }),
                                "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100"
                                ),
                            }}
                            components={{ DayContent: DayWithDot }}
                            footer={calendarFooter}
                            modifiers={{ event: eventDates.filter(date => isValid(date)) as Date[] }}
                            modifiersClassNames={{ event: 'has-event' }}
                        />
                    </div>
                )}
                </TabsContent>
            )}
          </div>
        </Tabs>
        
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
