'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, profileExists } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Helper: check if on email verification prompt
  const isOnEmailVerificationPrompt = pathname.startsWith('/signup') && typeof window !== 'undefined' && window.location.search.includes('verify=1') && window.location.search.includes('email=');

  useEffect(() => {
    if (!loading && user) {
      if (user.emailVerified && profileExists === true) {
        router.push('/feed');
      } else if (user.emailVerified && profileExists === false) {
        router.push('/onboarding');
      } else if (!user.emailVerified && isOnEmailVerificationPrompt) {
        // Stay on email verification prompt
        return;
      }
      // If email not verified and not on verification prompt, stay on current page
    }
  }, [user, loading, profileExists, router, isOnEmailVerificationPrompt]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  if (!isOnEmailVerificationPrompt) {
    if (user && user.emailVerified && profileExists === true) {
      return null; // Or a loading spinner until redirect completes
    }
    // If user is verified but no profile, redirect to onboarding
    if (user && user.emailVerified && profileExists === false) {
      return null; // Or a loading spinner until redirect completes
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative dark" style={{ background: 'none' }}>
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/images/login-background.jpg")',
          filter: 'brightness(0.4)',
          backgroundColor: '#1a1a1a'
        }}
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
}
