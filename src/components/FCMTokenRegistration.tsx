'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { saveFcmToken } from '@/utils/saveFcmToken';

export function FCMTokenRegistration() {
  const { user } = useAuth();
  const registrationAttempted = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Check if we've already registered for this user in this session
    const sessionKey = `fcm_registered_${user.uid}`;
    const alreadyRegistered = localStorage.getItem(sessionKey);
    
    if (registrationAttempted.current || alreadyRegistered) {
      return;
    }

    const registerFCMToken = async () => {
      try {
        console.log('[FCMTokenRegistration] Registering FCM token for user:', user.uid);
        const token = await saveFcmToken();
        if (token) {
          console.log('[FCMTokenRegistration] FCM token registration completed successfully');
          registrationAttempted.current = true;
          // Mark as registered in localStorage to persist across hot reloads
          localStorage.setItem(sessionKey, 'true');
        } else {
          console.warn('[FCMTokenRegistration] FCM token registration failed - check console for details');
        }
      } catch (error) {
        console.error('[FCMTokenRegistration] Error registering FCM token:', error);
        // Don't mark as attempted if there was an error, so we can retry
      }
    };

    // Register token when user logs in (only once per session)
    registerFCMToken();

    // Re-register token periodically but less frequently
    const interval = setInterval(() => {
      if (user) {
        // Clear the session flag to allow re-registration
        localStorage.removeItem(sessionKey);
        registrationAttempted.current = false;
        registerFCMToken();
      }
    }, 7 * 24 * 60 * 60 * 1000); // Every 7 days instead of 24 hours

    return () => {
      clearInterval(interval);
    };
  }, [user]);

  return null; // This component doesn't render anything
} 