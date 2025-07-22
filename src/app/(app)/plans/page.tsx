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
  Edit3, Trash2, Share2, MapPin, Eye,
  Users as UsersIcon, MailQuestion, UserCheck, History, MoreVertical,
  ChevronDown, ChevronUp, Loader2, ListChecks, CheckCircle,
  Users, Sparkles, Clock
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import React, { useState, useMemo, useEffect, useCallback, useContext, useRef } from 'react';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid, startOfDay, endOfWeek, endOfMonth, isWithinInterval, subDays, differenceInHours } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getUserPlans, getPendingPlanSharesForUser, getPlanById } from '@/services/clientServices';
// getUserSavedPlans moved to server actions
import { PlanImageLoader } from '@/components/plans/PlanImageLoader';
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
import { PlansWithTimelineTags } from '@/components/plans/TimelineTagsComponent';
import { getPostComments, getUserProfile, getUserPlansSubscription, getUserSavedPlans } from '@/services/clientServices';
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { PlanDropdownMenu } from '@/components/plans/PlanDropdownMenu';

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
  const { handleDeleteRequest, showTimelineTags, toggleTimelineTags } = usePlansPageContext();
  
  // Determine section type for ranking
  const sectionType = title.toLowerCase().includes('invitation') ? 'invitations' :
                     title.toLowerCase().includes('awaiting') ? 'awaitingConfirmations' :
                     title.toLowerCase().includes('confirmed') ? 'confirmedReady' :
                     title.toLowerCase().includes('draft') ? 'drafts' : 'upcoming';
  
  // Generate personalized end-of-section message
  const getEndOfSectionMessage = (title: string, planCount: number) => {
    const titleLower = title.toLowerCase();
    
    // Upcoming tab sections
    if (titleLower.includes('shared with you')) {
      return `🎁 That's all the plans shared with you right now! Keep exploring to discover new adventures.`;
    }
    if (titleLower.includes('invitation')) {
      return `📮 You're all caught up on invitations! Time to RSVP and start planning some fun.`;
    }
    if (titleLower.includes('awaiting')) {
      return `⏳ All your plans awaiting responses are shown above. Your guests will love these ideas!`;
    }
    if (titleLower.includes('confirmed')) {
      return `🎉 These are all your confirmed plans! Get excited - great times are ahead.`;
    }
    
    // Past tab sections  
    if (titleLower.includes('completed today')) {
      return `✨ What a productive day! You've completed ${planCount} plan${planCount !== 1 ? 's' : ''} today.`;
    }
    if (titleLower.includes('this week')) {
      return `🌟 Amazing week of adventures! You've been quite busy making memories.`;
    }
    if (titleLower.includes('this month')) {
      return `📅 Look at all those completed plans from this month! You're creating quite the adventure story.`;
    }
    if (titleLower.includes('earlier')) {
      return `📚 These are your earlier adventures - what a journey you've been on! Each plan tells a story.`;
    }
    
    // Saved tab sections
    if (titleLower.includes('recent drafts')) {
      return `📝 You're up to date with your recent drafts! Ready to turn these ideas into reality?`;
    }
    if (titleLower.includes('ready to publish')) {
      return `🚀 These drafts are polished and ready! Time to hit publish and make them happen.`;
    }
    if (titleLower.includes('in progress')) {
      return `⚡ Keep up the great work on these plans! Each detail brings you closer to an amazing experience.`;
    }
    if (titleLower.includes('ideas & concepts')) {
      return `💡 Every great plan starts with a spark! These ideas have potential - nurture them when inspiration strikes.`;
    }
    if (titleLower.includes('recently saved')) {
      return `⭐ These are your latest discoveries! Great taste in saving quality plans for future adventures.`;
    }
    if (titleLower.includes('top rated')) {
      return `🌟 You've got excellent taste! These highly-rated templates are proven crowd-pleasers.`;
    }
    if (titleLower.includes('food & dining')) {
      return `🍽️ Bon appétit! You've got all the best culinary adventures saved up for delicious times ahead.`;
    }
    if (titleLower.includes('adventure & outdoors')) {
      return `🏞️ Adventure awaits! These outdoor plans will fuel your wanderlust and create unforgettable memories.`;
    }
    if (titleLower.includes('arts & culture')) {
      return `🎨 How cultured! These artistic experiences will feed your soul and broaden your horizons.`;
    }
    if (titleLower.includes('nightlife')) {
      return `🌙 Ready to paint the town! These nightlife plans promise unforgettable evenings out.`;
    }
    if (titleLower.includes('shopping')) {
      return `🛍️ Shop 'til you drop! These retail therapy sessions are perfectly curated for your next spree.`;
    }
    if (titleLower.includes('other templates')) {
      return `📋 You've explored every corner of your saved templates! Quite the diverse collection of experiences.`;
    }
    
    // Default fallback
    return `✨ You've reached the end of this section! Great job staying organized with your plans.`;
  };
  
  // Get appropriate emoji for section
  const getSectionEmoji = (title: string) => {
    // Check if title already starts with an emoji - if so, return empty string to avoid duplicates
    const emojiRegex = /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]|^[\u{2B00}-\u{2BFF}]|^[\u{3000}-\u{303F}]|^[\u{1F900}-\u{1F9FF}]/u;
    if (emojiRegex.test(title)) return '';
    
    if (title.toLowerCase().includes('invitation')) return '💌';
    if (title.toLowerCase().includes('draft')) return '📝';
    if (title.toLowerCase().includes('awaiting')) return '⏳';
    if (title.toLowerCase().includes('confirmed')) return '✅';
    if (title.toLowerCase().includes('saved templates')) return '⭐';
    if (title.toLowerCase().includes('shared')) return '🤝';
    if (title.toLowerCase().includes('this week')) return '📅';
    if (title.toLowerCase().includes('today')) return '🎯';
    if (title.toLowerCase().includes('tomorrow')) return '⏰';
    if (title.toLowerCase().includes('month')) return '📆';
    if (title.toLowerCase().includes('earlier')) return '📜';
    if (title.toLowerCase().includes('recent')) return '✨';
    if (title.toLowerCase().includes('template')) return '🌟';
    if (title.toLowerCase().includes('food') || title.toLowerCase().includes('dining')) return '🍽️';
    if (title.toLowerCase().includes('adventure')) return '🏔️';
    if (title.toLowerCase().includes('culture')) return '🎭';
    if (title.toLowerCase().includes('nightlife')) return '🌙';
    if (title.toLowerCase().includes('shopping')) return '🛍️';
    return '📋';
  };
  
  const sectionEmoji = getSectionEmoji(title);
  
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
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1.5">
            <span className="text-base opacity-50 animate-pulse">📋</span>
            <h2 className="text-base font-medium text-foreground">{title}</h2>
            <span className="bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs font-medium animate-pulse">
              ...
            </span>
          </div>
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
       <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1.5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-primary/15">
          <span className="text-base">{sectionEmoji}</span>
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <span className="bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
            {plans.length}
          </span>
        </div>
        {plans.length > 0 && (
           <div className="flex items-center gap-2">
             {/* Timeline tags toggle button - only show in Past tab for relevant sections */}
             {isExpanded && 
              (title.toLowerCase().includes('this week') || title.toLowerCase().includes('this month') || 
              title.toLowerCase().includes('today') || title.toLowerCase().includes('earlier')) && (
               <Button
                 onClick={toggleTimelineTags}
                 variant="ghost"
                 size="sm"
                 className={cn(
                   "flex items-center gap-1 px-2 py-1 h-8 text-xs rounded-full",
                   showTimelineTags ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                 )}
               >
                 <Clock className="h-3.5 w-3.5 mr-1" />
                 Timeline
               </Button>
             )}
             <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-8 w-8 flex items-center justify-center text-primary hover:text-primary-foreground hover:bg-primary transition-all duration-300 rounded-full shadow-sm hover:shadow-md hover:scale-105 font-medium"
              aria-label={isExpanded ? `Collapse ${title} section` : `View all ${plans.length} items in ${title}`}
            >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {/* Show Less */}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {/* View All */}
              </>
            )}

          </Button>
           </div>
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
            <>
              {showTimelineTags && (title.toLowerCase().includes('this week') || title.toLowerCase().includes('this month') || title.toLowerCase().includes('today') || title.toLowerCase().includes('earlier')) ? (
                <PlansWithTimelineTags
                  plans={plans}
                  sectionTitle={title}
                  currentUserUid={currentUserUid}
                  renderPlan={(plan) => <HorizontalListPlanCard plan={plan} currentUserUid={currentUserUid} />}
                />
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
              {/* End of section message */}
              {plans.length > 0 && (
                <div className="text-center py-4 mt-2 opacity-60 transition-opacity duration-300 hover:opacity-80">
                  <p className="text-xs text-muted-foreground italic leading-relaxed max-w-md mx-auto">
                    {getEndOfSectionMessage(title, plans.length)}
                  </p>
                </div>
              )}
            </>
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

// Enhanced Smart Ranking Logic
const getRankedPlansForSection = (plans: PlanType[], sectionType: string) => {
  const now = new Date();
  const today = startOfDay(now);
  const endOfWeekDate = endOfWeek(now);
  const endOfMonthDate = endOfMonth(now);

  return [...plans]
    .map(plan => ({
      ...plan,
      priority: calculatePriority(plan, sectionType, today, endOfWeekDate, endOfMonthDate),
      eventDate: plan.eventTime ? parseISO(plan.eventTime) : null,
      // Add enhanced sorting metrics
      urgencyScore: calculateUrgencyScore(plan, now),
      completionScore: plan.status === 'draft' ? calculateCompletionScore(plan) : 100,
      responseScore: calculateResponseScore(plan)
    }))
    .sort((a, b) => {
      // Section-specific smart sorting
      if (sectionType.includes('invitation') || sectionType.includes('confirmedReady') || sectionType.includes('awaiting')) {
        // For upcoming: urgency first, then responses
        if (a.urgencyScore !== b.urgencyScore) return b.urgencyScore - a.urgencyScore;
        if (a.responseScore !== b.responseScore) return b.responseScore - a.responseScore;
      } else if (sectionType.includes('draft') || sectionType.includes('Draft')) {
        // For drafts: completion score first
        if (a.completionScore !== b.completionScore) return b.completionScore - a.completionScore;
      } else if (sectionType.includes('template') || sectionType.includes('Template')) {
        // For templates: rating first
        const aRating = a.averageRating || 0;
        const bRating = b.averageRating || 0;
        if (aRating !== bRating) return bRating - aRating;
      }
      
      // Primary: Status priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Secondary: Date-based hybrid approach
      return compareByDateHybrid(a, b, sectionType);
    })
    .slice(0, 4); // Top 4 for horizontal display
};

// Helper function to calculate urgency score
const calculateUrgencyScore = (plan: PlanType, today: Date): number => {
  if (!plan.eventTime || !isValid(parseISO(plan.eventTime))) return 0;
  
  const eventDate = parseISO(plan.eventTime);
  if (isPast(eventDate)) return 0;
  
  const hoursToEvent = differenceInHours(eventDate, today);
  
  if (hoursToEvent <= 2) return 100; // Critical urgency
  if (hoursToEvent <= 6) return 80;  // High urgency
  if (hoursToEvent <= 24) return 60; // Medium urgency
  if (hoursToEvent <= 72) return 40; // Low urgency
  return 20; // Very low urgency
};

// Helper function to calculate completion score for drafts
const calculateCompletionScore = (plan: PlanType): number => {
  let score = 0;
  if (plan.name) score += 20;
  if (plan.description) score += 15;
  if (plan.eventTime) score += 20;
  if (plan.location) score += 15;
  if (plan.itinerary?.length > 0) score += 20;
  if (plan.invitedParticipantUserIds?.length > 0) score += 10;
  return score;
};

// Helper function to calculate response score
const calculateResponseScore = (plan: PlanType): number => {
  if (!plan.invitedParticipantUserIds?.length) return 50; // No invites = neutral
  
  const responses = plan.participantResponses || {};
  const allParticipants = [plan.hostId, ...(plan.invitedParticipantUserIds || [])];
  const totalParticipants = allParticipants.length;
  
  const going = allParticipants.filter(uid => responses[uid] === 'going' || uid === plan.hostId).length;
  const pending = allParticipants.filter(uid => !responses[uid] || responses[uid] === 'pending').length;
  
  if (going === totalParticipants) return 100; // Everyone confirmed
  if (pending === 0) return 80; // All responses received
  if (going > totalParticipants / 2) return 60; // Majority confirmed
  if (going > 0) return 40; // Some confirmed
  return 20; // No confirmations yet
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

  // 🎯 Ref to track timeout fallback for loading state
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced usability features
  const [smartSortEnabled, setSmartSortEnabled] = useState(true);
  const [participantProfiles, setParticipantProfiles] = useState<{ [uid: string]: any }>({});

  const [expandedSections, setExpandedSections] = useState({
    shares: false,
    invitations: false,
    myAwaitingResponses: false,
    myConfirmedReady: false,
    savedDrafts: false,
    savedTemplates: false,
    // Past plans sections
    todayCompleted: true,     // Auto-expand most recent
    thisWeekCompleted: false,
    thisMonthCompleted: false,
    earlierCompleted: false,
    // Enhanced saved sections - Draft organization
    recentDrafts: true,       // Auto-expand most recent
    readyToPublishDrafts: false,
    inProgressDrafts: false,
    ideaDrafts: false,
    // Enhanced saved sections - Template organization
    recentlySavedTemplates: true,   // Auto-expand recent saves
    favoriteTemplates: false,
    foodDiningTemplates: false,
    adventureTemplates: false,
    cultureTemplates: false,
    nightlifeTemplates: false,
    shoppingTemplates: false,
    otherTemplates: false,
  });

  const toggleSectionExpansion = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Navigation functionality (define early for use in handleDateSelect)
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`${sectionId}-section`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const tab = value as 'upcoming' | 'past' | 'saved';
    if (tab === activeTab) return; // Only act if tab is changing
    const today = new Date();
    const isPast = selectedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isFuture = selectedDate > new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if ((tab === 'past' && isFuture) || (tab === 'upcoming' && isPast)) {
      setSelectedDate(today);
      setIsDateFilterActive(false);
    }
    setActiveTab(tab);
  }, [selectedDate, activeTab]);

  const handleHeaderTabChange = useCallback((tab: 'upcoming' | 'past' | 'saved') => {
    handleTabChange(tab);
  }, [handleTabChange]);

  const handleDateSelect = useCallback((date: Date) => {
    const today = new Date();
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday = isSameDay(date, today);
    const isFuture = date > new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (isPast) {
      setActiveTab('past');
      setSelectedDate(date);
      setIsDateFilterActive(true);
    } else if (isToday) {
      setSelectedDate(today);
      setIsDateFilterActive(false);
      // Don't change tab
    } else if (isFuture) {
      setActiveTab('upcoming');
      setSelectedDate(date);
      setIsDateFilterActive(true);
    }
  }, []);

  // 🎯 CRITICAL FIX: Synchronize isDateFilterActive with selectedDate automatically
  useEffect(() => {
    const isFiltered = !isSameDay(selectedDate, new Date());
    if (isDateFilterActive !== isFiltered) {
      setIsDateFilterActive(isFiltered);
    }
  }, [selectedDate, isDateFilterActive]);

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
    setSelectedDate(new Date()); // This will automatically clear isDateFilterActive via useEffect
    setSearchQuery('');
  }, []);

  // Enhanced search filtering with context-aware matching
  const applySearchFilter = useCallback((plans: PlanType[]) => {
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase().trim();
    return plans.filter(plan => {
      // Enhanced search across multiple fields
      if (plan.name?.toLowerCase().includes(query)) return true;
      if (plan.description?.toLowerCase().includes(query)) return true;
      if (plan.location?.toLowerCase().includes(query)) return true;
      if (plan.city?.toLowerCase().includes(query)) return true;
      if (plan.eventType?.toLowerCase().includes(query)) return true;
      if (plan.hostName?.toLowerCase().includes(query)) return true;
      
      // Search in itinerary items
      if (plan.itinerary?.some(item => 
        item.placeName?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.address?.toLowerCase().includes(query) ||
        item.activitySuggestions?.some(suggestion => suggestion.toLowerCase().includes(query))
      )) return true;
      
      // Search by status-specific terms
      if (activeTab === 'upcoming') {
        if (query.includes('urgent') || query.includes('soon')) {
          const eventDate = plan.eventTime ? parseISO(plan.eventTime) : null;
          if (eventDate && isFuture(eventDate)) {
            const hoursToEvent = differenceInHours(eventDate, new Date());
            return hoursToEvent <= 24;
          }
        }
        if (query.includes('pending') || query.includes('waiting')) {
          const responses = plan.participantResponses || {};
          const hasPending = Object.values(responses).some(response => 
            !response || response === 'pending'
          );
          return hasPending;
        }
      } else if (activeTab === 'saved') {
        if (query.includes('draft') || query.includes('incomplete')) {
          return plan.status === 'draft';
        }
        if (query.includes('template')) {
          return plan.isTemplate === true;
        }
      }
      
      return false;
    });
  }, [searchQuery, activeTab]); // 🎯 CRITICAL FIX: Added activeTab dependency

  // Apply date filtering to plans
  const applyDateFilter = useCallback((plans: PlanType[]) => {
    if (!isDateFilterActive) {
      console.log('🎯 Date filter NOT active, returning all plans:', plans.length);
      return plans;
    }
    
    console.log('🎯 Date filter ACTIVE, filtering', plans.length, 'plans for date:', selectedDate.toDateString());
    
    const filtered = plans.filter(plan => {
      if (!plan.eventTime) {
        console.log('❌ Plan has no eventTime:', plan.name);
        return false;
      }
      try {
        const planDate = parseISO(plan.eventTime);
        const isMatch = isValid(planDate) && isSameDay(planDate, selectedDate);
        console.log(isMatch ? '✅' : '❌', 'Plan:', plan.name, 'Date:', format(planDate, 'MMM d, yyyy'), 'Matches:', isMatch);
        return isMatch;
      } catch (e) {
        console.log('❌ Error parsing plan date:', plan.name, e);
        return false;
      }
    });
    
    console.log('🎯 Date filter result:', filtered.length, 'plans match', selectedDate.toDateString());
    return filtered;
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
      
      // 🎯 Clear any timeout fallback since subscription fired successfully
      const timeoutId = (window as any).plansLoadingTimeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
        (window as any).plansLoadingTimeoutId = null;
        console.log("[PlansPage] Subscription fired successfully, cleared timeout fallback");
      }
    } else {
      console.log(`[PlansPage onPlansUpdateCallback] Incremental update. Plans count: ${plans.length}`);
    }
  }, [setAllUserPlans, setLoadingPlans]);

  const onPendingSharesUpdate = useCallback((shares: PlanShare[]) => {
    console.log(`[PlansPage onPendingSharesUpdate] Received ${shares.length} pending shares.`);
    setPendingShares(shares);
  }, [setPendingShares]);

  // Effect to set up real-time listeners for user plans and shares
  useEffect(() => {
    if (!currentUserId) {
      setAllUserPlans([]);
      setPendingShares([]);
      setLoadingPlans(false);
      return;
    }

    console.log(`[PlansPage] Setting up real-time listeners for user: ${currentUserId}`);
    
    const unsubPlans = getUserPlansSubscription(
      currentUserId,
      (plans: PlanType[]) => {
        console.log(`[PlansPage] getUserPlansSubscription callback invoked with ${plans.length} plans`);
        onPlansUpdateCallback(plans, true);
      },
      (error: Error) => {
        console.error(`[PlansPage] getUserPlansSubscription error:`, error);
      }
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
    console.log("[PlansPage] AuthLoading useEffect. AuthLoading:", authLoading, "UserID:", currentUserId, "Current loadingPlans:", loadingPlans);
    
    let timeoutId: NodeJS.Timeout | null = null;
    
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
      } else {
        console.log("[PlansPage] Auth finished, user exists. NOT setting loadingPlans to false (managed by plan listeners).");
        
        // 🎯 CRITICAL FIX: Add timeout fallback for stuck loading state
        // If subscription doesn't fire within 3 seconds, force loading to false
        timeoutId = setTimeout(() => {
          console.log("[PlansPage] TIMEOUT FALLBACK: Subscription didn't fire, forcing loadingPlans to false");
          setLoadingPlans(false);
          (window as any).plansLoadingTimeoutId = null;
        }, 3000);
        
        // Store timeout ID so subscription callback can clear it
        (window as any).plansLoadingTimeoutId = timeoutId;
      }
    }
    
    // 🎯 CRITICAL FIX: Always return cleanup function to fix React error
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        (window as any).plansLoadingTimeoutId = null;
      }
    };
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
      const planPromises = savedPlanIds.map((planId: string) => getPlanById(planId));
      const plans = await Promise.all(planPromises);
      
      // Filter out null results and ensure we have valid plans
      const validPlans = plans.filter((plan: PlanType | null): plan is PlanType => plan !== null);
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
    const sorted = [...allUserPlans].sort((a, b) => {
      const timeA = a.eventTime && isValid(parseISO(a.eventTime)) 
        ? parseISO(a.eventTime).getTime() 
        : -Infinity;
      const timeB = b.eventTime && isValid(parseISO(b.eventTime)) 
        ? parseISO(b.eventTime).getTime() 
        : -Infinity;
      
      return timeB - timeA; // Newest first
    });
    
    console.log('🔍 All user plans:', sorted.length, sorted.map(p => ({
      name: p.name,
      eventTime: p.eventTime ? format(parseISO(p.eventTime), 'MMM d, yyyy') : 'No date',
      isPast: p.eventTime ? isPast(parseISO(p.eventTime)) : false
    })));
    
    return sorted;
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
  
  // Saved plans categorization (reusing existing logic)
  const savedDrafts = useMemo(() => {
    if (!currentUserId) return [];
    const baseDrafts = sortedPlans.filter(plan => plan.hostId === currentUserId && plan.status === 'draft');
    return baseDrafts; // Don't apply filters here, we'll apply them to individual sections
  }, [sortedPlans, currentUserId]);

  const savedTemplates = useMemo(() => {
    if (!currentUserId) return [];
    // ✅ CRITICAL FIX: Only show actual templates, not all plans from other users
    const baseTemplates = savedPlans.filter(plan => plan.isTemplate === true);
    return baseTemplates; // Don't apply filters here, we'll apply them to individual sections
  }, [savedPlans, currentUserId]);

  // Enhanced draft categorization (reusing existing patterns)
  const recentDrafts = useMemo(() => {
    if (!currentUserId) return [];
    const weekAgo = subDays(new Date(), 7);
    
    return savedDrafts.filter(plan => {
      try {
        const createdDate = plan.createdAt ? parseISO(plan.createdAt) : new Date();
        return isValid(createdDate) && createdDate >= weekAgo;
      } catch (e) { return false; }
    });
  }, [savedDrafts, currentUserId]);

  const readyToPublishDrafts = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedDrafts.filter(plan => {
      // A draft is "ready to publish" if it has complete core information
      return plan.itinerary?.length > 0 && 
             plan.description && 
             plan.name && 
             plan.eventTime &&
             plan.location;
    });
  }, [savedDrafts, currentUserId]);

  const inProgressDrafts = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedDrafts.filter(plan => {
      // A draft is "in progress" if it has some info but isn't ready to publish
      const hasBasicInfo = plan.name && plan.description;
      const hasItinerary = plan.itinerary?.length > 0;
      const isComplete = hasBasicInfo && hasItinerary && plan.eventTime && plan.location;
      
      return hasBasicInfo && !isComplete;
    });
  }, [savedDrafts, currentUserId]);

  const ideaDrafts = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedDrafts.filter(plan => {
      // A draft is an "idea" if it only has minimal information
      const hasBasicInfo = plan.name && plan.description;
      return !hasBasicInfo;
    });
  }, [savedDrafts, currentUserId]);

  // Enhanced template categorization (reusing existing eventType logic)
  const recentlySavedTemplates = useMemo(() => {
    if (!currentUserId) return [];
    const monthAgo = subDays(new Date(), 30);
    
    return savedTemplates.filter(plan => {
      try {
        // Use createdAt since savedAt doesn't exist on Plan type
        const savedDate = plan.createdAt ? parseISO(plan.createdAt) : new Date();
        return isValid(savedDate) && savedDate >= monthAgo;
      } catch (e) { return false; }
    });
  }, [savedTemplates, currentUserId]);

  const favoriteTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => {
      // A template is "favorite" if it has high rating
      return (plan.averageRating && plan.averageRating >= 4.0) || 
             (plan.reviewCount && plan.reviewCount >= 10 && plan.averageRating && plan.averageRating >= 3.5);
    });
  }, [savedTemplates, currentUserId]);

  // Category-based template organization (reusing existing eventType classification)
  const foodDiningTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => 
      plan.eventType && (
        plan.eventType.toLowerCase().includes('food') ||
        plan.eventType.toLowerCase().includes('dining') ||
        plan.eventType.toLowerCase().includes('restaurant') ||
        plan.eventType === 'Food & Dining'
      )
    );
  }, [savedTemplates, currentUserId]);

  const adventureTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => 
      plan.eventType && (
        plan.eventType.toLowerCase().includes('outdoor') ||
        plan.eventType.toLowerCase().includes('adventure') ||
        plan.eventType.toLowerCase().includes('hiking') ||
        plan.eventType.toLowerCase().includes('nature') ||
        plan.eventType === 'Outdoor Activities'
      )
    );
  }, [savedTemplates, currentUserId]);

  const cultureTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => 
      plan.eventType && (
        plan.eventType.toLowerCase().includes('culture') ||
        plan.eventType.toLowerCase().includes('arts') ||
        plan.eventType.toLowerCase().includes('museum') ||
        plan.eventType.toLowerCase().includes('gallery') ||
        plan.eventType === 'Arts & Culture'
      )
    );
  }, [savedTemplates, currentUserId]);

  const nightlifeTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => 
      plan.eventType && (
        plan.eventType.toLowerCase().includes('nightlife') ||
        plan.eventType.toLowerCase().includes('bar') ||
        plan.eventType.toLowerCase().includes('club') ||
        plan.eventType.toLowerCase().includes('night') ||
        plan.eventType === 'Nightlife'
      )
    );
  }, [savedTemplates, currentUserId]);

  const shoppingTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    return savedTemplates.filter(plan => 
      plan.eventType && (
        plan.eventType.toLowerCase().includes('shopping') ||
        plan.eventType.toLowerCase().includes('market') ||
        plan.eventType.toLowerCase().includes('mall') ||
        plan.eventType === 'Shopping'
      )
    );
  }, [savedTemplates, currentUserId]);

  const otherTemplates = useMemo(() => {
    if (!currentUserId) return [];
    
    // Templates that don't fit into the main categories
    const categorizedTemplates = new Set([
      ...foodDiningTemplates.map(p => p.id),
      ...adventureTemplates.map(p => p.id),
      ...cultureTemplates.map(p => p.id),
      ...nightlifeTemplates.map(p => p.id),
      ...shoppingTemplates.map(p => p.id),
    ]);
    
    return savedTemplates.filter(plan => !categorizedTemplates.has(plan.id));
  }, [savedTemplates, foodDiningTemplates, adventureTemplates, cultureTemplates, nightlifeTemplates, shoppingTemplates, currentUserId]);
  
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
        const isPastPlan = isValid(planDate) && isPast(planDate);
        console.log(isPastPlan ? '📚' : '📅', 'Plan:', plan.name, 'Date:', format(planDate, 'MMM d, yyyy'), 'Is Past:', isPastPlan);
        return isPastPlan;
      } catch (e) { return false; }
    });
    
    console.log('📍 Total past plans found:', basePast.length, basePast.map(p => p.name));
    return basePast; // Don't apply filters here, we'll apply them to individual sections
  }, [sortedPlans, currentUserId]);

  // Helper function to get completion date (reuse existing pattern)
  const getCompletionDate = useCallback((plan: PlanType) => {
    // Use completion timestamp if available, fall back to event date for past plans
    if (plan.completedAt) {
      return parseISO(plan.completedAt);
    } else if (plan.eventTime) {
      const eventDate = parseISO(plan.eventTime);
      // For past plans without explicit completion, use the event date as completion date
      return isValid(eventDate) && isPast(eventDate) ? eventDate : new Date();
    } else {
      return new Date();
    }
  }, []);

  // Time-based past plan categorization (reusing existing filtering patterns)
  const todayCompletedPlans = useMemo(() => {
    if (!currentUserId) return [];
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(subDays(today, -1));
    
    const result = pastPlans.filter(plan => {
      try {
        const completionDate = getCompletionDate(plan);
        return isValid(completionDate) && completionDate >= today && completionDate < tomorrow;
      } catch (e) { return false; }
    });
    
    console.log('🎉 Today completed plans:', result.length, result.map(p => p.name));
    return result;
  }, [pastPlans, currentUserId, getCompletionDate]);

  const thisWeekCompletedPlans = useMemo(() => {
    if (!currentUserId) return [];
    const today = startOfDay(new Date());
    const weekStart = startOfDay(subDays(today, 6)); // Last 7 days
    
    const result = pastPlans.filter(plan => {
      try {
        const completionDate = getCompletionDate(plan);
        return isValid(completionDate) && completionDate >= weekStart && completionDate < today;
      } catch (e) { return false; }
    });
    
    console.log('⭐ This week completed plans:', result.length, result.map(p => p.name));
    return result;
  }, [pastPlans, currentUserId, getCompletionDate]);

  const thisMonthCompletedPlans = useMemo(() => {
    if (!currentUserId) return [];
    const today = startOfDay(new Date());
    const monthStart = startOfDay(subDays(today, 29)); // Last 30 days
    const weekStart = startOfDay(subDays(today, 6)); // Exclude this week
    
    const result = pastPlans.filter(plan => {
      try {
        const completionDate = getCompletionDate(plan);
        return isValid(completionDate) && completionDate >= monthStart && completionDate < weekStart;
      } catch (e) { return false; }
    });
    
    console.log('📅 This month completed plans:', result.length, result.map(p => p.name));
    return result;
  }, [pastPlans, currentUserId, getCompletionDate]);

  const earlierCompletedPlans = useMemo(() => {
    if (!currentUserId) return [];
    const monthStart = startOfDay(subDays(new Date(), 29)); // Older than 30 days
    
    const result = pastPlans.filter(plan => {
      try {
        const completionDate = getCompletionDate(plan);
        return isValid(completionDate) && completionDate < monthStart;
      } catch (e) { return false; }
    });
    
    console.log('📚 Earlier completed plans:', result.length, result.map(p => p.name));
    return result;
  }, [pastPlans, currentUserId, getCompletionDate]);

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

  // Enhancement handlers
  const handleAIAssist = useCallback(async (planId: string, suggestion: string) => {
    if (!user || !currentUserId) return;
    
    toast({
      title: "AI Assistant",
      description: `Working on: ${suggestion}`,
    });
    
    // Here you would integrate with your AI service
    // For now, just show the suggestion was received
  }, [user, currentUserId, toast]);

  const handleCollaborate = useCallback(async (planId: string) => {
    if (!user || !currentUserId) return;
    
    // Navigate to plan page for collaboration
    router.push(`/plans/${planId}?tab=collaborate`);
  }, [user, currentUserId, router]);

  const handleCreateSimilar = useCallback(async (planId: string) => {
    if (!user || !currentUserId) return;
    
    try {
      // Get the original plan data
      const originalPlan = allUserPlans.find(p => p.id === planId);
      if (!originalPlan) return;
      
      toast({
        title: "Creating similar plan",
        description: `Duplicating "${originalPlan.name}" as a new draft`,
      });
      
      // Here you would call your duplication service
      // For now, just navigate to create page
      router.push('/plans/create');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create similar plan",
        variant: "destructive"
      });
    }
  }, [user, currentUserId, allUserPlans, router, toast]);

  const handlePlanClick = useCallback((planId: string) => {
    router.push(`/plans/${planId}`);
  }, [router]);

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

  // Apply filters to each time-based past plan section (reusing existing pattern)
  const filteredTodayCompleted = useMemo(() => {
    return applyAllFilters(todayCompletedPlans);
  }, [todayCompletedPlans, applyAllFilters]);

  const filteredThisWeekCompleted = useMemo(() => {
    return applyAllFilters(thisWeekCompletedPlans);
  }, [thisWeekCompletedPlans, applyAllFilters]);

  const filteredThisMonthCompleted = useMemo(() => {
    return applyAllFilters(thisMonthCompletedPlans);
  }, [thisMonthCompletedPlans, applyAllFilters]);

  const filteredEarlierCompleted = useMemo(() => {
    return applyAllFilters(earlierCompletedPlans);
  }, [earlierCompletedPlans, applyAllFilters]);

  // Combined filtered past plans for backward compatibility
  const filteredPastPlans = useMemo(() => {
    const result = [
      ...filteredTodayCompleted,
      ...filteredThisWeekCompleted,
      ...filteredThisMonthCompleted,
      ...filteredEarlierCompleted
    ];
    
    console.log('🔍 Final filtered past plans:', result.length, 'from sections:', {
      today: filteredTodayCompleted.length,
      week: filteredThisWeekCompleted.length, 
      month: filteredThisMonthCompleted.length,
      earlier: filteredEarlierCompleted.length
    });
    
    return result;
  }, [filteredTodayCompleted, filteredThisWeekCompleted, filteredThisMonthCompleted, filteredEarlierCompleted]);

  // Apply filters to enhanced saved sections (reusing existing pattern)
  const filteredRecentDrafts = useMemo(() => {
    return applyAllFilters(recentDrafts);
  }, [recentDrafts, applyAllFilters]);

  const filteredReadyToPublishDrafts = useMemo(() => {
    return applyAllFilters(readyToPublishDrafts);
  }, [readyToPublishDrafts, applyAllFilters]);

  const filteredInProgressDrafts = useMemo(() => {
    return applyAllFilters(inProgressDrafts);
  }, [inProgressDrafts, applyAllFilters]);

  const filteredIdeaDrafts = useMemo(() => {
    return applyAllFilters(ideaDrafts);
  }, [ideaDrafts, applyAllFilters]);

  const filteredRecentlySavedTemplates = useMemo(() => {
    return applyAllFilters(recentlySavedTemplates);
  }, [recentlySavedTemplates, applyAllFilters]);

  const filteredFavoriteTemplates = useMemo(() => {
    return applyAllFilters(favoriteTemplates);
  }, [favoriteTemplates, applyAllFilters]);

  const filteredFoodDiningTemplates = useMemo(() => {
    return applyAllFilters(foodDiningTemplates);
  }, [foodDiningTemplates, applyAllFilters]);

  const filteredAdventureTemplates = useMemo(() => {
    return applyAllFilters(adventureTemplates);
  }, [adventureTemplates, applyAllFilters]);

  const filteredCultureTemplates = useMemo(() => {
    return applyAllFilters(cultureTemplates);
  }, [cultureTemplates, applyAllFilters]);

  const filteredNightlifeTemplates = useMemo(() => {
    return applyAllFilters(nightlifeTemplates);
  }, [nightlifeTemplates, applyAllFilters]);

  const filteredShoppingTemplates = useMemo(() => {
    return applyAllFilters(shoppingTemplates);
  }, [shoppingTemplates, applyAllFilters]);

  const filteredOtherTemplates = useMemo(() => {
    return applyAllFilters(otherTemplates);
  }, [otherTemplates, applyAllFilters]);

  // Enhanced saved plans combination (for new sectioned UI)
  const allFilteredEnhancedSavedPlans = useMemo(() => {
    return [
      ...filteredRecentDrafts,
      ...filteredReadyToPublishDrafts,
      ...filteredInProgressDrafts,
      ...filteredIdeaDrafts,
      ...filteredRecentlySavedTemplates,
      ...filteredFavoriteTemplates,
      ...filteredFoodDiningTemplates,
      ...filteredAdventureTemplates,
      ...filteredCultureTemplates,
      ...filteredNightlifeTemplates,
      ...filteredShoppingTemplates,
      ...filteredOtherTemplates
    ];
  }, [filteredRecentDrafts, filteredReadyToPublishDrafts, filteredInProgressDrafts, filteredIdeaDrafts, filteredRecentlySavedTemplates, filteredFavoriteTemplates, filteredFoodDiningTemplates, filteredAdventureTemplates, filteredCultureTemplates, filteredNightlifeTemplates, filteredShoppingTemplates, filteredOtherTemplates]);

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
  const hasSavedResults = allFilteredEnhancedSavedPlans.length > 0;
  
  console.log('📊 Results status:', {
    hasUpcomingResults,
    hasPastResults,
    hasSavedResults,
    filteredPastPlansCount: filteredPastPlans.length,
    authLoading,
    loadingPlans
  });

  // Section counts for navigation (reusing existing pattern)
  const sectionCounts = useMemo(() => ({
    today: filteredTodayCompleted.length,
    week: filteredThisWeekCompleted.length,
    month: filteredThisMonthCompleted.length,
    earlier: filteredEarlierCompleted.length,
  }), [filteredTodayCompleted, filteredThisWeekCompleted, filteredThisMonthCompleted, filteredEarlierCompleted]);
  
  console.log('📊 Section counts for Past tab:', sectionCounts);
  
  // Debug Past tab conditions
  useEffect(() => {
    if (activeTab === 'past') {
      console.log('🔍 Past tab conditions:', { 
        loadingPlans, 
        pastPlansLength: pastPlans.length, 
        hasPastResults,
        shouldShowLoading: loadingPlans && pastPlans.length === 0,
        shouldShowEmpty: !loadingPlans && !hasPastResults,
        shouldShowContent: !loadingPlans && hasPastResults
      });
    }
  }, [activeTab, loadingPlans, pastPlans.length, hasPastResults]);

  // 🎯 CRITICAL DEBUG: Track filter and tab state changes
  useEffect(() => {
    console.log('🎯 Filter/Tab State Change:', {
      activeTab,
      searchQuery: searchQuery.trim(),
      isDateFilterActive,
      selectedDate: selectedDate.toDateString(),
      hasUpcomingResults,
      hasPastResults,
      hasSavedResults,
      timestamp: new Date().toISOString()
    });
  }, [activeTab, searchQuery, isDateFilterActive, selectedDate, hasUpcomingResults, hasPastResults, hasSavedResults]);

  // 🎯 UX FIX: Auto-clear past date filters when switching to upcoming tab
  useEffect(() => {
    if (activeTab === 'upcoming' && isDateFilterActive && isPast(selectedDate)) {
      console.log('🔄 Auto-clearing past date filter for upcoming tab');
      setSelectedDate(new Date()); // This will auto-clear isDateFilterActive via sync effect
    }
  }, [activeTab, isDateFilterActive, selectedDate]);

  // 🎯 UX FIX: Auto-clear future date filters when switching to past tab
  useEffect(() => {
    console.log('🔍 Auto-clear check for past tab:', {
      activeTab,
      isDateFilterActive,
      selectedDate: selectedDate.toDateString(),
      selectedDateISO: selectedDate.toISOString(),
      selectedDateObj: selectedDate,
      currentDateISO: new Date().toISOString(),
      isFutureDate: isFuture(selectedDate),
      shouldClear: activeTab === 'past' && isDateFilterActive && isFuture(selectedDate)
    });
    
    // 🔍 DETAILED DATE DEBUG
    const now = new Date();
    const selectedTime = selectedDate.getTime();
    const nowTime = now.getTime();
    console.log('🔍 Date comparison details:', {
      selectedTime,
      nowTime,
      difference: selectedTime - nowTime,
      selectedDate: {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth(),
        date: selectedDate.getDate(),
        hours: selectedDate.getHours(),
        minutes: selectedDate.getMinutes()
      },
      now: {
        year: now.getFullYear(),
        month: now.getMonth(),
        date: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes()
      }
    });
    
    if (activeTab === 'past' && isDateFilterActive && isFuture(selectedDate)) {
      console.log('🔄 Auto-clearing future date filter for past tab');
      setSelectedDate(new Date()); // This will auto-clear isDateFilterActive via sync effect
    }
    
    
  }, [activeTab, isDateFilterActive, selectedDate]);

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
      {/* Gradient fade overlay to prevent harsh cutoffs at nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none h-36 md:hidden bg-gradient-to-b from-transparent via-background/90 to-background" />
      <div className="flex flex-col h-screen bg-background text-foreground">
        <PlansPageHeader
          activeTab={activeTab}
          onTabChange={handleHeaderTabChange}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          userName={user?.displayName || user?.email?.split('@')[0] || 'User'}
          plansForDate={allUserPlans}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <div className="flex-1 overflow-auto px-1">

              <TabsContent value="upcoming" className="mt-0 h-full">
                {loadingPlans && !upcomingPlansExist && (
                  <div className="flex flex-col justify-center items-center py-10 min-h-[300px] space-y-4">
                    <div className="relative">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full bg-primary/20"></div>
                    </div>
                    <p className="text-sm text-muted-foreground animate-pulse">✨ Loading your amazing plans...</p>
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
                    activeTab={activeTab}
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
                                  {(isAcceptingShare && shareToAccept?.id === share.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle className="mr-0 h-3.5 w-3.5"/>}
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
                    activeTab={activeTab}
                  />
                )}

                {/* Filter state indicator */}
                {!loadingPlans && (searchQuery || isDateFilterActive) && hasPastResults && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        Showing filtered results
                        {searchQuery && ` for "${searchQuery}"`}
                        {isDateFilterActive && ` for ${format(selectedDate, 'MMM d, yyyy')}`}
                      </span>
                      <Button variant="link" size="sm" onClick={handleClearFilters} className="h-auto p-0 text-primary">
                        Clear filters
                      </Button>
                    </div>
                  </div>
                )}

                {/* Render content based on filter state */}
                {!loadingPlans && hasPastResults && (
                  <>
                    {/* Date-filtered view - show ONLY when specific date is selected */}
                    {isDateFilterActive ? (
                      <PlanStackSection
                        title="📅 Plans"
                        plans={filteredPastPlans}
                        isExpanded={true} // Always expanded for date-filtered results
                        onToggleExpand={() => {}} // No toggle for simplified view
                        emptyMessage={`No plans found for ${format(selectedDate, 'MMM d, yyyy')}.`}
                        currentUserUid={currentUserId}
                      />
                    ) : (
                      /* Time-based sections - show ONLY when date filter is NOT active */
                      <>
                        {/* Quick Navigation Bar - only show when multiple sections have content */}
                        {(sectionCounts.today + sectionCounts.week + sectionCounts.month + sectionCounts.earlier) > 10 && (
                          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm mb-4 -mx-4 px-4 py-2 border-b border-border/50">
                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                              {sectionCounts.today > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => scrollToSection('today')} className="flex-shrink-0">
                                  🎉 Today ({sectionCounts.today})
                                </Button>
                              )}
                              {sectionCounts.week > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => scrollToSection('week')} className="flex-shrink-0">
                                  ⭐ This Week ({sectionCounts.week})
                                </Button>
                              )}
                              {sectionCounts.month > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => scrollToSection('month')} className="flex-shrink-0">
                                  📅 This Month ({sectionCounts.month})
                                </Button>
                              )}
                              {sectionCounts.earlier > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => scrollToSection('earlier')} className="flex-shrink-0">
                                  📚 Earlier ({sectionCounts.earlier})
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Today's Completed - Auto-expanded, horizontal cards when collapsed */}
                        {filteredTodayCompleted.length > 0 && (
                          <div id="today-section">
                            <PlanStackSection
                              title="🎉 Completed Today"
                              plans={filteredTodayCompleted}
                              isExpanded={expandedSections.todayCompleted}
                              onToggleExpand={() => toggleSectionExpansion('todayCompleted')}
                              emptyMessage="No plans completed today."
                              currentUserUid={currentUserId}
                            />
                          </div>
                        )}

                        {/* This Week - Compact view */}
                        {filteredThisWeekCompleted.length > 0 && (
                          <div id="week-section">
                            <PlanStackSection
                              title="⭐ This Week"
                              plans={filteredThisWeekCompleted}
                              isExpanded={expandedSections.thisWeekCompleted}
                              onToggleExpand={() => toggleSectionExpansion('thisWeekCompleted')}
                              emptyMessage="No plans completed this week."
                              currentUserUid={currentUserId}
                            />
                          </div>
                        )}

                        {/* This Month - Compact view */}
                        {filteredThisMonthCompleted.length > 0 && (
                          <div id="month-section">
                            <PlanStackSection
                              title="📅 This Month"
                              plans={filteredThisMonthCompleted}
                              isExpanded={expandedSections.thisMonthCompleted}
                              onToggleExpand={() => toggleSectionExpansion('thisMonthCompleted')}
                              emptyMessage="No plans completed this month."
                              currentUserUid={currentUserId}
                            />
                          </div>
                        )}

                        {/* Earlier - Always compact, show when expanded or when other sections are empty */}
                        {filteredEarlierCompleted.length > 0 && (
                          <div id="earlier-section">
                            <PlanStackSection
                              title="📚 Earlier"
                              plans={filteredEarlierCompleted}
                              isExpanded={expandedSections.earlierCompleted}
                              onToggleExpand={() => toggleSectionExpansion('earlierCompleted')}
                              emptyMessage="No earlier completed plans."
                              currentUserUid={currentUserId}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </>
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
                    activeTab={activeTab}
                  />
                )}
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
      <AlertDialog open={!!planToComplete} onOpenChange={(open) => { if (!open) setPlanToComplete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Plan as Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark <b>{planToComplete?.name}</b> as completed? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPlanToComplete(null)}
              disabled={isMarkingComplete}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!planToComplete || !user) return;
                setIsMarkingComplete(true);
                try {
                  const idToken = await user.getIdToken();
                  const result = await markPlanAsCompletedAction(planToComplete.id, idToken);
                  if (result.success) {
                    toast({ title: "Plan marked as completed", description: `"${planToComplete.name}" is now completed.` });
                  } else {
                    toast({ title: "Error", description: result.error || "Failed to mark as completed", variant: "destructive" });
                  }
                } catch (err) {
                  toast({ title: "Error", description: "Unexpected error", variant: "destructive" });
                } finally {
                  setIsMarkingComplete(false);
                  setPlanToComplete(null);
                }
              }}
              disabled={isMarkingComplete}
            >
              {isMarkingComplete ? "Marking..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlansPageProvider>
  );
}
