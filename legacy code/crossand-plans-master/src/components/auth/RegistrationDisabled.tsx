'use client';

import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserX, Mail } from 'lucide-react';
import Link from 'next/link';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

export function RegistrationDisabled() {
  const { settings } = useSettings();
  
  const siteName = settings?.siteName || 'Macaroom';
  const supportEmail = settings?.supportEmail || 'support@macaroom.com';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <CrossandLogo className="h-16 w-16" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-gradient-primary">{siteName}</CardTitle>
            <CardDescription className="text-lg font-medium text-foreground/80">
              Registration Temporarily Disabled
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-amber-100 dark:bg-amber-900/20 rounded-full">
              <UserX className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-foreground/70">
              New user registration is currently disabled. We're working to improve our services.
            </p>
            <p className="text-sm text-muted-foreground">
              If you already have an account, you can still log in normally.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/login">
              <Button className="w-full">
                Go to Login
              </Button>
            </Link>
            
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                Need an account? Contact us at{' '}
                <Link 
                  href={`mailto:${supportEmail}`} 
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" />
                  {supportEmail}
                </Link>
              </p>
              <p>
                <Link 
                  href="/" 
                  className="text-primary hover:underline"
                >
                  Return to Homepage
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}