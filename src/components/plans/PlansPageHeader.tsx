'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HorizontalCalendar } from './HorizontalCalendar';
import { PlansNavigationTabs } from './PlansNavigationTabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, isSameDay, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

interface PlansPageHeaderProps {
  activeTab: 'upcoming' | 'past' | 'saved';
  onTabChange: (tab: 'upcoming' | 'past' | 'saved') => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  userName?: string;
  plansForDate?: any[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function PlansPageHeader({
  activeTab,
  onTabChange,
  selectedDate,
  onDateSelect,
  userName = "User",
  plansForDate = [],
  searchQuery = '',
  onSearchChange
}: PlansPageHeaderProps) {
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const selectedDayName = format(selectedDate, 'EEEE');
  const selectedDayDate = format(selectedDate, 'd MMMM');

  const handleSearchToggle = () => {
    const newSearchVisible = !isSearchVisible;
    setIsSearchVisible(newSearchVisible);
    
    // Clear search when closing
    if (!newSearchVisible && onSearchChange) {
      onSearchChange('');
    }
  };

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Handle keyboard events for search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsSearchVisible(false);
      if (onSearchChange) {
        onSearchChange('');
      }
    }
  };

  // Calendar helper functions
  const getPlansForDay = (date: Date) => {
    if (!Array.isArray(plansForDate) || !date) return [];
    
    return plansForDate.filter(plan => {
      if (!plan || typeof plan !== 'object' || !plan.eventTime) return false;
      
      try {
        const planDate = parseISO(plan.eventTime);
        return isValid(planDate) && isSameDay(planDate, date);
      } catch {
        return false;
      }
    });
  };

  const getDaysWithPlans = () => {
    // Skip if no plans data
    if (!Array.isArray(plansForDate) || plansForDate.length === 0) {
      return [];
    }
    
    const daysWithPlans = new Set<string>();
    
    // Safely process each plan
    plansForDate.forEach((plan) => {
      if (!plan || typeof plan !== 'object') return;
      
      const eventTime = plan.eventTime;
      if (!eventTime || typeof eventTime !== 'string') return;
      
      try {
        const date = parseISO(eventTime);
        if (isValid(date)) {
          const dateStr = format(date, 'yyyy-MM-dd');
          daysWithPlans.add(dateStr);
        }
      } catch {
        // Silently handle invalid dates
      }
    });
    
    // Convert date strings to Date objects
    return Array.from(daysWithPlans).map(dateStr => {
      try {
        return parseISO(`${dateStr}T12:00:00`);
      } catch {
        return new Date(); // Fallback to today if parsing fails
      }
    });
  };

  // Safely get plans for the selected date
  const plansForSelectedDate = useMemo(() => {
    return getPlansForDay(selectedDate) || [];
  }, [selectedDate, plansForDate]);

  return (
    <>
      {/* Main Header */}
      <header className="shrink-0 bg-background border-b border-border/10">
        {/* Header Container */}
        <div className="w-full mt-4 mb-2 p-4 bg-card rounded-3xl border border-border/30 shadow-sm backdrop-blur-sm">
          {/* Top Section: Selected Date + Search Icon */}
          <div className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{selectedDayName}</div>
                <div className="text-2xl font-bold text-foreground">{selectedDayDate}</div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleSearchToggle}
                className="h-8 w-8"
              >
                {isSearchVisible ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Collapsible Search Bar */}
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isSearchVisible ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          )}>
            {isSearchVisible && (
              <div className="pb-3">
                <Input 
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full"
                  autoFocus
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            )}
          </div>

          {/* Horizontal Calendar */}
          <div className="pb-3">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
            >
              <div className="flex-1 min-w-0">
                <HorizontalCalendar 
                  selectedDate={selectedDate}
                  onDateSelect={onDateSelect}
                  plansForDate={plansForDate}
                />
              </div>
              <div className="flex-shrink-0 p-1">
                {isCalendarExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          {/* Expandable Calendar */}
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isCalendarExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}>
            {isCalendarExpanded && (
              <div className="pt-3 pb-3 border-t border-border/20">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      // Prevent selection of invalid dates
                      try {
                        // Ensure it's a valid date
                        const validDate = new Date(date);
                        if (!isNaN(validDate.getTime())) {
                          onDateSelect(validDate);
                          setIsCalendarExpanded(false);
                        }
                      } catch {
                        // Do nothing on invalid date
                      }
                    }
                  }}
                  className="rounded-md border-0"
                  classNames={{
                    day_selected: 'bg-primary/40 text-primary-foreground hover:bg-primary/50 focus:bg-primary/50 focus:text-primary-foreground border-2 border-primary',
                    day_today: 'bg-transparent text-accent-foreground font-bold ring-2 ring-accent ring-offset-1 ring-offset-background',
                    months: 'flex flex-col space-y-4 justify-center',
                    month: 'space-y-4 w-full',
                    caption_label: 'text-lg font-medium text-foreground/90',
                    head_cell: 'text-muted-foreground rounded-md w-full font-normal text-sm',
                    cell: 'h-12 w-full text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                    day: 'h-12 w-12 p-0 font-normal aria-selected:opacity-100 rounded-md relative',
                  }}
                  modifiers={{ 
                    hasPlans: getDaysWithPlans()
                  }}
                  modifiersClassNames={{ 
                    hasPlans: 'after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-amber-500 after:rounded-full' 
                  }}
                />
                
                {/* Selected Date Plans Preview */}
                {plansForSelectedDate.length > 0 && (
                  <div className="mt-3">
                    <div className="bg-accent/50 rounded-lg p-3">
                      <h3 className="font-medium text-sm mb-2">
                        Plans for {format(selectedDate, 'EEEE, MMMM d')}
                      </h3>
                      <div className="space-y-1">
                        {plansForSelectedDate.slice(0, 3).map((plan, index) => (
                          <div key={index} className="text-xs text-muted-foreground">
                            • {plan.name}
                          </div>
                        ))}
                        {plansForSelectedDate.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{plansForSelectedDate.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="pb-1">
            <PlansNavigationTabs activeTab={activeTab} onTabChange={onTabChange} />
          </div>
        </div>
      </header>


    </>
  );
} 