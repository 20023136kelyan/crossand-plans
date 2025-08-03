'use client';

import { CheckBadgeIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';
import type { UserRoleType } from '@/types/user';

interface VerificationBadgeProps {
  role?: UserRoleType | null;
  isVerified?: boolean;
}

export function VerificationBadge({ role, isVerified }: VerificationBadgeProps) {
  if (!role && !isVerified) return null;

  if (role === 'admin') {
    return (
      <ShieldCheckIcon className="h-3.5 w-3.5 ml-1 text-primary" />
    );
  }

  if (isVerified) {
    return (
      <CheckBadgeIcon className="h-3.5 w-3.5 ml-1 text-primary" />
    );
  }

  return null;
} 