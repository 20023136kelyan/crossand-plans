'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';

interface PlanSectionCardProps {
  title: string;
  plans: any[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showExpandToggle?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PlanSectionCard({
  title,
  plans,
  isExpanded = true,
  onToggleExpand,
  showExpandToggle = true,
  className,
  children
}: PlanSectionCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(isExpanded);
  
  const expanded = onToggleExpand ? isExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand || (() => setInternalExpanded(!internalExpanded));

  return (
    <div className={cn("mb-6", className)}>
      {/* Section Header */}
      <div 
        className={cn(
          "flex items-center justify-between mb-3",
          showExpandToggle && "cursor-pointer"
        )}
        onClick={showExpandToggle ? toggleExpanded : undefined}
      >
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {showExpandToggle && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{plans.length}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Section Content */}
      {expanded && (
        <div className="space-y-3">
          {children || (
            plans.map((plan, index) => (
              <PlanItemCard key={plan.id || index} plan={plan} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface PlanItemCardProps {
  plan: any;
  className?: string;
}

export function PlanItemCard({ plan, className }: PlanItemCardProps) {
  const getTimeDisplay = () => {
    if (!plan.eventTime) return 'No time';
    try {
      const date = parseISO(plan.eventTime);
      if (isValid(date)) {
        return format(date, 'h:mm a');
      }
    } catch {
      return 'Invalid time';
    }
    return 'No time';
  };

  const getStatusColor = () => {
    if (plan.status === 'completed') return 'bg-green-500';
    if (plan.status === 'published') return 'bg-blue-500';
    if (plan.status === 'draft') return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-card rounded-lg border border-border/50 hover:border-border transition-colors",
      className
    )}>
      {/* Status Indicator */}
      <div className="flex-shrink-0">
        <div className={cn("w-3 h-3 rounded-full", getStatusColor())} />
      </div>

      {/* Plan Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground truncate">{plan.name}</h3>
        {plan.location && (
          <p className="text-sm text-muted-foreground truncate">{plan.location}</p>
        )}
      </div>

      {/* Time */}
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-medium text-foreground">{getTimeDisplay()}</div>
        {plan.participantCount && (
          <div className="text-xs text-muted-foreground">
            {plan.participantCount} {plan.participantCount === 1 ? 'person' : 'people'}
          </div>
        )}
      </div>
    </div>
  );
} 