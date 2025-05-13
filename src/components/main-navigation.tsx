
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, CalendarDays, Users, Settings, ShieldAlert, HandCoins, CalendarPlus } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/plans/create/initiate', label: 'Create Plan', icon: CalendarPlus }, // Updated href
  { href: '/plans', label: 'My Plans', icon: CalendarDays },
  { href: '/profile', label: 'My Profile', icon: User },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/payments', label: 'Payments', icon: HandCoins, isPlaceholder: true },
  // { href: '/settings', label: 'Settings', icon: Settings },
];

export function MainNavigation() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
            tooltip={item.label}
            className={cn(item.isPlaceholder && "text-muted-foreground hover:text-muted-foreground cursor-not-allowed")}
          >
            <Link href={item.isPlaceholder ? "#" : item.href} aria-disabled={item.isPlaceholder}>
              <item.icon />
              <span>{item.label} {item.isPlaceholder && <span className="text-xs">(Soon)</span>}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

