'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HorizontalCalendar } from './HorizontalCalendar';
import { FullCalendarDrawer } from './FullCalendarDrawer';
import { PlansNavigationTabs } from './PlansNavigationTabs';
import { format } from 'date-fns';
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

  return (
    <>
      {/* Main Header */}
      <header className="shrink-0 bg-background border-b border-border/10">
        {/* Top Section: Selected Date + Search Icon */}
        <div className="px-4 pt-4 pb-2">
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
            <div className="px-4 pb-3">
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
        <div className="px-4 pb-3">
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

        {/* Navigation Tabs */}
        <div className="px-4 pb-3">
          <PlansNavigationTabs activeTab={activeTab} onTabChange={onTabChange} />
        </div>
      </header>

      {/* Full Calendar Drawer */}
      <FullCalendarDrawer
        isOpen={isCalendarExpanded}
        onClose={() => setIsCalendarExpanded(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          onDateSelect(date);
          setIsCalendarExpanded(false);
        }}
        plansForDate={plansForDate}
      />
    </>
  );
} 