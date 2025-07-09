'use client';

import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, getFriendships, getPendingPlanSharesForUser, getPendingPlanInvitationsCount, getCompletedPlansForParticipant } from '@/services/clientServices';
// TEMP: checkUserProfileExists moved to server action to avoid server-only import
import type { UserProfile } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { setSessionCookie, clearSessionCookie } from '@/lib/sessionCookie';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileExists: boolean | null;
  currentUserProfile: UserProfile | null;
  isNewUserJustSignedUp: boolean;
  acknowledgeNewUserWelcome: () => void;
  refreshProfileStatus: () => Promise<void>;
  refreshProfileData: () => Promise<void>; // Wrapper, doesn't take UID
  signOut: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string, username?: string) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isNewUserJustSignedUp, setIsNewUserJustSignedUp] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const previousUserUidRef = useRef<string | null | undefined>(undefined);

  // refreshProfileDataInternal: Fetches and sets profile state. Does NOT manage global loading.
  const refreshProfileDataInternal = useCallback(async (uid: string | null) => {
    const logPrefix = "[AuthContext refreshProfileDataInternal]";
    if (!uid) {
      console.log(`${logPrefix} No UID, setting profile not exists.`);
      setProfileExists(false);
      setCurrentUserProfile(null);
      return { exists: false, profile: null, error: false };
    }
    console.log(`${logPrefix} Fetching profile for UID: ${uid}`);
    try {
        // Check if profile exists by trying to get it
        const profileData = await getUserProfile(uid);
        // Profile exists if we got data back AND has at least some basic fields
        // This should be a minimal check that will pass once onboarding is completed
        const exists = !!profileData && 
            // Just check for basic identification fields and that profile was created
            !!profileData.uid && 
            !!profileData.email &&
            !!profileData.createdAt;
        console.log(`${logPrefix} Profile exists: ${exists} for UID: ${uid}. Profile data fetched: ${!!profileData}`);
        // These setters will trigger re-renders if values change.
        setProfileExists(exists);
        setCurrentUserProfile(profileData);
        return { exists, profile: profileData, error: false };
    } catch (error) {
        console.error(`${logPrefix} Error fetching profile for UID ${uid}:`, error);
        // On error, we return exists:false. The caller (onAuthStateChanged) will decide how to setProfileExists.
        return { exists: false, profile: null, error: true };
    }
  }, [setProfileExists, setCurrentUserProfile]); // Stable setters

  // Main auth state and profile loading effect
  useEffect(() => {
    const logPrefix = "[AuthContext onAuthStateChanged Effect]";
    if (!auth) {
      console.warn(`${logPrefix} Firebase auth not initialized. Setting loading to false.`);
      setLoading(false);
      return () => {};
    }
    console.log(`${logPrefix} Setting up listener. Initializing loading to true.`);
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const currentUid = fbUser?.uid || null;
      console.log(`${logPrefix} Auth state changed. Current fbUser UID: ${currentUid}`);
      setUser(fbUser); // Update user state first

      if (fbUser) {
        const profileCheckResult = await refreshProfileDataInternal(fbUser.uid);

        // Handle setting profileExists more robustly to avoid flapping
        if (profileCheckResult.error) {
          // If there was an error fetching profile, and we previously knew a profile existed,
          // maintain profileExists as true to prevent incorrect redirection to onboarding.
          // UI should indicate data might be stale or there's an issue.
          setProfileExists(prev => (prev === true ? true : false));
          // We might keep the old currentUserProfile or set it to null to indicate staleness
          // setCurrentUserProfile(prevProfile => (profileExists === true ? prevProfile : null));
          console.warn(`${logPrefix} Error fetching profile for ${fbUser.uid}. Kept profileExists state if previously true.`);
        } else {
          // No error, set profileExists based on the actual check.
          setProfileExists(profileCheckResult.exists);
          setCurrentUserProfile(profileCheckResult.profile); // Also update profile data
        }

        // Handle new user state for onboarding trigger
        if (profileCheckResult.exists === false && currentUid !== previousUserUidRef.current && !profileCheckResult.error) {
          console.log(`${logPrefix} New user or profile definitively not found. UID: ${fbUser.uid}. Setting isNewUserJustSignedUp=true.`);
          setIsNewUserJustSignedUp(true);
        } else {
          setIsNewUserJustSignedUp(false);
        }
        previousUserUidRef.current = currentUid;
      } else {
        // No user, reset all related states
        console.log(`${logPrefix} No Firebase user. Resetting states.`);
        previousUserUidRef.current = null;
        setProfileExists(null); // Use null to indicate unknown/not applicable for logged out state
        setCurrentUserProfile(null);
        setIsNewUserJustSignedUp(false);
      }
      console.log(`${logPrefix} Setting loading to false after auth and profile checks for UID: ${currentUid}.`);
      setLoading(false); // Loading is complete for this auth state change
    });

    return () => {
      console.log(`${logPrefix} Cleaning up listener.`);
      unsubscribe();
    };
  }, [auth, refreshProfileDataInternal, profileExists]); // Added profileExists: if it changes outside this effect, we might need to re-evaluate

  // Token refresh interval
  useEffect(() => {
    if (!auth) return () => {};
    const refreshTokenInterval = setInterval(async () => {
      if (!auth) return;
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          console.log('[AuthContext TokenRefresh] Refreshing token and session cookie');
          await currentUser.getIdToken(true); // Force refresh client-side token
          await setSessionCookie(currentUser); // Update server-side session cookie
          console.log('[AuthContext TokenRefresh] Token refreshed and session cookie updated');
        } catch (error) {
          console.error('[AuthContext TokenRefresh] Error refreshing token:', error);
          // Optionally handle sign-out if token refresh persistently fails
        }
      }
    }, 30 * 60 * 1000); // Refresh every 30 minutes

    return () => clearInterval(refreshTokenInterval);
  }, [auth]);


  const acknowledgeNewUserWelcome = useCallback(() => {
    console.log("[AuthContext] Welcome acknowledged, setting isNewUserJustSignedUp to false.");
    setIsNewUserJustSignedUp(false);
  }, []);

  const refreshProfileStatus = useCallback(async () => {
    if (!auth) {
      console.warn("[AuthContext refreshProfileStatus] Firebase auth not initialized.");
      return;
    }
    const currentAuthUser = auth.currentUser;
    console.log("[AuthContext refreshProfileStatus] Called. Current auth user UID:", currentAuthUser?.uid);
    if (currentAuthUser?.uid) {
      setLoading(true); // Indicate loading during refresh
      await refreshProfileDataInternal(currentAuthUser.uid);
      setLoading(false); // Done loading
    } else {
      setProfileExists(null);
      setCurrentUserProfile(null);
      setIsNewUserJustSignedUp(false);
    }
  }, [auth, refreshProfileDataInternal]);

  const refreshProfileDataWrapper = useCallback(async (): Promise<void> => {
    await refreshProfileStatus();
  }, [refreshProfileStatus]);


  const signOutFunc = async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      await clearSessionCookie();
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // Router push to /login will be handled by the main routing effect in AppLayout
    } catch (error: any) {
      console.error('[AuthContext] Error signing out: ', error);
      toast({ title: "Sign Out Error", description: error.message || "Could not sign out.", variant: "destructive" });
    }
  };

  const signUpWithEmailFunc = async (email: string, password: string, displayName: string, username?: string): Promise<User | null> => {
    if (!auth) {
        console.error("Firebase Auth not initialized for signUpWithEmail.");
        throw new Error("Authentication service not available.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await firebaseUpdateProfile(userCredential.user, { displayName });
        // Username handling will occur during onboarding now.
        // Forcing token refresh before setting session cookie
        await userCredential.user.getIdToken(true);
        await setSessionCookie(userCredential.user);
        // isNewUserJustSignedUp will be set by onAuthStateChanged
        return userCredential.user;
      }
      return null;
    } catch (error: any) {
      console.error("[AuthContext] Error signing up with email:", error);
      throw error;
    }
  };

  const signInWithEmailFunc = async (email: string, password: string): Promise<User | null> => {
    if (!auth) {
        console.error("Firebase Auth not initialized for signInWithEmail.");
        throw new Error("Authentication service not available.");
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        // Forcing token refresh before setting session cookie
        await userCredential.user.getIdToken(true);
        await setSessionCookie(userCredential.user);
        return userCredential.user;
      }
      return null;
    } catch (error: any) {
      console.error("[AuthContext] Error signing in with email:", error);
      throw error;
    }
  };

  const signInWithGoogleFunc = async (): Promise<User | null> => {
    if (!auth || !googleProvider) {
        console.error("Firebase Auth or Google Provider not initialized for signInWithGoogle.");
        throw new Error("Google Sign-In service not available.");
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Forcing token refresh before setting session cookie
        await result.user.getIdToken(true);
        await setSessionCookie(result.user);
        // isNewUserJustSignedUp will be set by onAuthStateChanged
        return result.user;
      }
      return null;
    } catch (error: any) {
      console.error("[AuthContext] Error signing in with Google:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
            title: 'Google Sign-In Cancelled',
            description: 'The Google Sign-In popup was closed. Please ensure popups are allowed and try again. Also check your Google Cloud Console for correct "Authorized JavaScript origins".',
            variant: 'default',
            duration: 7000,
        });
      } else if (error.code === 'auth/unauthorized-domain') {
         toast({
            title: 'Google Sign-In Error',
            description: 'This website domain is not authorized for Google Sign-In. Please check Firebase and Google Cloud Console settings.',
            variant: 'destructive',
            duration: 7000,
        });
      } else {
        toast({
            title: 'Google Sign-In Failed',
            description: error.message || 'An unexpected error occurred with Google Sign-In.',
            variant: 'destructive',
        });
      }
      throw error;
    }
  };

  const sendPasswordResetEmailFunc = async (email: string): Promise<void> => {
    if (!auth) {
        console.error("Firebase Auth not initialized for sendPasswordResetEmail.");
        throw new Error("Authentication service not available.");
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("[AuthContext] Error sending password reset email:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profileExists,
      currentUserProfile,
      isNewUserJustSignedUp,
      acknowledgeNewUserWelcome,
      refreshProfileStatus,
      refreshProfileData: refreshProfileDataWrapper,
      signOut: signOutFunc,
      signUpWithEmail: signUpWithEmailFunc,
      signInWithEmail: signInWithEmailFunc,
      signInWithGoogle: signInWithGoogleFunc,
      sendPasswordReset: sendPasswordResetEmailFunc,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
