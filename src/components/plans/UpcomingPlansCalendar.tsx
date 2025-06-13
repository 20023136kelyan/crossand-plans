'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Plan } from '@/types/user';
import { getUserPlans } from '@/services/planService';
import { useAuth } from '@/context/AuthContext';

interface UpcomingPlansCalendarProps {
  className?: string;
}

export function UpcomingPlansCalendar({ className }: UpcomingPlansCalendarProps) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getUserPlans(user.uid, (userPlans) => {
      // Filter for upcoming plans with event times
      const upcomingPlans = userPlans.filter(plan => {
        if (!plan.eventTime) return false;
        const eventDate = new Date(plan.eventTime);
        return eventDate > new Date() && plan.status === 'published';
      });
      setPlans(upcomingPlans);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getPlansForDay = (day: Date) => {
    return plans.filter(plan => {
      if (!plan.eventTime) return false;
      return isSameDay(new Date(plan.eventTime), day);
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  if (loading) {
    return (
      <Card className={cn("w-full bg-transparent border-none shadow-none", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
            <Calendar className="mr-2 h-4 w-4" />
            Adventure Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-muted-foreground">Loading calendar...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full bg-transparent border-none shadow-none", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
          <Calendar className="mr-2 h-4 w-4" />
          Adventure Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-medium">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-xs">
          {/* Day headers */}
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div key={index} className="h-5 flex items-center justify-center text-muted-foreground font-medium">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            const dayPlans = getPlansForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={index}
                className={cn(
                  "h-6 flex items-center justify-center relative rounded-sm transition-colors",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                  isToday && "bg-primary text-primary-foreground font-medium",
                  dayPlans.length > 0 && !isToday && "bg-accent text-accent-foreground"
                )}
              >
                <span className="text-xs">{format(day, 'd')}</span>
                {dayPlans.length > 0 && (
                  <div className={cn(
                    "absolute bottom-0 right-0 h-1 w-1 rounded-full",
                    isToday ? "bg-primary-foreground" : "bg-primary"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Plans count */}
        <div className="text-xs text-muted-foreground text-center pt-1 border-t">
          {plans.length === 0 ? (
            "No upcoming plans"
          ) : (
            `${plans.length} upcoming plan${plans.length === 1 ? '' : 's'}`
          )}
        </div>
      </CardContent>
    </Card>
  );
}