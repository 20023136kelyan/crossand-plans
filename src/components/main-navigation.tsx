import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, CalendarDays, Users, Settings, ShieldAlert, HandCoins, CalendarPlus, Search, Bell } from 'lucide-react';
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
  { href: '/plans/create/initiate', label: 'Create Plan', icon: CalendarPlus },
  { href: '/plans', label: 'My Plans', icon: CalendarDays },
  { href: '/explore', label: 'Explore', icon: Search },
  { href: '/profile', label: 'My Profile', icon: User },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/payments', label: 'Payments', icon: HandCoins },
  { href: '/users/notifications', label: 'Notifications', icon: Bell },
];