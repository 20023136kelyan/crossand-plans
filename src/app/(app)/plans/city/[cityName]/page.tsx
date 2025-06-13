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
  Search,
  ArrowUpDown,
  ChevronLeft,
  List,
  CalendarDays,
  PackageOpen,
  Loader2,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ExploreCard } from '@/components/explore/ExploreCard';
import type { Plan as PlanType } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid } from 'date-fns';
import { getPublishedPlansByCityAction } from '@/app/actions/planActions';
import { useToast } from '@/hooks/use-toast';

interface DayWithDotProps { 
  date: Date; 
  displayMonth: Date;
  selectedDate?: Date | null;
  eventDates: Date[];
}

const DayWithDot = ({ date, displayMonth, selectedDate, eventDates }: DayWithDotProps) => {
  const isCurrentDisplayMonth = isValid(date) && isValid(displayMonth) && date.getMonth() === displayMonth.getMonth();
  const hasEvent = isValid(date) && eventDates.some((eventDateItem: Date) => isValid(eventDateItem) && isSameDay(eventDateItem, date));
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

export default function CityPlansPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const cityName = params.cityName as string;
  const { user: currentUser } = useAuth();
  const [plans, setPlans] = useState<PlanType[]>([]);
  const [loading, setLoading] = useState(true);

  const [decodedCityName, setDecodedCityName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    // Properly decode the city name from URL parameter
    const decoded = decodeURIComponent(cityName);
    setDecodedCityName(decoded);
    
    const fetchPlans = async () => {
      setLoading(true);
      try {
        const result = await getPublishedPlansByCityAction(cityName);
        if (result.success && result.plans) {
          setPlans(result.plans);
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to load plans",
            variant: "destructive"
          });
        }
      } catch (err: any) {
        console.error('Error fetching city plans:', err);
        toast({
          title: "Error",
          description: "Failed to load plans",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [cityName, toast]);

  const handleSortCycle = () => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === 'date' && prevConfig.direction === 'desc') return { key: 'date', direction: 'asc' };
      if (prevConfig.key === 'date' && prevConfig.direction === 'asc') return { key: 'name', direction: 'asc' };
      if (prevConfig.key === 'name' && prevConfig.direction === 'asc') return { key: 'name', direction: 'desc' };
      return { key: 'date', direction: 'desc' };
    });
  };

  const baseFilteredPlans = useMemo(() => {
    let filteredPlans = [...plans];
    if (searchTerm && viewMode === 'list') {
      filteredPlans = filteredPlans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        plan.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filteredPlans;
  }, [plans, searchTerm, viewMode]);

  const sortedPlans = useMemo(() => {
    let plans = [...baseFilteredPlans];
    if (viewMode === 'list') {
      plans.sort((a, b) => {
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
    }
    return plans;
  }, [baseFilteredPlans, sortConfig, viewMode]);

  const upcomingPlans = useMemo(() => {
    return sortedPlans.filter(plan => {
      // Template plans (admin-created) should always appear in upcoming
      if (plan.isTemplate) return true;
      
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isFuture(planDate);
    });
  }, [sortedPlans]);

  const pastPlans = useMemo(() => {
    return sortedPlans.filter(plan => {
      // Template plans should not appear in past plans
      if (plan.isTemplate) return false;
      
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isPast(planDate);
    });
  }, [sortedPlans]);

  const plansForCalendar = useMemo(() => {
    return activeTab === 'upcoming' ? upcomingPlans : pastPlans;
  }, [activeTab, upcomingPlans, pastPlans]);

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
    if (!selectedDate) return [];
    return plansForCalendar.filter(plan => {
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isSameDay(planDate, selectedDate);
    });
  }, [selectedDate, plansForCalendar]);

  const EmptyState = ({ title, message }: { title: string; message: string }) => (
    <div className="text-center py-12 sm:py-16 flex flex-col items-center">
      <PackageOpen className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground/30 mb-6" />
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm text-sm sm:text-base">{message}</p>
      <Button asChild variant="outline" onClick={() => router.push('/explore')}>
        <Link href="/explore">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Explore
        </Link>
      </Button>
    </div>
  );

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

  if (loading) {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading plans for {decodedCityName || 'city'}...</p>
        </div>
    );
  }
  
  if (!decodedCityName) {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
            <p className="text-muted-foreground">City not specified.</p>
             <Button asChild variant="outline" className="mt-4">
                <Link href="/explore"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Explore</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/explore')} className="mb-4 print:hidden">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Explore
      </Button>

      <h1 className="text-3xl sm:text-4xl font-bold opacity-60">
        <span className="text-foreground">Plans in: </span>
        <span className="text-primary">{decodedCityName}</span>
      </h1>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upcoming' | 'past')} className="w-full">
        <div className="sticky top-0 z-20 bg-background flex items-center justify-between gap-3 w-full py-2 border-b border-border shadow-sm mb-6 group">
           <Button 
            variant="outline" 
            size="icon" 
            aria-label={viewMode === 'list' ? "Switch to Calendar View" : "Switch to List View"}
            onClick={() => setViewMode(prev => prev === 'list' ? 'calendar' : 'list')}
            className="bg-card border-border hover:bg-secondary/50 rounded-lg h-9 w-9 flex-shrink-0" 
          >
            {viewMode === 'list' ? <CalendarDays className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
          
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border text-sm h-9 rounded-lg focus:ring-primary focus:border-primary w-full"
              disabled={viewMode === 'calendar'}
            />
          </div>
          
          <div className={cn(
            "flex items-center gap-2 flex-shrink-0 origin-right transition-all duration-300 ease-in-out",
             viewMode === 'calendar' ? "w-0 opacity-0 scale-x-0 invisible overflow-hidden" : "w-auto opacity-100 scale-x-100 visible",
             "group-focus-within:w-0 group-focus-within:opacity-0 group-focus-within:scale-x-0 group-focus-within:invisible group-focus-within:overflow-hidden"
            )}
          >
             {viewMode === 'list' && (
                <Button variant="outline" onClick={handleSortCycle} size="sm" className="bg-card border-border hover:bg-secondary/50 text-sm rounded-lg h-9 whitespace-nowrap">
                {sortConfig.key === 'date' ? 'Date' : 'Name'}
                <ArrowUpDown className="ml-1.5 h-4 w-4" />
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </Button>
            )}
            <div className="whitespace-nowrap">
              <TabsList className="bg-muted p-1 rounded-lg inline-flex h-9">
                <TabsTrigger value="upcoming" className="px-2.5 py-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded data-[state=active]:shadow-sm">Upcoming ({upcomingPlans.length})</TabsTrigger>
                <TabsTrigger value="past" className="px-2.5 py-1 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded data-[state=active]:shadow-sm">Past ({pastPlans.length})</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>
        
        {viewMode === 'list' ? (
            <>
                <TabsContent value="upcoming" className="mt-0">
                {upcomingPlans.length === 0 ? (
                    <EmptyState 
                        title={`No Upcoming Plans in ${decodedCityName}`} 
                        message={searchTerm ? `Your search for "${searchTerm}" did not match any upcoming plans in ${decodedCityName}.` : `There are no upcoming plans listed under "${decodedCityName}".`}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {upcomingPlans.map(plan => (
                        <ExploreCard key={plan.id} plan={plan} />
                    ))}
                    </div>
                )}
                </TabsContent>

                <TabsContent value="past" className="mt-0">
                {pastPlans.length === 0 ? (
                    <EmptyState 
                        title={`No Past Plans in ${decodedCityName}`} 
                        message={searchTerm ? `Your search for "${searchTerm}" did not match any past plans in ${decodedCityName}.` : `There are no past plans listed under "${decodedCityName}".`}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pastPlans.map(plan => (
                        <ExploreCard key={plan.id} plan={plan} />
                    ))}
                    </div>
                )}
                </TabsContent>
            </>
        ) : ( // Calendar View
             <TabsContent value={activeTab} className="mt-0">
                {plansForCalendar.length === 0 && !loading ? (
                    <EmptyState
                        title={activeTab === 'upcoming' ? `No Upcoming Plans in ${decodedCityName}` : `No Past Plans in ${decodedCityName}`}
                        message={`There are no ${activeTab} plans in ${decodedCityName} to display on the calendar.`}
                    />
                ) : (
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
                )}
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
