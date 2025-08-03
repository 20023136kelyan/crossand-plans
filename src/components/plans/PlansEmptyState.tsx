'use client';

import Link from "next/link";
import { InboxIcon, MagnifyingGlassIcon, CalendarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { format, isFuture } from "date-fns";

interface PlansEmptyStateProps {
  title: string;
  message: string;
  showCreateButton?: boolean;
  searchQuery?: string;
  selectedDate?: Date;
  isSearchActive?: boolean;
  isDateFilterActive?: boolean;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  activeTab?: 'upcoming' | 'past' | 'saved';
}

export function PlansEmptyState({ 
  title, 
  message, 
  showCreateButton = true,
  searchQuery,
  selectedDate,
  isSearchActive = false,
  isDateFilterActive = false,
  onClearSearch,
  onClearFilters,
  activeTab
}: PlansEmptyStateProps) {
  
  // Determine the appropriate icon and styling based on context
  const getEmptyStateContent = () => {
    if (isSearchActive && searchQuery?.trim()) {
      return {
        icon: Search,
        title: "🔍 Oops! Nothing Found",
        message: `No magical plans match "${searchQuery}"${isDateFilterActive && selectedDate ? ` for ${format(selectedDate, 'MMMM d, yyyy')}` : ''}. But hey, that's an opportunity to create something amazing! ✨`,
        showCreate: false,
        actions: (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={onClearSearch}
              className="flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              Clear Search
            </Button>
            {isDateFilterActive && (
              <Button 
                variant="outline" 
                onClick={onClearFilters}
                className="flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                Show All Dates
              </Button>
            )}
          </div>
        )
      };
    }
    
    if (isDateFilterActive && selectedDate && isFuture(selectedDate) && activeTab !== 'past') {
      return {
        icon: CalendarIcon,
        title: "📅 Free Day Ahead!",
        message: `${format(selectedDate, 'EEEE, MMMM d, yyyy')} is completely open! Perfect time to plan something exciting and spontaneous! 🎉`,
        showCreate: true,
        actions: (
          <div className="flex flex-col sm:flex-row gap-3">
            {showCreateButton && (
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <Link href="/plans/generate">
                  ✨ Create Magic!
                </Link>
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={onClearFilters}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              Show All Dates
            </Button>
          </div>
        )
      };
    }
    
    if (isDateFilterActive && selectedDate && activeTab === 'past') {
      return {
        icon: CalendarIcon,
        title: "📚 No Past Plans",
        message: `No completed plans found for ${format(selectedDate, 'EEEE, MMMM d, yyyy')}. Your adventure history for this date is empty.`,
        showCreate: false,
        actions: (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={onClearFilters}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              Show All Dates
            </Button>
          </div>
        )
      };
    }
    
    // Default empty state
    return {
      icon: InboxIcon,
      title,
      message,
      showCreate: showCreateButton,
      actions: showCreateButton ? (
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <Link href="/plans/generate">
            🌟 Start Planning!
          </Link>
        </Button>
      ) : null
    };
  };

  const content = getEmptyStateContent();
  const IconComponent = content.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 min-h-[400px] text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-xl opacity-50"></div>
        <div className="relative bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-full border border-border/50">
          <IconComponent className="h-12 w-12 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-3">{content.title}</h3>
      <p className="text-muted-foreground mb-8 max-w-md text-lg leading-relaxed">{content.message}</p>
      {content.actions && (
        <div className="flex flex-col items-center gap-4">
          {content.actions}
        </div>
      )}
    </div>
  );
} 