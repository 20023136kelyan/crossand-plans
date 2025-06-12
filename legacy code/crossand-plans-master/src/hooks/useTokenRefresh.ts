import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { setSessionCookie } from '@/lib/sessionCookie';

export const useTokenRefresh = () => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      try {
        // Force refresh the token
        const idToken = await user.getIdToken(true);
        
        // Update the session cookie with the new token
        await setSessionCookie(user);
        
        console.log('[useTokenRefresh] Token refreshed and session cookie updated');
      } catch (error) {
        console.error('[useTokenRefresh] Error refreshing token:', error);
        router.push('/login');
      }
    };

    // Refresh token every 30 minutes
    // Firebase tokens expire after 1 hour, so we refresh before that
    const intervalId = setInterval(refreshToken, 30 * 60 * 1000);

    // Initial refresh when the component mounts
    refreshToken();

    return () => clearInterval(intervalId);
  }, [user, router]);
};
