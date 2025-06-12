'use client';

import { useSettings } from '@/context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

export default function MaintenancePage() {
  const { settings } = useSettings();
  
  const siteName = settings?.siteName || 'Macaroom';
  const supportEmail = settings?.supportEmail || 'support@macaroom.com';

  const handleRefresh = () => {
    window.location.reload();
  };

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
              Under Maintenance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-full">
              <Wrench className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-foreground/70">
              We're currently performing scheduled maintenance to improve your experience.
            </p>
            <p className="text-sm text-muted-foreground">
              We'll be back online shortly. Thank you for your patience!
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleRefresh}
              variant="outline" 
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Need help? Contact us at{' '}
              <Link 
                href={`mailto:${supportEmail}`} 
                className="text-primary hover:underline"
              >
                {supportEmail}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}