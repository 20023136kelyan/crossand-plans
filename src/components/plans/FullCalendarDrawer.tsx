'use client';

import { useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

interface FullCalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  plansForDate?: any[];
}

export function FullCalendarDrawer({
  isOpen,
  onClose,
  selectedDate,
  onDateSelect,
  plansForDate = []
}: FullCalendarDrawerProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getPlansForDay = (date: Date) => {
    return plansForDate.filter(plan => {
      if (!plan.eventTime) return false;
      try {
        return isSameDay(new Date(plan.eventTime), date);
      } catch {
        return false;
      }
    });
  };

  const getDaysWithPlans = () => {
    const daysWithPlans = new Set<string>();
    plansForDate.forEach(plan => {
      if (plan.eventTime) {
        try {
          const date = new Date(plan.eventTime);
          daysWithPlans.add(format(date, 'yyyy-MM-dd'));
        } catch {
          // ignore invalid dates
        }
      }
    });
    return Array.from(daysWithPlans).map(dateStr => new Date(dateStr));
  };

  const plansForSelectedDate = getPlansForDay(selectedDate);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 bg-background border-b border-border shadow-lg z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "-translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/10">
          <h2 className="text-lg font-semibold">Select Date</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar */}
        <div className="p-4">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateSelect(date)}
            className="rounded-md border-0"
            classNames={{
              day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground',
              day_today: 'bg-accent text-accent-foreground font-bold',
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
              hasPlans: 'after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full' 
            }}
          />
        </div>

        {/* Selected Date Plans Preview */}
        {plansForSelectedDate.length > 0 && (
          <div className="px-4 pb-4">
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
    </>
  );
}