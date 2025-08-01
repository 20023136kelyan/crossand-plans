'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Loader2, RefreshCw, Mail, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { sendEmailVerification, updateEmail } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

interface EmailVerificationPromptProps {
  email: string;
  onVerified?: () => void;
}

const EmailIcon = ({ className }: { className?: string }) => (
  <span className={`text-14xl ${className}`}>📧</span>
);

export function EmailVerificationPrompt({ email: initialEmail, onVerified }: EmailVerificationPromptProps) {
  const [isResending, setIsResending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState(initialEmail);
  const { toast } = useToast();
  const { user, refreshProfileStatus } = useAuth();
  const router = useRouter();

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

  const handleUpdateEmail = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateEmail(user, newEmail);
      setEmail(newEmail);
      setShowUpdate(false);
      toast({
        title: 'Email Updated',
        description: 'Your email has been updated. Please check your inbox for a new verification email.',
      });
      await handleResendVerification();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update email.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg bg-gray-900/30 backdrop-blur-md border-gray-700/40 overflow-hidden rounded-2xl">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-2">
            <EmailIcon className="h-20 w-20" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-4">
        <div className="space-y-2 text-center min-h-[56px] flex flex-col justify-center">
          <CardTitle className="text-xl font-semibold text-foreground">Please verify your email</CardTitle>
          {showUpdate ? (
            <p className="text-sm text-muted-foreground">
              Enter your new email address below.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              We just sent an email to <span className="font-medium">{email}</span>.<br />
              Click the link in the email to verify your account.
            </p>
          )}
        </div>
        {showUpdate ? (
          <div className="flex flex-col gap-2 items-center">
            <Input
              type="email"
              className="h-10"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              disabled={isUpdating}
              placeholder="Enter new email"
            />
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={handleUpdateEmail}
                disabled={isUpdating || !newEmail || newEmail === email}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save
              </Button>
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={() => setShowUpdate(false)}
                disabled={isUpdating}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            <Button
              variant="outline"
              className="h-10 border-border/50 hover:bg-secondary/50"
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Resend email
            </Button>
            <Button
              variant="outline"
              className="h-10 border-border/50 hover:bg-secondary/50"
              onClick={() => setShowUpdate(true)}
              disabled={isResending}
            >
              <Mail className="mr-2 h-4 w-4" />
              Update email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}