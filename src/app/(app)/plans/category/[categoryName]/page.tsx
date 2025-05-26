
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
  PackageOpen,
  CalendarDays, 
  List,
  Loader2
} from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PlanCard, UserPlanViewStatus } from '../../../plans/page'; 
import type { Plan as PlanType } from '@/types/user';
import { getPublishedPlansByCategoryAdmin } from '@/services/planService.server';
import { useAuth } from '@/context/AuthContext';
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, parseISO, isFuture, isPast, isValid } from 'date-fns';


export default function CategoryPlansPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [decodedCategoryName, setDecodedCategoryName] = useState<string | null>(null);
  const [categoryPlans, setCategoryPlans] = useState<PlanType[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));


  useEffect(() => {
    if (params.categoryName) {
      try {
        const name = decodeURIComponent(params.categoryName as string);
        setDecodedCategoryName(name);
        setLoading(true);
        getPublishedPlansByCategoryAdmin(name) 
          .then(plans => {
            setCategoryPlans(plans);
          })
          .catch(err => {
            console.error("Error fetching plans for category:", name, err);
            setCategoryPlans([]);
          })
          .finally(() => setLoading(false));
      } catch (e) {
        console.error("Error decoding category name:", e);
        setDecodedCategoryName(params.categoryName as string);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [params.categoryName]);


 const handleSortCycle = () => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === 'date' && prevConfig.direction === 'desc') return { key: 'date', direction: 'asc' };
      if (prevConfig.key === 'date' && prevConfig.direction === 'asc') return { key: 'name', direction: 'asc' };
      if (prevConfig.key === 'name' && prevConfig.direction === 'asc') return { key: 'name', direction: 'desc' };
      return { key: 'date', direction: 'desc' };
    });
  };

  const baseFilteredPlans = useMemo(() => {
    let plans = [...categoryPlans];
    if (searchTerm && viewMode === 'list') {
      plans = plans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        plan.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return plans;
  }, [categoryPlans, searchTerm, viewMode]);

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
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isFuture(planDate);
    });
  }, [sortedPlans]);

  const pastPlans = useMemo(() => {
    return sortedPlans.filter(plan => {
      if (!plan.eventTime) return false;
      const planDate = parseISO(plan.eventTime);
      return isValid(planDate) && isPast(planDate);
    });
  }, [sortedPlans]);

  const plansForCalendar = useMemo(() => {
    return activeTab === 'upcoming' ? upcomingPlans : pastPlans;
  }, [activeTab, upcomingPlans, pastPlans]);

  const eventDates = useMemo(() => {
    return plansForCalendar.filter(plan => plan.eventTime && isValid(parseISO(plan.eventTime))).map(plan => parseISO(plan.eventTime!));
  }, [plansForCalendar]);

  const plansForSelectedDate = useMemo(() => {
    if (!selectedDate || !isValid(selectedDate)) return [];
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
  
  interface DayWithDotProps { date: Date; displayMonth: Date; }
  const DayWithDot: React.FC<DayWithDotProps> = ({ date, displayMonth }) => {
    const isCurrentDisplayMonth = isValid(date) && isValid(displayMonth) && date.getMonth() === displayMonth.getMonth();
    const hasEvent = isValid(date) && eventDates.some(eventDateItem => isValid(eventDateItem) && isSameDay(eventDateItem, date));
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
  
  let calendarFooter = <p className="text-sm text-muted-foreground p-3 text-center">Please pick a day to see plans.</p>;
  if (selectedDate && isValid(selectedDate)) {
    if (plansForSelectedDate.length > 0) {
      calendarFooter = (
        <div className="p-3 pt-2 max-h-48 overflow-y-auto custom-scrollbar-horizontal">
          <h4 className="font-medium text-sm mb-1.5 text-foreground/80">
            Plans for {format(selectedDate, 'PPP')}
          </h4>
          <ul className="space-y-1.5">
            {plansForSelectedDate.map(plan => (
              <li key={plan.id} className="text-xs">
                <Link href={`/plans/${plan.id}`} className="hover:underline text-primary flex items-center gap-1.5">
                  <span className="truncate">{plan.name}</span>
                  <span className="text-muted-foreground flex-shrink-0">{plan.eventTime && isValid(parseISO(plan.eventTime)) ? format(parseISO(plan.eventTime), 'p') : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    } else {
      calendarFooter = <p className="text-sm text-muted-foreground p-3 text-center">No plans for {format(selectedDate, 'PPP')}.</p>;
    }
  }


  if (loading) {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading plans for {decodedCategoryName || 'category'}...</p>
        </div>
    );
  }
  
  if (!decodedCategoryName) {
    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] items-center justify-center">
            <p className="text-muted-foreground">Category not specified.</p>
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
        <span className="text-primary">{decodedCategoryName}</span>
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
                        title={`No Upcoming Plans in ${decodedCategoryName}`} 
                        message={searchTerm ? `Your search for "${searchTerm}" did not match any upcoming plans in this category.` : `There are no upcoming plans listed under "${decodedCategoryName}".`}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {upcomingPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} currentUserUid={user?.uid} />
                    ))}
                    </div>
                )}
                </TabsContent>

                <TabsContent value="past" className="mt-0">
                {pastPlans.length === 0 ? (
                    <EmptyState 
                        title={`No Past Plans in ${decodedCategoryName}`} 
                        message={searchTerm ? `Your search for "${searchTerm}" did not match any past plans in this category.` : `There are no past plans listed under "${decodedCategoryName}".`}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pastPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} currentUserUid={user?.uid} />
                    ))}
                    </div>
                )}
                </TabsContent>
            </>
        ) : ( // Calendar View
             <TabsContent value={activeTab} className="mt-0">
                {plansForCalendar.length === 0 && !loading ? (
                    <EmptyState
                        title={activeTab === 'upcoming' ? `No Upcoming Plans in ${decodedCategoryName}` : `No Past Plans in ${decodedCategoryName}`}
                        message={`There are no ${activeTab} plans in this category to display on the calendar.`}
                    />
                ) : (
                    <div className="bg-card p-2 sm:p-4 rounded-lg shadow">
                        <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(day) => {
                            if (day && isValid(day)) { setSelectedDate(day); setCurrentMonth(startOfMonth(day));} 
                            else { setSelectedDate(undefined); }
                        }}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md [&_button[name=day]]:rounded-md"
                        classNames={{
                            day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground',
                            day_today: 'bg-accent text-accent-foreground',
                            months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center',
                            month: 'space-y-4 w-full sm:w-auto',
                            caption_label: 'text-lg font-medium text-foreground/90',
                            head_cell: 'text-muted-foreground rounded-md w-full sm:w-10 font-normal text-[0.8rem]',
                            cell: 'h-10 w-full sm:w-10 text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                            day: 'h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-md',
                            nav_button: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100"),
                        }}
                        components={{ DayContent: DayWithDot }}
                        footer={calendarFooter}
                        modifiers={{ event: eventDates.filter(date => isValid(date)) as Date[] }}
                        modifiersClassNames={{ event: 'has-event' }}
                        />
                    </div>
                )}
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
