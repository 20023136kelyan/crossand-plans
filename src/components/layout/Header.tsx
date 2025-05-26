
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
// Removed Avatar imports as profile button is no longer here

// Removed MacaronLogo as it's not used in this simplified header

interface HeaderProps {
  messagesNotificationCount: number;
  // profileNotificationCount is no longer needed here
}

export function Header({ messagesNotificationCount }: HeaderProps) {
  // Removed user and currentUserProfile from useAuth() as they are not needed for just the messages icon

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          {/* Using a simple text logo for now, can be replaced with MacaronLogo if preferred */}
          <svg viewBox="0 0 64 64" className="h-7 w-7 text-primary" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M52,22.04C52,14.29,43.71,8,34,8H30C20.29,8,12,14.29,12,22.04a2.5,2.5,0,0,0,0,.27C12,25.25,16.42,30,26,30h12C47.58,30,52,25.25,52,22.31A2.5,2.5,0,0,0,52,22.04Z" />
            <rect x="10" y="30" width="44" height="4" rx="2" ry="2" />
            <path d="M52,41.96C52,49.71,43.71,56,34,56H30C20.29,56,12,49.71,12,41.96a2.5,2.5,0,0,1,0-.27C12,38.75,16.42,34,26,34h12C47.58,34,52,38.75,52,41.69A2.5,2.5,0,0,1,52,41.96Z" />
          </svg>
          <span className="text-2xl font-bold text-primary">Macaroom</span>
        </Link>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/messages" aria-label="Messages">
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-8 w-8 text-foreground/80 hover:text-primary transition-colors" // Kept larger size
                >
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-5H6V9h12v2z"/>
                </svg>
                {messagesNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md"> 
                    {messagesNotificationCount > 9 ? '9+' : messagesNotificationCount}
                  </span>
                )}
              </div>
            </Link>
          </Button>
          {/* Profile button is removed from here */}
        </div>
      </div>
    </header>
  );
}
