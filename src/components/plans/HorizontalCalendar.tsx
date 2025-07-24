'use client';

import { useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

interface HorizontalCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  plansForDate?: any[];
}

export function HorizontalCalendar({ 
  selectedDate, 
  onDateSelect, 
  plansForDate = [] 
}: HorizontalCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate 14 days (current week + next week)
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday start
  const days = Array.from({ length: 14 }, (_, i) => addDays(startDate, i));

  // Auto-scroll to selected date on mount
  useEffect(() => {
    if (scrollRef.current) {
      const selectedIndex = days.findIndex(day => isSameDay(day, selectedDate));
      if (selectedIndex !== -1) {
        const dayElement = scrollRef.current.children[selectedIndex] as HTMLElement;
        if (dayElement) {
          dayElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
      }
    }
  }, [selectedDate, days]);

  const getPlansForDay = (date: Date) => {
    const plans = plansForDate.filter(plan => {
      if (!plan.eventTime) return false;
      try {
        const planDate = parseISO(plan.eventTime);
        const isMatch = isValid(planDate) && isSameDay(planDate, date);
        if (isMatch) {
  
        }
        return isMatch;
      } catch {
        return false;
      }
    });
    
    if (plans.length > 0) {
      
    }
    
    return plans;
  };

  const getDayIndicators = (date: Date) => {
    const plans = getPlansForDay(date);
    if (plans.length === 0) return null;

    // Show up to 3 dots for different types of plans
    const indicators = plans.slice(0, 3).map((_, index) => (
      <div
        key={index}
        className={cn(
          "w-1 h-1 rounded-full",
          index === 0 ? "bg-green-500" : index === 1 ? "bg-blue-500" : "bg-purple-500"
        )}
      />
    ));

    return (
      <div className="flex gap-0.5 justify-center mt-1">
        {indicators}
        {plans.length > 3 && (
          <div className="w-1 h-1 rounded-full bg-yellow-500" />
        )}
      </div>
    );
  };

  return (
    <div className="relative -mx-4 px-4">
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card via-card/80 to-transparent z-10 pointer-events-none" />
      
      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card via-card/80 to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);
          const dayOfWeek = format(day, 'EEE');
          const dayNumber = format(day, 'd');
          const plans = getPlansForDay(day);

          return (
            <div
              key={day.toISOString()}
              onClick={(e) => {
                e.stopPropagation(); // Prevent calendar expansion
                onDateSelect(day);
              }}
              className={cn(
                "flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 cursor-pointer transition-all duration-200",
                !isSelected && "rounded-xl hover:bg-accent/50",
                isDayToday && !isSelected && "bg-gray-800/50 text-gray-100"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isSelected ? "text-primary" : isDayToday ? "text-gray-300" : "text-muted-foreground"
              )}>
                {dayOfWeek}
              </div>
              <div className={cn(
                "text-sm font-bold",
                isSelected ? "text-primary" : isDayToday ? "text-gray-100" : "text-foreground"
              )}>
                {dayNumber}
              </div>
              {getDayIndicators(day)}
            </div>
          );
        })}
      </div>
    </div>
  );
} 