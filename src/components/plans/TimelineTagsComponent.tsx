'use client';

import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Plan as PlanType } from '@/types/user';

// Type for grouped plans
interface GroupedPlans {
  key: string;
  date: Date;
  plans: PlanType[];
  displayText: string;
}

// Determine the section type based on its title
export const getSectionTimelineType = (title: string): 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'earlier' => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('today')) return 'today';
  if (titleLower.includes('this week')) return 'thisWeek';
  if (titleLower.includes('this month')) return 'thisMonth';
  if (titleLower.includes('this year')) return 'thisYear';
  return 'earlier';
};

// The timeline tag component
export const TimelineTag: React.FC<{ 
  children: React.ReactNode, 
  className?: string 
}> = ({ children, className }) => {
  return (
    <div className={cn(
      "sticky top-4 float-left -ml-14 w-12 text-xs font-medium text-center bg-yellow-500/20 text-yellow-500 rounded-full py-1 px-2 z-10 truncate whitespace-nowrap overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
};

// Group plans by appropriate time periods based on section type
export const groupPlansByContextualTime = (
  plans: PlanType[], 
  sectionType: 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'earlier'
): GroupedPlans[] => {
  // Different grouping strategies based on section type
  const groupedPlans: Record<string, PlanType[]> = {};
  const groupDisplayText: Record<string, string> = {};
  
  plans.forEach(plan => {
    if (!plan.eventTime) return;
    
    const planDate = parseISO(plan.eventTime);
    if (!isValid(planDate)) return;
    
    let groupKey = '';
    let displayText = '';
    
    switch (sectionType) {
      case 'today':
        // Group by time of day (morning, afternoon, evening, night)
        const hour = planDate.getHours();
        if (hour >= 5 && hour < 12) {
          groupKey = 'morning';
          displayText = 'Morning';
        } else if (hour >= 12 && hour < 17) {
          groupKey = 'afternoon';
          displayText = 'Afternoon';
        } else if (hour >= 17 && hour < 24) {
          groupKey = 'evening';
          displayText = 'Evening';
        } else {
          groupKey = 'night';
          displayText = 'Night';
        }
        break;
      case 'thisWeek':
        // Group by exact day, display as "Mon 16"
        groupKey = format(planDate, 'yyyy-MM-dd');
        displayText = format(planDate, 'EEE d');
        break;
      case 'thisMonth':
        // Group by exact day, display as "16 Jul"
        groupKey = format(planDate, 'yyyy-MM-dd');
        displayText = format(planDate, 'd MMM');
        break;
      case 'thisYear':
        // Group by month, display as "Jul 2025"
        groupKey = format(planDate, 'yyyy-MM');
        displayText = format(planDate, 'MMM yyyy');
        break;
      default:
        // Group by month-year, display as "Jul 2025"
        groupKey = format(planDate, 'yyyy-MM');
        displayText = format(planDate, 'MMM yyyy');
    }
    
    if (!groupedPlans[groupKey]) {
      groupedPlans[groupKey] = [];
      groupDisplayText[groupKey] = displayText;
    }
    
    groupedPlans[groupKey].push(plan);
  });
  
  // Convert to array format with proper dates
  return Object.entries(groupedPlans)
    .map(([key, plans]) => {
      // Get the first plan's date to represent the group
      const firstPlanDate = parseISO(plans[0].eventTime || '');
      return {
        key,
        date: firstPlanDate,
        plans,
        displayText: groupDisplayText[key]
      };
    })
    .sort((a, b) => {
      // For today section, sort by time of day
      if (sectionType === 'today') {
        const timeOrder: Record<string, number> = { 'morning': 0, 'afternoon': 1, 'evening': 2, 'night': 3 };
        return (timeOrder[a.key] ?? 0) - (timeOrder[b.key] ?? 0);
      }
      
      // For other sections, sort by date (recent first for past events)
      return b.date.getTime() - a.date.getTime();
    });
};

// Wrapper to apply compact styling to the HorizontalListPlanCard
export const CompactPlanCard: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <div className="timeline-compact-card transform transition-all duration-300 ease-in-out">
      {children}
    </div>
  );
};

// Component that wraps plans with timeline tags
export const PlansWithTimelineTags: React.FC<{
  plans: PlanType[];
  sectionTitle: string;
  currentUserUid?: string;
  renderPlan: (plan: PlanType) => React.ReactNode;
}> = ({ plans, sectionTitle, currentUserUid, renderPlan }) => {
  const sectionType = getSectionTimelineType(sectionTitle);
  const groupedPlans = groupPlansByContextualTime(plans, sectionType);
  
  return (
    <div className="space-y-4 relative pl-14"> {/* Add left padding for tags */}
      <style jsx global>{`
        /* Add global styles for timeline compact cards */
        .timeline-compact-card > a {
          outline: none !important;
        }
        
        .timeline-compact-card > a > div {
          transform: scale(0.92);
          max-width: calc(100% - 30px);
          width: 95%;
          margin-bottom: -5px;
          transition: transform 0.3s ease-in-out, max-width 0.3s ease-in-out, width 0.3s ease-in-out;
        }
        
        /* Prevent focus scaling */
        .timeline-compact-card > a:focus > div,
        .timeline-compact-card > a:focus-visible > div,
        .timeline-compact-card > a:focus-within > div {
          transform: scale(0.92) !important;
          border-color: rgba(var(--border), 0.2) !important;
          box-shadow: none !important;
        }
        
        /* Adjust internal padding */
        .timeline-compact-card > a > div > div {
          padding-top: 0.4rem;
          padding-bottom: 0.4rem;
        }
        
        /* Fix spacing under dotted line separators */
        .timeline-compact-card > a > div hr,
        .timeline-compact-card > a > div .border-t,
        .timeline-compact-card > a > div .border-b,
        .timeline-compact-card > a > div [class*="border-"] {
          margin-top: 0.15rem !important;
          margin-bottom: 0.15rem !important;
        }
        
        /* Target the specific dotted separator seen in the image */
        .timeline-compact-card > a > div .border-dotted,
        .timeline-compact-card [class*="border-dotted"] ~ div {
          padding-top: 0.1rem !important;
        }
        
        /* Reduce padding in the bottom action bar */
        .timeline-compact-card > a > div > div:last-child {
          padding-top: 0.2rem;
          padding-bottom: 0.2rem;
        }
        
        /* Specifically target the location row */
        .timeline-compact-card svg[stroke="currentColor"][fill="none"][stroke-width="2"][viewBox="0 0 24 24"] + span,
        .timeline-compact-card .flex.items-center:has(svg) {
          margin-top: 0 !important;
          padding-top: 0.1rem !important;
        }
        
        /* Make image smaller */
        .timeline-compact-card > a > div .relative.w-24 {
          width: 4.5rem;
          height: 3.75rem;
        }
        
        /* Make title and content more compact */
        .timeline-compact-card > a > div h3 {
          font-size: 0.95rem;
          line-height: 1.25;
          margin-bottom: 0.25rem;
        }
        
        .timeline-compact-card > a > div .text-sm {
          font-size: 0.8rem;
        }
        
        /* Reduce icon sizes */
        .timeline-compact-card > a > div svg {
          height: 0.875rem;
          width: 0.875rem;
        }
      `}</style>
      
      {groupedPlans.map((group, groupIndex) => (
        <div key={groupIndex} className="relative">
          <TimelineTag>{group.displayText}</TimelineTag>
          <div className="space-y-1"> {/* Further reduced spacing between cards */}
            {group.plans.map((plan, planIndex) => (
              <div 
                key={plan.id} 
                className="transform transition-all duration-300 ease-out"
                style={{
                  transitionDelay: `${planIndex * 50}ms`,
                }}
              >
                <CompactPlanCard>
                  {renderPlan(plan)}
                </CompactPlanCard>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlansWithTimelineTags;
