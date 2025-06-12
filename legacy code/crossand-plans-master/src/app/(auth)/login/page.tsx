'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { settings } = useSettings();
  const message = searchParams.get('message');
  
  const siteName = settings?.siteName || 'Macaroom';

  useEffect(() => {
    if (message === 'registration-disabled') {
      toast({
        title: 'Registration Disabled',
        description: `New user registration is currently disabled for ${siteName}. If you need an account, please contact support.`,
        variant: 'destructive',
      });
    }
  }, [message, toast, siteName]);

  return (
    <div className="w-full max-w-md space-y-8">
      <LoginForm />
    </div>
  );
}
