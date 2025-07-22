
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, LayoutList, User as UserIcon, Shield, Compass, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import React from 'react';

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
}

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const { user, currentUserProfile } = useAuth();

  const getNotificationCount = (itemId: string): number => {
    if (itemId === 'plans') return props.plansNotificationCount;
    if (itemId === 'profile') return props.profileNotificationCount;
    return 0;
  };

  // Build navigation items based on user state
  const navItems: NavItem[] = [];
  
  if (user && currentUserProfile) {
    navItems.push(
      { href: '/feed', label: 'Feed', icon: LayoutGrid, id: 'feed', ariaLabel: "Feed" },
      { href: '/explore', label: 'Explore', icon: Compass, id: 'explore', ariaLabel: "Explore" },
      { href: '/messages', label: 'Messages', icon: MessageSquare, id: 'messages', ariaLabel: "Messages" },
      { href: '/plans', label: 'Plans', icon: LayoutList, id: 'plans', ariaLabel: "Plans" },
      { href: `/users/${user.uid}`, label: 'Profile', icon: UserIcon, id: 'profile', ariaLabel: "Profile" }
    );
    
    // Add admin link if user is admin
    if (currentUserProfile?.role === 'admin') {
      navItems.push({ href: '/admin/management', label: 'Admin', icon: Shield, id: 'admin', ariaLabel: "Admin Management", adminOnly: true });
    }
  } else if (user === null) {
    navItems.push({ href: '/login', label: 'Login', icon: UserIcon, id: 'login', ariaLabel: "Login" });
  }

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        if (item.adminOnly && currentUserProfile?.role !== 'admin') {
          return null;
        }

        const isActive = pathname === item.href ||
          (item.href === '/feed' && pathname === '/') ||
          (item.id === 'profile' && currentUserProfile && pathname === `/users/${currentUserProfile.uid}`) ||
          (item.href && pathname.startsWith(item.href + '/'));

        const notificationCount = getNotificationCount(item.id);

        const content = (
          <>
            {item.id === 'profile' && currentUserProfile ? (
              <Avatar className="mr-3 h-4 w-4">
                <AvatarImage src={currentUserProfile.avatarUrl || undefined} alt={currentUserProfile.name || 'Profile'} />
                <AvatarFallback className="text-[8px]">
                  {currentUserProfile.name ? currentUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (currentUserProfile.email ? currentUserProfile.email[0].toUpperCase() : 'U')}
                </AvatarFallback>
              </Avatar>
            ) : (
              <item.icon className="mr-3 h-4 w-4" />
            )}
            <span className="text-sm font-medium">{item.label}</span>
            {notificationCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </>
        );

        const className = cn(
          "flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        );

        if (item.action) {
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={className}
              aria-label={item.ariaLabel}
            >
              {content}
            </button>
          );
        }

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className={className}
              aria-label={item.ariaLabel}
            >
              {content}
            </Link>
          );
        }

        return null;
      })}
    </nav>
  );
}
