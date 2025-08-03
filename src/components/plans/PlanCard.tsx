'use client';

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  PencilSquareIcon,
  TrashIcon,
  ShareIcon,
  MapPinIcon,
  EyeIcon,
  UserGroupIcon,
  EnvelopeIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  UserGroupIcon as UsersIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid, startOfDay, endOfWeek, endOfMonth, isWithinInterval, subDays, differenceInHours } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getUserPlans, getPendingPlanSharesForUser, getPlanById } from '@/services/clientServices';
import { PlanImageLoader } from '@/components/plans/PlanImageLoader';
import { deletePlanAction, acceptPlanShareAction, declinePlanShareAction } from '@/app/actions/planActions';
import { markPlanAsCompletedAction, confirmPlanCompletionAction } from '@/app/actions/planCompletionActions';
import type { Plan as PlanType, PlanShare, RSVPStatusType, UserRoleType } from '@/types/user';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { usePlansPageContext } from '@/context/PlansPageContext';
import { PlanDropdownMenu } from '@/components/plans/PlanDropdownMenu';

// Define UserPlanViewStatus enum and its configuration
export enum UserPlanViewStatus {
  INVITED_TO_PLAN = 'INVITED_TO_PLAN',
  MY_DRAFT_UPCOMING = 'MY_DRAFT_UPCOMING',
  MY_AWAITING_RESPONSES = 'MY_AWAITING_RESPONSES',
  MY_CONFIRMED_READY = 'MY_CONFIRMED_READY',
  COMPLETED = 'COMPLETED',
}

export const userPlanViewStatusConfig: Record<UserPlanViewStatus, { label: string; icon: React.ElementType; badgeVariant: "default" | "secondary" | "destructive" | "outline" | "premium" }> = {
  [UserPlanViewStatus.INVITED_TO_PLAN]: { label: 'Invitation', icon: EnvelopeIcon, badgeVariant: 'default' },
  [UserPlanViewStatus.MY_DRAFT_UPCOMING]: { label: 'Draft', icon: PencilSquareIcon, badgeVariant: 'outline' },
  [UserPlanViewStatus.MY_AWAITING_RESPONSES]: { label: 'Awaiting Confirmations', icon: UsersIcon, badgeVariant: 'secondary' },
  [UserPlanViewStatus.MY_CONFIRMED_READY]: { label: 'Confirmed & Ready', icon: CheckCircleIcon, badgeVariant: 'default' },
  [UserPlanViewStatus.COMPLETED]: { label: 'Completed', icon: ClockIcon, badgeVariant: 'outline' },
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

  const [timeUrgency, setTimeUrgency] = useState<'urgent' | 'soon' | 'normal'>('normal');
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);

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

    // Calculate time urgency for upcoming plans
    if (planEventDate && isFuture(planEventDate)) {
      const hoursToEvent = differenceInHours(planEventDate, new Date());
      if (hoursToEvent <= 2) {
        setTimeUrgency('urgent');
      } else if (hoursToEvent <= 24) {
        setTimeUrgency('soon');
      } else {
        setTimeUrgency('normal');
      }
    }

    // Calculate completion percentage for drafts
    if (plan.status === 'draft') {
      let score = 0;
      if (plan.name) score += 20;
      if (plan.description) score += 15;
      if (plan.eventTime) score += 20;
      if (plan.location) score += 15;
      if (plan.itinerary?.length > 0) score += 20;
      if (plan.invitedParticipantUserIds?.length > 0) score += 10;
      setCompletionPercentage(score);
    }

  }, [plan, currentUserUid]);

  if (!isClient) {
    return (
      <Link href={`/plans/${plan.id}`} className="block h-full">
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
            <div className="flex-grow min-w-0">
              <div className="h-4 bg-muted rounded-sm w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded-sm w-1/2 mb-1"></div>
              <div className="h-3 bg-muted rounded-sm w-2/3"></div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/plans/${plan.id}`} className="block h-full">
      <Card className="overflow-hidden shadow-md bg-card text-card-foreground flex flex-col h-full rounded-lg border border-border/30 hover:shadow-lg transition-shadow hover:border-primary/30 transition-all duration-300 hover:scale-[1.01] cursor-pointer">
        <div className="flex p-3 items-start gap-3 flex-grow">
          <div className="flex flex-col items-center shrink-0 w-20">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/50">
              <PlanImageLoader plan={plan} className="w-full h-full object-cover" />
            </div>
            <div className="bg-card border border-border/50 shadow-sm rounded-md p-1 text-center w-full mt-2 min-h-[60px]">
              <div className="text-lg font-bold text-foreground">{formattedDay}</div>
              <div className="text-xs text-muted-foreground">{formattedMonth}</div>
              <div className="text-xs text-muted-foreground">{formattedTime}</div>
            </div>
          </div>
        
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
                {plan.name}
              </h3>
              <PlanDropdownMenu plan={plan} currentUserUid={currentUserUid} isHost={isHost} />
            </div>
            
            {displayStatus && (
              <div className="flex items-center gap-1 mb-1">
                <Badge variant={userPlanViewStatusConfig[displayStatus].badgeVariant} className="text-xs px-1.5 py-0.5">
                  {React.createElement(userPlanViewStatusConfig[displayStatus].icon, { className: "h-3 w-3 mr-1" })}
                  {userPlanViewStatusConfig[displayStatus].label}
                </Badge>
                {timeUrgency === 'urgent' && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Urgent
                  </Badge>
                )}
              </div>
            )}
            
            {itineraryBrief && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                {itineraryBrief}
              </p>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="h-4 w-4 mr-2" />
              <span className="truncate">{plan.location}</span>
            </div>
            
            {plan.status === 'draft' && (
              <div className="mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                  <span>Completion: {completionPercentage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div 
                    className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}); 