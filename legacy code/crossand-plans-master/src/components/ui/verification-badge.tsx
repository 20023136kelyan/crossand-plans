'use client';

import { BadgeCheck, ShieldCheck } from 'lucide-react';
import type { UserRoleType } from '@/types/user';

interface VerificationBadgeProps {
  role?: UserRoleType | null;
  isVerified?: boolean;
}

export function VerificationBadge({ role, isVerified }: VerificationBadgeProps) {
  if (!role && !isVerified) return null;

  if (role === 'admin') {
    return (
      <ShieldCheck className="h-3.5 w-3.5 ml-1 text-primary" />
    );
  }

  if (isVerified) {
    return (
      <BadgeCheck className="h-3.5 w-3.5 ml-1 text-primary" />
    );
  }

  return null;
} 