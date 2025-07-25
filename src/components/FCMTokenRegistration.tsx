'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { saveFcmToken } from '@/utils/saveFcmToken';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FCMTokenRegistrationProps {
  showUI?: boolean;
}

export function FCMTokenRegistration({ showUI = false }: FCMTokenRegistrationProps) {
  const { user } = useAuth();
  const registrationAttempted = useRef(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerFCMToken = async () => {
    if (!user) return;
    
    const sessionKey = `fcm_registered_${user.uid}`;
    
    try {
      setIsRegistering(true);
      setError(null);
      
      console.log('[FCMTokenRegistration] Registering FCM token for user:', user.uid);
      const token = await saveFcmToken();
      
      if (token) {
        console.log('[FCMTokenRegistration] FCM token registration completed successfully');
        registrationAttempted.current = true;
        localStorage.setItem(sessionKey, 'true');
        toast.success('Notifications enabled successfully!');
      } else {
        const errorMsg = 'Failed to get FCM token. Please check browser console for details.';
        console.warn('[FCMTokenRegistration] FCM token registration failed');
        setError(errorMsg);
        toast.error('Failed to enable notifications');
      }
    } catch (error: any) {
      console.error('[FCMTokenRegistration] Error registering FCM token:', error);
      
      let errorMessage = 'Failed to enable notifications';
      if (error?.code === 'messaging/permission-blocked') {
        errorMessage = 'Notifications are blocked. Please enable them in your browser settings.';
      } else if (error?.code === 'messaging/permission-default') {
        errorMessage = 'Please allow notifications to enable this feature.';
      } else if (error?.message?.includes('service worker')) {
        errorMessage = 'Service worker registration failed. Please try again or check browser support.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  // Wrap registerFCMToken in useCallback to prevent unnecessary re-renders
  const registerFCMTokenCallback = useCallback(async () => {
    if (!user) return;
    
    const sessionKey = `fcm_registered_${user.uid}`;
    
    try {
      setIsRegistering(true);
      setError(null);
      
      console.log('[FCMTokenRegistration] Registering FCM token for user:', user.uid);
      const token = await saveFcmToken();
      
      if (token) {
        console.log('[FCMTokenRegistration] FCM token registration completed successfully');
        registrationAttempted.current = true;
        localStorage.setItem(sessionKey, 'true');
        toast.success('Notifications enabled successfully!');
      } else {
        const errorMsg = 'Failed to get FCM token. Please check browser console for details.';
        console.warn('[FCMTokenRegistration] FCM token registration failed');
        setError(errorMsg);
        toast.error('Failed to enable notifications');
      }
    } catch (error: any) {
      console.error('[FCMTokenRegistration] Error registering FCM token:', error);
      
      let errorMessage = 'Failed to enable notifications';
      if (error?.code === 'messaging/permission-blocked') {
        errorMessage = 'Notifications are blocked. Please enable them in your browser settings.';
      } else if (error?.code === 'messaging/permission-default') {
        errorMessage = 'Please allow notifications to enable this feature.';
      } else if (error?.message?.includes('service worker')) {
        errorMessage = 'Service worker registration failed. Please try again or check browser support.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check if we've already registered for this user in this session
    const sessionKey = `fcm_registered_${user.uid}`;
    const alreadyRegistered = localStorage.getItem(sessionKey);
    
    if (registrationAttempted.current || alreadyRegistered) {
      return;
    }

    // Register token when component mounts (only once per session)
    registerFCMTokenCallback();

    // Set up periodic refresh (every 7 days)
    const refreshInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const intervalId = setInterval(() => {
      if (user) {
        localStorage.removeItem(sessionKey);
        registrationAttempted.current = false;
        registerFCMTokenCallback();
      }
    }, refreshInterval);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [user, registerFCMTokenCallback]);

  if (!showUI) return null;

  return (
    <div className="p-4 border rounded-lg bg-background">
      <h3 className="text-lg font-medium mb-2">Push Notifications</h3>
      {error ? (
        <div className="text-destructive text-sm mb-2">{error}</div>
      ) : null}
      <Button
        onClick={registerFCMTokenCallback}
        disabled={isRegistering}
        variant="outline"
        className="w-full"
      >
        {isRegistering ? 'Enabling...' : 'Enable Push Notifications'}
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Get real-time updates about your plans and messages.
      </p>
    </div>
  );
}