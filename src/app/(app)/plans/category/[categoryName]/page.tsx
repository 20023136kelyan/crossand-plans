'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ChevronLeftIcon,
  ArchiveBoxXMarkIcon,
  CalendarDaysIcon,
  ListBulletIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ExploreCard } from '@/components/explore/ExploreCard';
import type { Plan as PlanType } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isValid } from 'date-fns';
import { getPublishedPlansByCategoryAction } from '@/app/actions/planActions';
import { useToast } from '@/hooks/use-toast';
import { PlansPageProvider } from '@/context/PlansPageContext';

export default async function PlansCategoryPage({ params }: { params: Promise<{ categoryName: string }> }) {
  const { categoryName } = await params;
  const router = useRouter();
  const { toast } = useToast();
  const rawCategoryName = categoryName as string;
  const decodedCategoryName = decodeURIComponent(rawCategoryName);
  const { user: currentUser } = useAuth();
  const [plans, setPlans] = useState<PlanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  // Add delete handler
  const handleDeleteRequest = useCallback((planId: string, planName: string) => {
    // For the category view, we'll just show a toast since deletion is not allowed here
    toast({
      title: "Action Not Allowed",
      description: "Plans can only be deleted from your personal plans page.",
      variant: "default"
    });
  }, [toast]);

  // Add missing handlers for PlansPageProvider
  const handleMarkAsCompleted = useCallback((planId: string, planName: string) => {
    toast({
      title: "Action Not Allowed",
      description: "This action is not available in category view.",
      variant: "default"
    });
  }, [toast]);

  const handleConfirmCompletion = useCallback(async (planId: string) => {
    toast({
      title: "Action Not Allowed",
      description: "This action is not available in category view.",
      variant: "default"
    });
  }, [toast]);

  const isConfirmingCompletion = false;

  // Filter and sort plans
  const filteredAndSortedPlans = useMemo(() => {
    let filtered = plans;
    if (searchTerm) {
      filtered = plans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        plan.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => {
      if (sortConfig.key === 'name') {
        const comparison = a.name.localeCompare(b.name);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      const dateAValid = a.eventTime && isValid(parseISO(a.eventTime));
      const dateBValid = b.eventTime && isValid(parseISO(b.eventTime));
      const timeA = dateAValid ? parseISO(a.eventTime!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      const timeB = dateBValid ? parseISO(b.eventTime!).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
      return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [plans, searchTerm, sortConfig]);

  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching plans for category:', categoryName);
        const result = await getPublishedPlansByCategoryAction(categoryName);
        console.log('Fetch result:', result);
        
        if (result.success && result.plans) {
          setPlans(result.plans);
        } else {
          setError(result.error || 'Failed to fetch plans');
          toast({
            title: 'Error',
            description: result.error || 'Failed to fetch plans',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError('An unexpected error occurred');
        toast({
          title: 'Error',
          description: 'An unexpected error occurred while fetching plans',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (categoryName) {
      fetchPlans();
    }
  }, [categoryName, toast]);

  // Extract event dates from plans (exclude template plans)
  const eventDates = useMemo(() => {
    return plans
      .filter(plan => !plan.isTemplate) // Exclude template plans from calendar
      .map(plan => plan.eventTime ? parseISO(plan.eventTime) : null)
      .filter((date): date is Date => date !== null && isValid(date));
  }, [plans]);

  // Calendar day render function
  const renderCalendarDay = useCallback((props: { date: Date; displayMonth: Date }) => {
    const { date: day, displayMonth } = props;
    const isCurrentDisplayMonth = day.getMonth() === displayMonth.getMonth();
    const hasEvent = eventDates.some(eventDate => isSameDay(eventDate, day));
    
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        {format(day, 'd')}
        {hasEvent && isCurrentDisplayMonth && selectedDate && isSameDay(day, selectedDate) && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
        {hasEvent && isCurrentDisplayMonth && selectedDate && !isSameDay(day, selectedDate) && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
        {hasEvent && isCurrentDisplayMonth && !selectedDate && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </div>
    );
  }, [eventDates, selectedDate]);

  // Filter plans for calendar view (exclude template plans)
  const plansForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return plans.filter(plan => {
      if (plan.isTemplate || !plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isSameDay(planDate, selectedDate);
    });
  }, [plans, selectedDate]);

  let calendarFooter = null;
  if (plansForSelectedDate.length > 0) {
    calendarFooter = (
      <div className="p-3 space-y-2">
        <h4 className="font-medium">Plans for {format(selectedDate!, 'MMMM d, yyyy')}</h4>
        <div className="space-y-2">
          {plansForSelectedDate.map(plan => (
            <ExploreCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    );
  } else if (selectedDate) {
    calendarFooter = (
      <p className="text-sm text-muted-foreground p-3 text-center">
        No plans for {format(selectedDate, 'MMMM d, yyyy')}
      </p>
    );
  } else {
    calendarFooter = (
      <p className="text-sm text-muted-foreground p-3 text-center">
        Please pick a day to see plans.
      </p>
    );
  }

  const EmptyState = ({ title, message }: { title: string; message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
      <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-gray-500 mb-4">No plans found for category: {categoryName}</div>
        <Button onClick={() => router.back()}>Go Back</Button>
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
      <div className="container max-w-7xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plans in {decodedCategoryName}
          </h1>
        </div>

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'calendar')} className="w-full">
          <div className="sticky top-0 z-20 bg-background flex items-center justify-between gap-3 w-full py-2 border-b border-border shadow-sm mb-6 group">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search plans..."
                  className="pl-10 bg-card border-border text-sm h-9 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {viewMode === 'list' && (
                <Button 
                  variant="outline" 
                  onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))} 
                  size="sm" 
                  className="bg-card border-border hover:bg-secondary/50 text-sm rounded-lg h-9 whitespace-nowrap"
                >
                  {sortConfig.key === 'date' ? 'Date' : 'Name'}
                  <ArrowsUpDownIcon className="ml-1.5 h-4 w-4" />
                </Button>
              )}

              <div className="whitespace-nowrap">
                <TabsList className="bg-muted p-1 rounded-lg inline-flex h-9">
                  <TabsTrigger value="list" className="px-2.5 py-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded data-[state=active]:shadow-sm">
                    <ListBulletIcon className="h-4 w-4 mr-1.5" />
                    List
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="px-2.5 py-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded data-[state=active]:shadow-sm">
                    <CalendarDaysIcon className="h-4 w-4 mr-1.5" />
                    Calendar
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <TabsContent value="list" className="mt-0">
              {filteredAndSortedPlans.length === 0 ? (
                <EmptyState 
                  title={`No Plans in ${decodedCategoryName}`} 
                  message={searchTerm ? `Your search for "${searchTerm}" did not match any plans in this category.` : `There are no plans listed under "${decodedCategoryName}".`}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAndSortedPlans.map(plan => (
                    <ExploreCard key={plan.id} plan={plan} />
                  ))}
                </div>
              )}
            </TabsContent>
          ) : (
            <TabsContent value="calendar" className="space-y-4">
              <div className="flex flex-col space-y-4">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date || undefined)}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-md border shadow"
                  classNames={{
                    day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground',
                    day_today: 'bg-accent text-accent-foreground',
                  }}
                  components={{
                    DayContent: renderCalendarDay
                  }}
                  modifiers={{ hasEvent: eventDates }}
                />
                {calendarFooter}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PlansPageProvider>
  );
}
