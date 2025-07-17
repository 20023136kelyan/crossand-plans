
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, profileExists } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.emailVerified && profileExists === true) {
        // User is fully verified and has profile - redirect to feed
        router.push('/feed');
      } else if (user.emailVerified && profileExists === false) {
        // User is verified but no profile - redirect to onboarding
        router.push('/onboarding');
      }
      // If email not verified, stay on current page (signup/verification)
    }
  }, [user, loading, profileExists, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }
  
  // If user is already loaded and present, and meets all requirements, they will be redirected.
  // If user is not present or not fully verified/onboarded, show the children (login/signup form or email verification prompt).
  if (user && user.emailVerified && profileExists === true) {
    return null; // Or a loading spinner until redirect completes
  }
  
  // If user is verified but no profile, redirect to onboarding
  if (user && user.emailVerified && profileExists === false) {
    return null; // Or a loading spinner until redirect completes
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative" style={{ background: 'none' }}>
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
