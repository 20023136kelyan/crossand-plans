
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, CalendarDays, Users, HandCoins, CalendarPlus } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/plans/create/initiate', label: 'Create Plan', icon: CalendarPlus },
  { href: '/plans', label: 'My Plans', icon: CalendarDays },
  { href: '/profile', label: 'My Profile', icon: User },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/payments', label: 'Payments', icon: HandCoins },
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
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
