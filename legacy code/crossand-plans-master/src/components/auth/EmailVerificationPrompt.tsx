'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { sendEmailVerification } from 'firebase/auth';

interface EmailVerificationPromptProps {
  email: string;
  onVerified?: () => void;
}

export function EmailVerificationPrompt({ email, onVerified }: EmailVerificationPromptProps) {
  const [isResending, setIsResending] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleResendVerification = async () => {
    if (!user) return;
    
    setIsResending(true);
    try {
      await sendEmailVerification(user);
      setLastSentTime(new Date());
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox and spam folder for the verification link.',
      });
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const canResend = !lastSentTime || (Date.now() - lastSentTime.getTime()) > 60000; // 1 minute cooldown

  return (
    <Card className="w-full max-w-md shadow-xl bg-card/90 border-border/50">
      <CardHeader className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-xl font-bold text-gradient-primary">Verify Your Email</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          We've sent a verification link to <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Click the verification link in your email to activate your account and access all features.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Didn't receive the email? Check your spam folder or request a new one.
          </p>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResendVerification}
            disabled={isResending || !canResend}
          >
            {isResending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </Button>
          
          {lastSentTime && !canResend && (
            <p className="text-xs text-muted-foreground text-center">
              Please wait before requesting another email
            </p>
          )}
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Having trouble? Contact our{' '}
            <a href="mailto:support@example.com" className="text-primary hover:underline">
              support team
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}