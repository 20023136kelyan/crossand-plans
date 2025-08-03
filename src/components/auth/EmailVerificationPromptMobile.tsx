'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeftIcon as ChevronLeft,
  ArrowPathIcon as Loader2,
  ArrowPathIcon as RefreshCw,
  EnvelopeIcon as Mail
} from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface EmailVerificationPromptMobileProps {
  email: string;
  onVerified?: () => void;
}

export function EmailVerificationPromptMobile({ email: initialEmail, onVerified }: EmailVerificationPromptMobileProps) {
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [isPressed, setIsPressed] = useState(false);
  const { toast } = useToast();
  const { user, refreshProfileStatus } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user && !user.emailVerified) {
      // Check immediately
      user.reload().then(async () => {
        if (user.emailVerified) {
          // After email verification, refresh profile status and let app layout handle redirect
          await refreshProfileStatus();
          // Force a router refresh to trigger the redirect logic
          router.refresh();
        }
      });
      
      // Also set up a periodic check in case user refreshes after clicking email link
      const checkInterval = setInterval(async () => {
        if (user && !user.emailVerified) {
          await user.reload();
          if (user.emailVerified) {
            clearInterval(checkInterval);
            await refreshProfileStatus();
            router.refresh();
          }
        }
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(checkInterval);
    }
  }, [user, router, refreshProfileStatus]);

  const handleResendVerification = async () => {
    if (!user) return;
    setIsResending(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/onboarding`,
        handleCodeInApp: true
      };
      await sendEmailVerification(user, actionCodeSettings);
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send verification email.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };



  if (!isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a' }} />
      <div className="fixed inset-0 backdrop-blur-md" />
      <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 pointer-events-none" />
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between px-4 py-6 relative z-10">
        <button 
          onClick={() => router.push('/signup')}
          className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="h-7 w-7 text-white" />
        </button>
        <div className="w-12"></div> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 relative z-10 flex flex-col items-center justify-center min-h-[70vh]">
        {/* Content Card */}
        <div className="mb-6 w-full max-w-sm">
          <div className="space-y-6">
            {/* Email Icon */}
            <div className="text-center py-8">
              <div className="mx-auto mb-6 flex items-center justify-center">
                <span className="text-8xl">📧</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Check Your Email
              </h2>
              <p className="text-gray-300 text-sm mb-2">
                We've sent a verification code to
              </p>
              <p className="text-white font-semibold text-base">
                {email}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-6">
              {/* Help Text */}
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Didn't receive the email?{' '}
                  <button 
                    onClick={() => {
                      const subject = encodeURIComponent('Email Verification Issue - Incorrect Email');
                      const body = encodeURIComponent(`Hi Support Team,

I'm having trouble with email verification. Here are my details:

Current Email: ${email}
Issue: I entered an incorrect email during signup and cannot receive the verification code.

Please help me update my email address.

Thank you!`);
                      window.location.href = `mailto:support@crossand.com?subject=${subject}&body=${body}`;
                    }}
                    disabled={isResending}
                    className="text-orange-500 font-semibold hover:underline"
                  >
                    Contact Support
                  </button>
                </p>
              </div>

              {/* Verify Button */}
              <button
                onClick={() => router.push('/onboarding')}
                onPointerDown={() => setIsPressed(true)}
                onPointerUp={() => setIsPressed(false)}
                onPointerLeave={() => setIsPressed(false)}
                onTouchStart={() => setIsPressed(true)}
                onTouchEnd={() => setIsPressed(false)}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-75 ${
                  isPressed ? 'scale-98' : ''
                } bg-black hover:bg-gray-900 shadow-lg`}
              >
                Verify your Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 