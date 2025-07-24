
'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SearchedUser } from '@/types/user';
import { VerificationBadge } from '@/components/ui/verification-badge'; // Assuming you have this for consistency
import { getFullName } from '@/lib/utils';

interface UserSearchResultCardProps {
  userResult: SearchedUser;
}

export function UserSearchResultCard({ userResult }: UserSearchResultCardProps) {
  const displayName = getFullName(userResult) || userResult.username || userResult.email || 'Unnamed User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <Link href={`/users/${userResult.uid}`} className="block group">
      <div className="bg-card p-3.5 rounded-lg border border-border/50 hover:bg-accent/10 transition-colors shadow-sm h-full flex flex-col">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={userResult.avatarUrl || undefined} alt={displayName} data-ai-hint="person avatar" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <p className="text-sm font-semibold text-foreground truncate group-hover:underline">
                {displayName}
              </p>
              <VerificationBadge role={userResult.role} isVerified={userResult.isVerified || false} />
            </div>
            {userResult.username && (
              <p className="text-xs text-muted-foreground truncate">@{userResult.username}</p>
            )}
            {!userResult.username && userResult.email && (
               <p className="text-xs text-muted-foreground truncate">{userResult.email}</p>
            )}
          </div>
        </div>
        {/* Future actions like 'Add Friend' or 'Message' can be added here if needed */}
      </div>
    </Link>
  );
}
