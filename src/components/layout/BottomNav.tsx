'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  MagnifyingGlassIcon as Search,
  PlusCircleIcon as PlusCircle,
  ListBulletIcon as LayoutList,
  UserIcon,
  SparklesIcon as Sparkles,
  PencilSquareIcon as Edit3,
  CameraIcon as Camera,
  ChatBubbleLeftRightIcon as MessageSquare,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/types/user';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  id: string;
  action?: () => void;
  ariaLabel: string;
}

interface BottomNavProps {
  plansNotificationCount: number;
  profileNotificationCount: number;
  handleOpenCreatePostDialog: () => void;
  openQuickAddMenu: () => void; // Renamed for clarity
}

const commonLinkClasses =
  'relative flex flex-1 flex-col items-center justify-center rounded-md p-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background h-full';


function LinkItem({ navItem, currentPathname, notificationCount, currentUserProfile }: {
  navItem: NavItem;
  currentPathname: string;
  notificationCount: number;
  currentUserProfile: UserProfile | null;
}) {
  if (typeof navItem.href !== 'string') {
    // This case should ideally not be hit if the main map filters correctly
    return null;
  }

  const isActive = currentPathname === navItem.href ||
                   (navItem.id === 'profile' && currentUserProfile && currentPathname === `/users/${currentUserProfile.uid}`) ||
                   (navItem.href === '/feed' && currentPathname === '/');
  const IconComponent = navItem.icon;

  if (navItem.id === 'profile' && currentUserProfile) {
    const userInitial = currentUserProfile.name ? currentUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (currentUserProfile.email ? currentUserProfile.email[0].toUpperCase() : 'U');
    return (
       <Link href={navItem.href} className={cn(commonLinkClasses, isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary')} aria-label={navItem.ariaLabel} aria-current={isActive ? "page" : undefined}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-full relative", isActive && "-translate-y-2")}>
          <Avatar className={cn("h-7 w-7 transition-all duration-300 ease-out", isActive && "ring-1 ring-primary ring-offset-1 ring-offset-background scale-110")}>
            <AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'Profile'} data-ai-hint="user avatar"/>
            <AvatarFallback className="text-[10px]">{userInitial}</AvatarFallback>
          </Avatar>
          {notificationCount > 0 && (
            <span className="absolute top-0.5 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md -translate-x-0.5 -translate-y-0.5">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
          <div className={cn(
            "absolute bottom-2 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary transition-all duration-300 ease-out",
            isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
          )} />
        </div>
      </Link>
    );
  }

  return (
      <Link href={navItem.href} className={cn(commonLinkClasses, isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary')} aria-label={navItem.ariaLabel} aria-current={isActive ? "page" : undefined}>
        <div className={cn("flex h-full w-full items-center justify-center rounded-full relative", isActive && "-translate-y-1.5")}>
          <IconComponent className={cn("h-6 w-6 transition-all duration-300 ease-out", isActive ? "text-primary scale-110" : "text-muted-foreground scale-100", "hover:scale-105")} />
          {notificationCount > 0 && (
            <span className="absolute top-0.5 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md -translate-x-0.5 -translate-y-0.5">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
          <div className={cn(
            "absolute bottom-2.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary transition-all duration-300 ease-out",
            isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
          )} />
        </div>
      </Link>
    );
}

export function BottomNav(props: BottomNavProps) {
  const pathname = usePathname();
  const { user, currentUserProfile } = useAuth();
  const [isQuickAddPopoverOpen, setIsQuickAddPopoverOpen] = useState(false);

  const getNotificationCount = (itemId: string): number => {
    if (itemId === 'plans') return props.plansNotificationCount;
    if (itemId === 'profile') return props.profileNotificationCount;
    return 0;
  };

  // Define base navigation items - only include profile/login if we have user data
  const navItems: NavItem[] = [
    { href: '/feed', label: 'Home', icon: HomeIcon, id: 'feed', ariaLabel: "Home" },
    { href: '/messages', label: 'Messages', icon: MessageSquare, id: 'messages', ariaLabel: "Messages" },
    { action: () => setIsQuickAddPopoverOpen(true), label: 'Create', icon: PlusCircle, id: 'quick-add', ariaLabel: "Quick Add Menu" },
    { href: '/plans', label: 'Plans', icon: LayoutList, id: 'plans', ariaLabel: "My Plans" },
  ];

  // Only add the profile/login item if we have definitive user state
  if (user) {
    navItems.push({ href: `/users/${user.uid}`, label: 'Profile', icon: Avatar, id: 'profile', ariaLabel: "My Profile" });
  } else if (user === null) { // Only show login if we're sure user is not authenticated
    navItems.push({ href: '/login', label: 'Login', icon: UserIcon, id: 'login', ariaLabel: "Login" });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/30 bg-background/95 backdrop-blur-sm md:hidden rounded-t-3xl">
      <div className="container mx-auto grid h-16 items-center justify-around px-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)`}}>
        {navItems.map((item) => {
          if (item.id === 'quick-add' && item.action) {
            const CreateIcon = item.icon;
            return (
              <Popover key={item.id} open={isQuickAddPopoverOpen} onOpenChange={setIsQuickAddPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      commonLinkClasses,
                      isQuickAddPopoverOpen ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    )}
                    onClick={item.action}
                    aria-label={item.ariaLabel}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full relative">
                      <CreateIcon className="h-6 w-6" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  className={cn(
                    "w-56 p-2 shadow-xl rounded-xl border-border/50 bg-card/95 backdrop-blur-sm mb-2"
                  )}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="grid gap-1">
                    <Button variant="ghost" className="w-full justify-start text-sm h-9" asChild onClick={(e) => {
                      e.stopPropagation();
                      setIsQuickAddPopoverOpen(false);
                    }}>
                      <Link href="/plans/generate">
                        <Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={(e) => {
                      e.stopPropagation();
                      props.handleOpenCreatePostDialog();
                      setIsQuickAddPopoverOpen(false);
                    }}>
                      <Camera className="mr-2 h-4 w-4" /> New Post
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }
          if (typeof item.href === 'string') {
            return (
              <LinkItem
                key={item.id}
                navItem={item}
                currentPathname={pathname}
                notificationCount={getNotificationCount(item.id)}
                currentUserProfile={currentUserProfile}
              />
            );
          }
          return null;
        })}
      </div>
    </nav>
  );
}
