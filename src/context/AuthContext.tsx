
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
import { checkUserProfileExists, getUserProfile } from '@/services/userService';
import type { UserProfile } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileExists: boolean | null; 
  currentUserProfile: UserProfile | null;
  isNewUserJustSignedUp: boolean;
  acknowledgeNewUserWelcome: () => void;
  refreshProfileStatus: () => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<User | null>;
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

  const refreshProfileData = useCallback(async (uid: string | null) => {
    const logPrefix = "[AuthContext refreshProfileData]";
    if (!uid) {
      // // console.warn(`${logPrefix} No UID provided.`);
      setProfileExists(false);
      setCurrentUserProfile(null);
      setLoading(false); // Ensure loading is false if no UID
      return { exists: false, profile: null };
    }
    // // console.log(`${logPrefix} Called for UID: ${uid}. Setting loading to true.`);
    setLoading(true); 
    try {
        const exists = await checkUserProfileExists(uid);
        setProfileExists(exists);
        // // console.log(`${logPrefix} Profile exists set to: ${exists} for UID: ${uid}`);
        if (exists) {
          const profileData = await getUserProfile(uid);
          setCurrentUserProfile(profileData);
          // // console.log(`${logPrefix} currentUserProfile set for UID: ${uid}. Name: ${profileData?.name}`);
          return { exists: true, profile: profileData };
        } else {
          setCurrentUserProfile(null);
          // // console.log(`${logPrefix} currentUserProfile set to null for UID: ${uid}.`);
          return { exists: false, profile: null };
        }
    } catch (error) {
        console.error(`${logPrefix} Error for UID ${uid}:`, error);
        setProfileExists(false); 
        setCurrentUserProfile(null);
        return { exists: false, profile: null };
    } finally {
        // // console.log(`${logPrefix} Finished for UID: ${uid}. Setting loading to false.`);
        setLoading(false);
    }
  }, [setProfileExists, setCurrentUserProfile, setLoading]); // setLoading is stable

  useEffect(() => {
    const logPrefix = "[AuthContext onAuthStateChanged Effect]";
    if (!auth) {
      // // console.warn(`${logPrefix} Firebase auth not initialized. Setting loading to false.`);
      setLoading(false);
      return () => {};
    }
    // // console.log(`${logPrefix} Setting up listener.`);
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const currentUid = fbUser?.uid || null;
      // // console.log(`[AuthContext onAuthStateChanged] Auth state changed. Current fbUser UID: ${currentUid}, Previous UID Ref: ${previousUserUidRef.current}`);
      
      // Don't set loading true here, refreshProfileData will handle it
      setUser(fbUser);

      if (fbUser) {
        // // console.log(`[AuthContext onAuthStateChanged] User is present. Refreshing profile data for UID: ${fbUser.uid}`);
        const { exists } = await refreshProfileData(fbUser.uid);
        
        if (exists === false && currentUid !== previousUserUidRef.current) {
          // // console.log(`[AuthContext onAuthStateChanged] New user (profile doesn't exist, UID changed), setting isNewUserJustSignedUp=true. UID: ${fbUser.uid}`);
          setIsNewUserJustSignedUp(true);
        } else if (exists === true && isNewUserJustSignedUp && currentUid === previousUserUidRef.current) {
          // This condition means profile was just created, and we are still in the "new user" phase.
          // Keep isNewUserJustSignedUp as true until acknowledged by onboarding page.
          // // console.log(`[AuthContext onAuthStateChanged] Profile just created for new user. isNewUserJustSignedUp remains true. UID: ${fbUser.uid}`);
        }
         else {
          // // console.log(`[AuthContext onAuthStateChanged] Not a new user signup event or profile exists and was previously known. isNewUserJustSignedUp=false. UID: ${fbUser?.uid}`);
          setIsNewUserJustSignedUp(false);
        }
        previousUserUidRef.current = currentUid;
      } else { 
        // // console.log("[AuthContext onAuthStateChanged] No Firebase user. Resetting states.");
        previousUserUidRef.current = null; 
        setProfileExists(null); 
        setCurrentUserProfile(null);
        setIsNewUserJustSignedUp(false);
        setLoading(false); // No user, so loading is definitely finished.
      }
      // setLoading(false) is handled by refreshProfileData or the else block above
    });
    return () => {
      // // console.log("[AuthContext onAuthStateChanged Effect] Cleaning up listener.");
      unsubscribe();
    };
  }, [refreshProfileData]); // refreshProfileData is stable

  const acknowledgeNewUserWelcome = useCallback(() => {
    // // console.log("[AuthContext] Welcome acknowledged, setting isNewUserJustSignedUp to false.");
    setIsNewUserJustSignedUp(false);
  }, []);

  const refreshProfileStatus = useCallback(async () => {
    if (!auth) {
      // // console.warn("[AuthContext refreshProfileStatus] Firebase auth not initialized.");
      return;
    }
    const currentAuthUser = auth.currentUser;
    // // console.log("[AuthContext refreshProfileStatus] Called. Current auth user UID:", currentAuthUser?.uid);
    if (currentAuthUser?.uid) {
      await refreshProfileData(currentAuthUser.uid);
    } else {
      // // console.log("[AuthContext refreshProfileStatus] No current auth user to refresh. Resetting profile states.");
      setProfileExists(null);
      setCurrentUserProfile(null);
      setIsNewUserJustSignedUp(false);
    }
  }, [auth, refreshProfileData]);

  // Routing logic
  useEffect(() => {
    const logPrefix = "[AuthContext Routing Effect]";
    const isAuthRoute = pathname === '/login' || pathname === '/signup';
    const isOnboardingRoute = pathname === '/onboarding';
    const isPublicPlanRoute = pathname.startsWith('/p/');
    const isPublicUserProfileRoute = pathname.startsWith('/u/'); // Using new public profile path

    // // console.log(`${logPrefix} Path: ${pathname}, Loading: ${loading}, User: ${user?.uid}, ProfileExists: ${profileExists}, IsNewUser: ${isNewUserJustSignedUp}`);

    if (loading) {
      // // console.log(`${logPrefix} Auth/profile state still loading, no redirection decisions yet.`);
      return;
    }

    if (!user) { // No user authenticated
      if (!isAuthRoute && pathname !== '/' && !isPublicPlanRoute && !isPublicUserProfileRoute) {
        // // console.log(`${logPrefix} No user, not on auth/landing/public. Redirecting to /login.`);
        router.push('/login');
      }
      return;
    }

    // User IS authenticated
    if (profileExists === null) { 
      // // console.log(`${logPrefix} User authenticated, profile existence check PENDING.`);
      // If they are on login/signup, they just authenticated, let AuthStateChanged effect handle profile check and subsequent routing.
      // If already on an app page, wait for profile check.
      if (isAuthRoute) { // Just logged in/signed up, but profile check not done.
        // // console.log(`${logPrefix} User authenticated, profile check PENDING, on auth route. Tentatively pushing to /feed to avoid being stuck on auth page.`);
        // This helps if refreshProfileData is slow for some reason after auth.
        // router.push('/feed'); // Let's remove this to avoid potential race conditions. onAuthStateChanged and subsequent profileExists update should handle it.
      }
      return;
    }

    if (profileExists === false) { // Profile does NOT exist
      if (!isOnboardingRoute) {
        // // console.log(`${logPrefix} User authenticated, profile DOES NOT exist, not on onboarding. Redirecting to /onboarding.`);
        router.push('/onboarding');
      }
      // Else, they are already on /onboarding (or the welcome dialog part), so they stay.
    } else { // profileExists === true
      if (isAuthRoute) {
        // Profile exists, but they are on /login or /signup. Redirect to feed.
        // // console.log(`${logPrefix} User authenticated, profile EXISTS, on auth route. Redirecting to /feed.`);
        router.push('/feed');
      } else if (isOnboardingRoute && !isNewUserJustSignedUp) {
        // Profile exists, on /onboarding, AND it's not the "new user welcome" phase.
        // This means they are either editing, or just finished onboarding and acknowledged the welcome.
        // The OnboardingPage itself is responsible for pushing to /feed after a successful save.
        // AuthContext should NOT redirect them away from /onboarding here if they are editing.
        // // console.log(`${logPrefix} User has profile, on /onboarding, not new user welcome. Allowing OnboardingPage to control navigation.`);
      }
      // In all other cases where profileExists is true and user is on an app page (not auth, not onboarding in new user phase), they stay.
    }
  }, [user, loading, profileExists, router, pathname, isNewUserJustSignedUp, acknowledgeNewUserWelcome]);


  const signOutFunc = async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set user to null, and the routing useEffect will redirect to /login.
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error: any) {
      console.error('[AuthContext] Error signing out: ', error);
      toast({ title: "Sign Out Error", description: error.message || "Could not sign out.", variant: "destructive" });
      throw error;
    }
  };

  const signUpWithEmailFunc = async (email: string, password: string, displayName: string): Promise<User | null> => {
    if (!auth) {
        console.error("Firebase Auth not initialized for signUpWithEmail.");
        throw new Error("Authentication service not available.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await firebaseUpdateProfile(userCredential.user, { displayName });
        // onAuthStateChanged will be triggered, leading to profile check and potential redirect to onboarding.
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
      // onAuthStateChanged will be triggered.
      return userCredential.user;
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
      // onAuthStateChanged will be triggered.
      return result.user;
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
        signOut: signOutFunc,
        signUpWithEmail: signUpWithEmailFunc,
        signInWithEmail: signInWithEmailFunc,
        signInWithGoogle: signInWithGoogleFunc,
        sendPasswordReset: sendPasswordResetEmailFunc
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

    