'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, PlusCircle, Sparkles, LayoutList, User as UserIcon, Settings, Edit3, Wallet as WalletIcon, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { UserProfile } from '@/types/user';
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarProvider
} from '@/components/ui/sidebar';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  id: string;
  action?: () => void;
  ariaLabel: string;
  adminOnly?: boolean;
}

interface SidebarProps {
  plansNotificationCount: number;
  profileNotificationCount: number;
  handleOpenCreatePostDialog: () => void;
  // openQuickAddMenu is now managed internally by Sidebar
}

export function Sidebar(props: SidebarProps) {
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
    { href: '/feed', label: 'Feed', icon: LayoutGrid, id: 'feed', ariaLabel: "Feed & Explore" },
    { href: '/wallet', label: 'Wallet', icon: WalletIcon, id: 'wallet', ariaLabel: "My Wallet"},
    { action: () => setIsQuickAddPopoverOpen(true), label: 'Create', icon: PlusCircle, id: 'quick-add', ariaLabel: "Quick Add Menu" },
    { href: '/plans', label: 'Plans', icon: LayoutList, id: 'plans', ariaLabel: "My Plans" },
  ];

  // Only add the profile/login item if we have definitive user state
  if (user) {
    navItems.push({ href: `/users/${user.uid}`, label: 'Profile', icon: Avatar, id: 'profile', ariaLabel: "My Profile" });
    if (currentUserProfile?.role === 'admin') {
      navItems.push({ href: '/admin/management', label: 'Admin', icon: Shield, id: 'admin', ariaLabel: "Admin Management", adminOnly: true });
    }
  } else if (user === null) { // Only show login if we're sure user is not authenticated
    navItems.push({ href: '/login', label: 'Login', icon: UserIcon, id: 'login', ariaLabel: "Login" });
  }

  return (
    <SidebarProvider>
      <UISidebar
        side="left"
        variant="sidebar"
        collapsible="icon"
        className="hidden md:flex md:flex-col md:w-[240px] lg:w-[256px] bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border p-3 space-y-3 shrink-0 h-full fixed left-0 top-0 z-30 overflow-y-auto custom-scrollbar-vertical"
      >
        <SidebarHeader className="flex items-center gap-2 p-2 mb-2">
          <svg viewBox="0 0 64 64" className="h-8 w-8 text-primary" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M52,22.04C52,14.29,43.71,8,34,8H30C20.29,8,12,14.29,12,22.04a2.5,2.5,0,0,0,0,.27C12,25.25,16.42,30,26,30h12C47.58,30,52,25.25,52,22.31A2.5,2.5,0,0,0,52,22.04Z" />
              <rect x="10" y="30" width="44" height="4" rx="2" ry="2" />
              <path d="M52,41.96C52,49.71,43.71,56,34,56H30C20.29,56,12,49.71,12,41.96a2.5,2.5,0,0,1,0-.27C12,38.75,16.42,34,26,34h12C47.58,34,52,38.75,52,41.69A2.5,2.5,0,0,1,52,41.96Z" />
            </svg>
          <span className="text-xl font-bold text-primary">Macaroom</span>
        </SidebarHeader>
        <SidebarContent className="flex-1">
          <SidebarMenu>
            {navItems.map((item) => {
              if (item.adminOnly && currentUserProfile?.role !== 'admin') {
                return null;
              }

              const isActive = pathname === item.href ||
                               (item.id === 'profile' && user && pathname === `/users/${user.uid}`) ||
                               (item.href === '/feed' && pathname === '/');
              const IconComponent = item.icon;
              const notificationCount = getNotificationCount(item.id);

              if (item.id === 'quick-add' && item.action) {
                return (
                  <Popover key={item.id} open={isQuickAddPopoverOpen} onOpenChange={setIsQuickAddPopoverOpen}>
                    <SidebarMenuItem>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton
                          isActive={isQuickAddPopoverOpen}
                          onClick={item.action}
                          aria-label={item.ariaLabel}
                          aria-expanded={isQuickAddPopoverOpen}
                        >
                          <IconComponent className={cn("h-5 w-5 mr-3", "text-sidebar-foreground/80" )} />
                          {item.label}
                        </SidebarMenuButton>
                      </PopoverTrigger>
                    </SidebarMenuItem>
                    <PopoverContent
                        side="right"
                        align="start"
                        className="w-56 p-2 shadow-xl rounded-xl border-border/50 bg-card/95 backdrop-blur-sm ml-2"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="grid gap-1">
                          <Button variant="ghost" className="w-full justify-start text-sm h-9" asChild onClick={() => setIsQuickAddPopoverOpen(false)}>
                            <Link href="/plans/generate">
                              <Sparkles className="mr-2 h-4 w-4" /> New Plan (AI)
                            </Link>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={() => { props.handleOpenCreatePostDialog(); setIsQuickAddPopoverOpen(false); }}>
                            <Edit3 className="mr-2 h-4 w-4" /> New Post
                          </Button>
                        </div>
                      </PopoverContent>
                  </Popover>
                );
              }

              if (item.id === 'profile' && user && currentUserProfile) {
                const userInitial = currentUserProfile.name ? currentUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U');
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      asChild
                    >
                      <Link
                        href={item.href!}
                        aria-label={item.ariaLabel}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Avatar className={cn("h-6 w-6 mr-3", isActive && "ring-1 ring-sidebar-primary ring-offset-1 ring-offset-sidebar-background")}>
                          <AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'Profile'} data-ai-hint="user avatar"/>
                          <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
                        </Avatar>
                        {item.label}
                        {notificationCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {notificationCount > 9 ? '9+' : notificationCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }

              if (item.href) { // Ensure item has an href before rendering Link
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      asChild
                    >
                      <Link
                        href={item.href}
                        aria-label={item.ariaLabel}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <IconComponent className="h-5 w-5 mr-3" />
                        {item.label}
                        {notificationCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                             {notificationCount > 9 ? '9+' : notificationCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              return null; // Should not happen if navItems are well-defined
            })}
          </SidebarMenu>
        </SidebarContent>
        {user && (
          <SidebarFooter className="mt-auto pt-3 border-t border-sidebar-border">
             <SidebarMenuItem>
                <SidebarMenuButton
                isActive={pathname === '/users/settings'}
                asChild
                >
                <Link
                    href="/users/settings"
                    aria-label="Settings"
                    aria-current={pathname === '/users/settings' ? "page" : undefined}
                >
                    <Settings className="h-5 w-5 mr-3" />
                    Settings
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarFooter>
        )}
      </UISidebar>
    </SidebarProvider>
  );
}
