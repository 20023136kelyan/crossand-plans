'use client';

import { CalendarDaysIcon, StarIcon, ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface PlansNavigationTabsProps {
  activeTab: 'upcoming' | 'past' | 'saved';
  onTabChange: (tab: 'upcoming' | 'past' | 'saved') => void;
}

export function PlansNavigationTabs({ activeTab, onTabChange }: PlansNavigationTabsProps) {
  const tabs = [
    {
      id: 'upcoming' as const,
      label: 'Upcoming',
      icon: CalendarDaysIcon,
    },
    {
      id: 'saved' as const,
      label: 'Saved',
      icon: StarIcon,
    },
    {
      id: 'past' as const,
      label: 'Past',
      icon: ClockIcon,
    }
  ];

  return (
    <div className="flex items-center w-full">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <div
            key={tab.id}
            className={cn(
              "flex-1 py-2 text-sm font-medium transition-colors relative cursor-pointer flex items-center justify-center gap-2",
              isActive 
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
} 