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
  ListBulletIcon,
  CalendarDaysIcon,
  ArchiveBoxXMarkIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
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
      // ✅ FIXED: Templates don't belong in scheduled plan views
      // Templates are timeless patterns, not scheduled events
      if (plan.isTemplate) return false;
      
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
      // ✅ Exclude templates from calendar - they don't have meaningful event dates
      if (!plan.isTemplate && plan.eventTime && isValid(parseISO(plan.eventTime))) {
        dates.push(parseISO(plan.eventTime));
      }
    });
    return dates;
  }, [plansForCalendar]);

  const plansForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return plansForCalendar.filter(plan => {
      // ✅ Exclude templates from calendar view
      if (plan.isTemplate || !plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isSameDay(planDate, selectedDate);
    });
  }, [selectedDate, plansForCalendar]);

  const EmptyState = ({ title, message }: { title: string; message: string }) => (
    <div className="text-center py-12 sm:py-16 flex flex-col items-center">
      <ArchiveBoxXMarkIcon className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground/30 mb-6" />
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm text-sm sm:text-base">{message}</p>
      <Button asChild variant="outline" onClick={() => router.push('/explore')}>
        <Link href="/explore">
            <ChevronLeftIcon className="h-4 w-4 mr-1" /> Back to Explore
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
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            <p className="mt-2 text-muted-foreground">Loading plans for {decodedCityName || 'city'}...</p>
        </div>
    );
  }
  
  if (!decodedCityName) {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
            <p className="text-muted-foreground">City not specified.</p>
             <Button asChild variant="outline" className="mt-4">
                <Link href="/explore"><ChevronLeftIcon className="h-4 w-4 mr-1" /> Back to Explore</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/explore')} className="mb-4 print:hidden">
        <ChevronLeftIcon className="h-4 w-4 mr-1" /> Back to Explore
      </Button>

      <h1 className="text-3xl sm:text-4xl font-bold opacity-60">
        <span className="text-foreground">Plans in: </span>
        <span className="text-primary">{decodedCityName}</span>
      </h1>

      {/* ✅ FIXED: Simple template browser for city-specific templates */}
      <div className="w-full">
        <div className="sticky top-0 z-20 bg-background flex items-center justify-between gap-3 w-full py-2 border-b border-border shadow-sm mb-6">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search templates in ${decodedCityName}...`}
              className="pl-10 bg-card border-border text-sm h-9 rounded-lg focus:ring-primary focus:border-primary w-full"
            />
          </div>
          
          <Button variant="outline" onClick={handleSortCycle} size="sm" className="bg-card border-border hover:bg-secondary/50 text-sm rounded-lg h-9 whitespace-nowrap">
            {sortConfig.key === 'date' ? 'Created' : 'Name'}
            <ArrowUpDown className="ml-1.5 h-4 w-4" />
            {sortConfig.direction === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
        
        {/* Template grid */}
        {sortedPlans.length === 0 ? (
          <EmptyState 
            title={`No Templates in ${decodedCityName}`} 
            message={searchTerm ? `Your search for "${searchTerm}" did not match any templates in ${decodedCityName}.` : `There are no templates available for "${decodedCityName}" yet.`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedPlans.map((plan: PlanType) => (
              <ExploreCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
