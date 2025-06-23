'use client';

import Link from "next/link";
import { PackageOpen, Sparkles, Search, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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
  onClearFilters
}: PlansEmptyStateProps) {
  
  // Determine the appropriate icon and styling based on context
  const getEmptyStateContent = () => {
    if (isSearchActive && searchQuery?.trim()) {
      return {
        icon: Search,
        title: "No Results Found",
        message: `No plans match "${searchQuery}"${isDateFilterActive && selectedDate ? ` for ${format(selectedDate, 'MMMM d, yyyy')}` : ''}`,
        showCreate: false,
        actions: (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={onClearSearch}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear Search
            </Button>
            {isDateFilterActive && (
              <Button 
                variant="outline" 
                onClick={onClearFilters}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Show All Dates
              </Button>
            )}
          </div>
        )
      };
    }
    
    if (isDateFilterActive && selectedDate) {
      return {
        icon: Calendar,
        title: "No Plans on This Date",
        message: `You don't have any plans scheduled for ${format(selectedDate, 'EEEE, MMMM d, yyyy')}`,
        showCreate: true,
        actions: (
          <div className="flex flex-col sm:flex-row gap-3">
            {showCreateButton && (
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                <Link href="/plans/generate">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create New Plan
                </Link>
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={onClearFilters}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Show All Dates
            </Button>
          </div>
        )
      };
    }
    
    // Default empty state
    return {
      icon: PackageOpen,
      title,
      message,
      showCreate: showCreateButton,
      actions: showCreateButton ? (
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
          <Link href="/plans/generate">
            <Sparkles className="w-5 h-5 mr-2" />
            Create New Plan
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
          <IconComponent className="h-12 w-12 text-muted-foreground/70" />
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