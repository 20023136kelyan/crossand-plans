import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  UserIcon,
  CalendarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  BellIcon
} from '@heroicons/react/24/outline';
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
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/plans/create/initiate', label: 'Create Plan', icon: PlusCircleIcon },
  { href: '/plans', label: 'My Plans', icon: CalendarIcon },
  { href: '/explore', label: 'Explore', icon: MagnifyingGlassIcon },
  { href: '/profile', label: 'My Profile', icon: UserIcon },
  { href: '/friends', label: 'Friends', icon: UserGroupIcon },
  { href: '/payments', label: 'Payments', icon: BanknotesIcon },
  { href: '/users/notifications', label: 'Notifications', icon: BellIcon },
];