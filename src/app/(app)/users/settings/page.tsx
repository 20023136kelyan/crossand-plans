'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { SubscriptionManager } from '@/components/plans/SubscriptionManager';
import { ActivityScoreCard } from '@/components/plans/ActivityScoreCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/types/subscription';
import type { UserProfile } from '@/types/user';

// Import Firebase
import { db, auth, serverTimestamp } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { createListenerWithRetry, getDocumentFallback, getCollectionFallback } from '@/lib/firebaseListenerUtils';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';

import {
  User, Edit3, LogOut, Settings, ShieldCheck as AdminIcon, CheckCircle, ChevronLeft,
  Smartphone, CalendarDays, HomeIcon as PhysicalAddressIcon, ListChecks, Palette, 
  Sparkles as GamificationIcon, Wallet, MessagesSquare as SocialInteractionIcon, 
  Heart, Activity, AlertTriangle, ChefHat, UsersRound, MapPin as TravelToleranceIcon, 
  Gift, Loader2, CreditCard, Bell, Lock, Eye, EyeOff, Globe, Mail, Zap, 
  Trash2, HelpCircle, FileText, Shield, Star, Sun, Moon
} from 'lucide-react';

interface UserData {
  subscription: Subscription | null;
  userStats: any;
  userProfile: UserProfile | null;
  activityScore: number;
}

const VerificationBadge = ({ role, isVerified }: { role: string | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | null | React.ReactNode;
  isList?: boolean;
  className?: string;
}

const DetailItem = ({ icon: Icon, label, value, isList, className }: DetailItemProps) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
    return null; 
  }
  return (
    <div className={cn("flex items-start py-1.5", className)}>
      <Icon className="h-4 w-4 text-primary/80 mr-3 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {isList && Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {value.map((item, index) => (
              <Badge key={index} variant="outline" className="text-xs py-0 px-1.5 rounded-sm bg-secondary/30">
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  );
};

export default function SettingsPage() {
  const { user, loading: authLoading, signOut, currentUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['account', 'profile', 'preferences', 'planning', 'engagement', 'subscription', 'notifications', 'security', 'privacy'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Load privacy settings
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user) return;
      
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/users/privacy', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setPrivacySettings({
            plansVisibility: data.privacySettings?.plansVisibility || 'public',
            followersVisibility: data.privacySettings?.followersVisibility || 'public',
            followingVisibility: data.privacySettings?.followingVisibility || 'public'
          });
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      }
    };
    
    loadPrivacySettings();
  }, [user]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    planReminders: true,
    marketing: false
  });
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    birthdate: '',
    address: '',
    bio: ''
  });
  
  // Security form state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // State for email verification
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  
  // Loading states for buttons
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isTogglingAutoRenew, setIsTogglingAutoRenew] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    plansVisibility: 'public',
    followersVisibility: 'public',
    followingVisibility: 'public'
  });
  // Add state for isPrivate
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [isSavingPrivacySetting, setIsSavingPrivacySetting] = useState(false);
  // Add state for pending follow requests
  const [pendingFollowRequests, setPendingFollowRequests] = useState<string[]>([]);
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(false);

  // Load isPrivate from user profile
  useEffect(() => {
    if (currentUserProfile && typeof currentUserProfile.isPrivate === 'boolean') {
      setIsPrivate(currentUserProfile.isPrivate);
    }
  }, [currentUserProfile]);

  // Function to calculate activity score
  const calculateActivityScore = useCallback((stats: any, profile: any) => {
    if (!stats || !profile) return 0;
    
    // Simple calculation based on user activity
    const baseScore = (
      (stats.plansCreatedCount || 0) * 5 +
      (stats.plansSharedOrExperiencedCount || 0) * 3 +
      (stats.postCount || 0) * 2 +
      (stats.followersCount || 0) +
      (profile.eventAttendanceScore || 0) * 2
    );
    
    return Math.min(100, Math.round(baseScore));
  }, []);

  // Memoize profile form update function to prevent unnecessary re-renders
  const updateProfileForm = useCallback((profileData: UserProfile) => {
    setProfileForm({
      name: profileData.name || '',
      phone: profileData.countryDialCode && profileData.phoneNumber
        ? `${profileData.countryDialCode} ${profileData.phoneNumber}`
        : profileData.phoneNumber || '',
      birthdate: profileData.birthDate && isValid(profileData.birthDate as Date) 
        ? format(profileData.birthDate as Date, 'yyyy-MM-dd') 
        : '',
      address: profileData.physicalAddress 
        ? [
            profileData.physicalAddress.street,
            profileData.physicalAddress.city,
            profileData.physicalAddress.state,
            profileData.physicalAddress.zipCode,
            profileData.physicalAddress.country,
          ].filter(Boolean).join(', ').trim() || ''
        : '',
      bio: profileData.bio || ''
    });
  }, []);

  // Set up optimized Firestore listeners for real-time updates
  const setupFirestoreListeners = useCallback(() => {
    if (!db || !user) return () => {};
    
    const unsubscribers: Array<() => void> = [];
    
    // Listen for user profile changes using shared service
    const userProfileRef = doc(db, 'users', user.uid);
    const profileListener = createListenerWithRetry(
      () => onSnapshot(userProfileRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const profileData = docSnapshot.data() as UserProfile;
          
          // Update the local state with the new profile data
          setUserData(prevData => {
            if (!prevData) return prevData;
            return {
              ...prevData,
              userProfile: profileData
            };
          });
          
          // Update form data using memoized function
          updateProfileForm(profileData);
        }
      }),
      (profileData: UserProfile) => {
        setUserData(prevData => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            userProfile: profileData
          };
        });
        updateProfileForm(profileData);
      },
      (error) => {
        console.error('Error listening to profile changes:', error);
      },
      async () => {
        const doc = await getDocumentFallback(`users/${user.uid}`);
        return doc as UserProfile;
      }
    );
    unsubscribers.push(profileListener.unsubscribe);
    
    // Listen for subscription changes using shared service
    const subscriptionsQuery = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid),
      where('status', '==', 'active'),
      limit(1)
    );
    
    const subscriptionListener = createListenerWithRetry(
      () => onSnapshot(subscriptionsQuery, (querySnapshot) => {
        const subscriptionData = !querySnapshot.empty 
          ? querySnapshot.docs[0].data() as Subscription 
          : null;
        
        setUserData(prevData => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            subscription: subscriptionData
          };
        });
      }),
      (subscriptionData: Subscription | null) => {
        setUserData(prevData => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            subscription: subscriptionData
          };
        });
      },
      (error) => {
        console.error('Error listening to subscription changes:', error);
      },
      async () => {
        const docs = await getCollectionFallback('subscriptions', [
          where('userId', '==', user.uid),
          where('status', '==', 'active'),
          limit(1)
        ]);
        return docs.length > 0 ? docs[0] as Subscription : null;
      }
    );
    unsubscribers.push(subscriptionListener.unsubscribe);
    
    // Listen for user stats changes using shared service
    const userStatsRef = doc(db, 'userStats', user.uid);
    const userStatsListener = createListenerWithRetry(
      () => onSnapshot(userStatsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const statsData = docSnapshot.data();
          
          setUserData(prevData => {
            if (!prevData) return prevData;
            const newActivityScore = calculateActivityScore(statsData, prevData.userProfile);
            return {
              ...prevData,
              userStats: statsData,
              activityScore: newActivityScore
            };
          });
        }
      }),
      (statsData: any) => {
        setUserData(prevData => {
          if (!prevData) return prevData;
          const newActivityScore = calculateActivityScore(statsData, prevData.userProfile);
          return {
            ...prevData,
            userStats: statsData,
            activityScore: newActivityScore
          };
        });
      },
      (error) => {
        console.error('Error listening to user stats changes:', error);
      },
      async () => {
        const doc = await getDocumentFallback(`userStats/${user.uid}`);
        return doc;
      }
    );
    unsubscribers.push(userStatsListener.unsubscribe);
    
    // Listen for notification preferences using shared service
    const notificationPrefsRef = doc(db, 'userNotificationPreferences', user.uid);
    const notificationPrefsListener = createListenerWithRetry(
      () => onSnapshot(notificationPrefsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const prefsData = docSnapshot.data();
          
          setNotifications({
            email: prefsData.emailNotifications ?? true,
            push: prefsData.pushNotifications ?? true,
            planReminders: prefsData.planReminders ?? true,
            marketing: prefsData.marketingEmails ?? false
          });
        }
      }),
      (prefsData: any) => {
        setNotifications({
          email: prefsData.emailNotifications ?? true,
          push: prefsData.pushNotifications ?? true,
          planReminders: prefsData.planReminders ?? true,
          marketing: prefsData.marketingEmails ?? false
        });
      },
      (error) => {
        console.error('Error listening to notification preferences changes:', error);
      },
      async () => {
        const doc = await getDocumentFallback(`userNotificationPreferences/${user.uid}`);
        return doc;
      }
    );
    unsubscribers.push(notificationPrefsListener.unsubscribe);
    
    // Return cleanup function that unsubscribes from all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [db, user, updateProfileForm, calculateActivityScore]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);



  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        // First, ensure default collections exist
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/users/create-missing-collections', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
        } catch (error) {
          console.warn('Could not create missing collections:', error);
          // Continue anyway - this is not critical
        }
        
        // Try to fetch from the API first for initial data
        const response = await fetch('/api/subscriptions/user-data');
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          console.warn('Subscription API not available, using fallback data');
          // Use fallback data if API is not available
          setUserData({
            subscription: null,
            userStats: {
              plansCreatedCount: 0,
              plansSharedOrExperiencedCount: 0
            },
            userProfile: currentUserProfile,
            activityScore: 0
          });
        }
      } catch (error) {
        console.error('Error in fetchUserData:', error);
        toast({
          title: 'Notice',
          description: 'Some features may be limited',
          variant: 'default'
        });
      } finally {
        setIsLoading(false);
      }
    };

    let unsubscribeListeners: (() => void) | undefined;
    
    if (user) {
      // Fetch initial data from API
      fetchUserData();
      
      // Set up real-time listeners
      unsubscribeListeners = setupFirestoreListeners();
    }
    
    // Cleanup function
    return () => {
      if (unsubscribeListeners) {
        unsubscribeListeners();
      }
    };
    
    if (!user) {
      setIsLoading(false);
    }
  }, [user, toast, currentUserProfile, setupFirestoreListeners]);
  
  // Handle profile form changes
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Handle security form changes
  const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const fieldName = id === 'current-password' ? 'currentPassword' : 
                     id === 'new-password' ? 'newPassword' : 'confirmPassword';
    setSecurityForm(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSavingProfile(true);
    try {
      // Get a reference to the user's profile document in Firestore
      if (!db) throw new Error('Database not initialized');
      const userProfileRef = doc(db, 'userProfiles', user.uid);
      
      // Parse the form data
      let addressComponents = {};
      if (profileForm.address) {
        const addressParts = profileForm.address.split(',').map(part => part.trim());
        if (addressParts.length >= 1) {
      }
    }
    
    // Parse birthdate
    let birthDate = null;
    if (profileForm.birthdate) {
      const parsedDate = new Date(profileForm.birthdate);
      if (isValid(parsedDate)) {
        birthDate = parsedDate;
      }
    }
    
    // Parse phone number components
    let phoneNumber = '';
    let countryDialCode = '';
    if (profileForm.phone) {
      // Simple parsing - in production, use a proper phone number library
      const phoneMatch = profileForm.phone.match(/^(\+\d{1,3})\s*(.+)$/);
      if (phoneMatch) {
        countryDialCode = phoneMatch[1];
        phoneNumber = phoneMatch[2];
      } else {
        phoneNumber = profileForm.phone;
      }
    }

    // Parse address with improved validation
    let physicalAddress = null;
    if (profileForm.address && profileForm.address.trim()) {
      const addressParts = profileForm.address.split(',').map(part => part.trim()).filter(part => part.length > 0);
      
      // More robust address parsing with validation
      physicalAddress = {
        street: addressParts[0] || '',
        city: addressParts[1] || '',
        state: addressParts[2] || '',
        zipCode: addressParts[3] || '',
        country: addressParts[4] || 'United States' // Default country
      };
      
      // Validate that we have at least street and city
      if (!physicalAddress.street || !physicalAddress.city) {
        throw new Error('Please provide at least street address and city in the format: Street, City, State, ZIP, Country');
      }
    }
    
    // Update profile in Firestore
    if (db) {
      const profileRef = doc(db, 'users', user.uid);
      
      await updateDoc(profileRef, {
        name: profileForm.name,
        phoneNumber,
        countryDialCode,
        birthDate,
        physicalAddress,
        bio: profileForm.bio,
        updatedAt: serverTimestamp()
      });
    } else {
      throw new Error('Firestore not initialized');
    }
    
    // No need to manually refresh profile status since we have real-time listeners
    
    toast({
      title: 'Profile Updated',
      description: 'Your profile has been successfully updated.',
      variant: 'default'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    toast({
      title: 'Error',
      description: 'Failed to update profile. Please try again.',
      variant: 'destructive'
    });
  } finally {
    setIsSavingProfile(false);
  }
};
  
// Save notification preferences
const handleSaveNotifications = async () => {
  if (!user) return;
  
  try {
    setIsSavingNotifications(true);
    
    // Update notification preferences in Firestore
    if (db) {
      const notificationsRef = doc(db, 'userNotificationPreferences', user.uid);
      
      await setDoc(notificationsRef, {
        emailNotifications: notifications.email,
        pushNotifications: notifications.push,
        planReminders: notifications.planReminders,
        marketingEmails: notifications.marketing,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved.',
        variant: 'default'
      });
    } else {
      throw new Error('Firestore not initialized');
    }
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    toast({
      title: 'Error',
      description: 'Failed to update notification preferences. Please try again.',
      variant: 'destructive'
    });
  } finally {
    setIsSavingNotifications(false);
  }
  };
  
  // Check if user is using a password-based account or a third-party provider
  const isPasswordBasedAccount = useCallback(() => {
    if (!user) return false;
    
    // Check if the user has a password provider
    const providerData = user.providerData || [];
    return providerData.some(provider => provider.providerId === 'password');
  }, [user]);

  // Update password
  const handleUpdatePassword = async () => {
    if (!user || !auth) return;
    
    // If user doesn't have a password-based account, they can't update password directly
    if (!isPasswordBasedAccount()) {
      toast({
        title: "Not Available",
        description: "Password update is not available for accounts using Google or other third-party sign-in methods.",
        variant: "destructive"
      });
      return;
    }
    
    if (!securityForm.currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password.",
        variant: "destructive"
      });
      return;
    }
    
    if (!securityForm.newPassword) {
      toast({
        title: "Error",
        description: "Please enter a new password.",
        variant: "destructive"
      });
      return;
    }
    
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive"
      });
      return;
    }
    
    if (securityForm.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsUpdatingPassword(true);
      
      // Re-authenticate the user before changing password
      if (!user.email) {
        throw new Error('User email not found');
      }
      
      const credential = EmailAuthProvider.credential(
        user.email,
        securityForm.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Update the password
      await updatePassword(user, securityForm.newPassword);
      
      // Reset the form
      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully changed.',
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      let errorMessage = 'Failed to update password. Please try again.';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect current password. Please try again.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'For security reasons, please log out and log back in before changing your password.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  // Enable 2FA
  const handleEnable2FA = async () => {
    if (!user || !auth) return;
    
    setIsEnabling2FA(true);
    try {
      // Call the API to enable 2FA
      const response = await fetch('/api/auth/enable-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to enable 2FA');
      }
      
      // In a real app, you would handle the setup process:
      // 1. Show QR code for the user to scan with their authenticator app
      // 2. Ask for a verification code to confirm setup
      // 3. Provide backup codes for the user to save
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled for your account. For additional security, you will now be asked for a verification code when signing in.",
        variant: "default",
        duration: 5000
      });
      
      // In a real implementation, you would call an API endpoint to initiate the 2FA setup
      // await fetch('/api/auth/enable-2fa', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      // });
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      toast({
        title: "Error",
        description: "Failed to initiate 2FA setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };
  
  // Sign out from all devices
  const handleSignOutAllDevices = async () => {
    if (!user) return;
    
    setIsSigningOutAll(true);
    try {
      // This requires Firebase Admin SDK to revoke all refresh tokens
      // We'll call an API endpoint to handle this server-side
      const response = await fetch('/api/auth/revoke-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }
      
      toast({
        title: "Success",
        description: "You have been signed out from all devices.",
        variant: "default"
      });
      
      // Sign out from current device
      await signOut();
    } catch (error) {
      console.error('Error signing out from all devices:', error);
      toast({
        title: "Error",
        description: "Failed to sign out from all devices. Please try again.",
        variant: "destructive"
      });
      setIsSigningOutAll(false);
    }
  };
  
  // Delete account
  const handleDeleteAccount = async () => {
    if (!user || !auth) return;
    
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    setIsDeletingAccount(true);
    try {
      // For third-party authentication providers, we need to reauthenticate before deleting
      if (!isPasswordBasedAccount()) {
        // For third-party providers, we need to inform the user to reauthenticate
        toast({
          title: "Reauthentication Required",
          description: "For security reasons, please sign out and sign back in before deleting your account.",
          variant: "default",
          duration: 5000
        });
        
        // Sign out the user - they'll need to sign back in to delete their account
        await signOut();
        router.push('/login?action=delete-account');
        return;
      }
      
      // For password-based accounts, proceed with deletion
      // Call the API to delete the account
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete account');
      }
      
      toast({
        title: "Account Deleted",
        description: "Your account has been deleted successfully.",
        variant: "default"
      });
      
      // Sign out and redirect to home page
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive"
      });
      setIsDeletingAccount(false);
    }
  };
  
  // Update payment method
  const handleUpdatePayment = async () => {
    if (!user) return;
    
    setIsUpdatingPayment(true);
    try {
      // In a real implementation, this would typically involve:
      // 1. Redirecting to a payment processor (Stripe, PayPal, etc.)
      // 2. Processing the payment update
      // 3. Updating the subscription record in Firestore
      
      // Create payment update session
      const response = await fetch('/api/payments/update-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          returnUrl: window.location.href
        })
      });

      if (response.ok) {
        const { updateUrl } = await response.json();
        
        toast({
          title: "Redirecting",
          description: "You will be redirected to update your payment method.",
          variant: "default"
        });
        
        // Redirect to payment processor
        window.location.href = updateUrl;
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to initiate payment update.",
          variant: "destructive"
        });
       }
    } catch (error) {
      console.error('Error updating payment method:', error);
      toast({
        title: "Error",
        description: "Failed to update payment method. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingPayment(false);
    }
  };
  
  // Toggle auto-renew subscription
  const handleToggleAutoRenew = async (checked: boolean) => {
    if (!user || !userData?.subscription) return;
    
    setIsTogglingAutoRenew(true);
    try {
      // Update the subscription in Firestore
      if (!db) throw new Error('Database not initialized');
      const subscriptionRef = doc(db, 'subscriptions', userData.subscription.id);
      
      await updateDoc(subscriptionRef, {
        autoRenew: checked,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setUserData(prev => {
        if (!prev?.subscription) return prev;
        return {
          ...prev,
          subscription: {
            ...prev.subscription,
            autoRenew: checked
          }
        };
      });
      
      toast({
        title: checked ? "Auto-Renew Enabled" : "Auto-Renew Disabled",
        description: checked 
          ? "Your subscription will automatically renew." 
          : "Your subscription will not automatically renew.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error toggling auto-renew:', error);
      toast({
        title: "Error",
        description: "Failed to update auto-renew setting. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTogglingAutoRenew(false);
    }
  };

  // Handle email verification
  const handleVerifyEmail = async () => {
    if (!user || !auth) return;
    
    try {
      setIsVerifyingEmail(true);
      await sendEmailVerification(user);
      
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox and follow the link to verify your email address.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send verification email. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    // Toast and router.push('/login') will be handled by AuthContext
  };

  // Handle privacy settings save
  const handleSavePrivacySettings = async () => {
    if (!user) return;
    
    try {
      setIsSavingPrivacy(true);
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/users/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ privacySettings })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save privacy settings');
      }
      
      toast({
        title: 'Privacy Settings Updated',
        description: 'Your privacy preferences have been saved successfully.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save privacy settings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // Handler to update privacy
  const handlePrivacyToggle = async (checked: boolean) => {
    if (!user) {
      toast({ title: 'Error', description: 'User not authenticated.' });
      return;
    }
    setIsSavingPrivacySetting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/users/update-privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ isPrivate: checked })
      });
      if (response.ok) {
        setIsPrivate(checked);
        toast({ title: 'Privacy updated', description: checked ? 'Your account is now private.' : 'Your account is now public.' });
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to update privacy.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update privacy.' });
    } finally {
      setIsSavingPrivacySetting(false);
    }
  };

  // Load pending follow requests if private
  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!user || !isPrivate) return;
      setIsLoadingPendingRequests(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/users/pending-follow-requests', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPendingFollowRequests(data.pendingFollowRequests || []);
        }
      } catch (error) {
        // Optionally show error
      } finally {
        setIsLoadingPendingRequests(false);
      }
    };
    fetchPendingRequests();
  }, [user, isPrivate]);

  // Approve/Deny handlers
  const handleApproveRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/approve-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((id) => id !== requesterId));
  };
  const handleDenyRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/deny-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((id) => id !== requesterId));
  };

  if (authLoading || (!currentUserProfile && user)) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !currentUserProfile) { 
    return null; 
  }

  const userInitial = currentUserProfile.name 
    ? currentUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() 
    : (currentUserProfile.email ? currentUserProfile.email[0].toUpperCase() : 'U');
  
  const formattedPhoneNumber = currentUserProfile.countryDialCode && currentUserProfile.phoneNumber
    ? `${currentUserProfile.countryDialCode} ${currentUserProfile.phoneNumber}`
    : currentUserProfile.phoneNumber;

  const addressString = currentUserProfile.physicalAddress 
    ? [
        currentUserProfile.physicalAddress.street,
        currentUserProfile.physicalAddress.city,
        currentUserProfile.physicalAddress.state,
        currentUserProfile.physicalAddress.zipCode,
        currentUserProfile.physicalAddress.country,
      ].filter(Boolean).join(', ').trim() || null
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => activeTab ? setActiveTab(null) : router.push(`/users/${user.uid}`)} 
          className="hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">
          {activeTab ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : 'Settings'}
        </h1>
        <div className="w-9 h-9"></div>
      </div>

      {/* Profile Header - Only show when no tab is active */}
      {!activeTab && (
        <div className="flex flex-col items-center px-6 py-8">
          <div className="relative mb-4">
            <Avatar className="h-24 w-24 border-4 border-border">
              {currentUserProfile.avatarUrl && (
                <AvatarImage 
                  src={currentUserProfile.avatarUrl} 
                  alt={currentUserProfile.name || 'User Avatar'} 
                  data-ai-hint="person portrait"
                />
              )}
              <AvatarFallback className="text-2xl bg-muted">{userInitial}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-1">
              <h2 className="text-xl font-bold">{currentUserProfile.name || 'Macaroom User'}</h2>
              <VerificationBadge role={currentUserProfile.role} isVerified={currentUserProfile.isVerified} />
            </div>
            <p className="text-muted-foreground text-sm">{currentUserProfile.email}</p>
          </div>
        </div>
      )}

      {/* Conditional Content Rendering */}
      {!activeTab && (
        <div className="px-6 space-y-6">
          {/* Account & Profile Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Account & Profile</h3>
            <div className="space-y-2">
              <div 
                onClick={() => setActiveTab('account')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <span className="font-medium">Account</span>
                    <p className="text-xs text-muted-foreground">Email, username, language</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
              
              <div 
                onClick={() => setActiveTab('profile')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Edit3 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <span className="font-medium">Profile</span>
                    <p className="text-xs text-muted-foreground">Name, bio, contact info</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Planning & Preferences Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Planning & Preferences</h3>
            <div className="space-y-2">
              <div 
                onClick={() => setActiveTab('preferences')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-pink-500/20 rounded-lg">
                    <Heart className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <span className="font-medium">Preferences</span>
                    <p className="text-xs text-muted-foreground">Interests, activity types</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
              
              <div 
                onClick={() => setActiveTab('planning')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Palette className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <span className="font-medium">Planning Style</span>
                    <p className="text-xs text-muted-foreground">Theme, preferences, and planning experience</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Social & Engagement Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Social & Engagement</h3>
            <div className="space-y-2">
              <div 
                onClick={() => setActiveTab('engagement')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Star className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="font-medium">Engagement</span>
                    <p className="text-xs text-muted-foreground">Activity score, achievements</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
              
              <div 
                onClick={() => setActiveTab('privacy')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Shield className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="font-medium">Privacy</span>
                    <p className="text-xs text-muted-foreground">Control who sees your content</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Subscription & Notifications Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Subscription & Notifications</h3>
            <div className="space-y-2">
              <div 
                onClick={() => setActiveTab('subscription')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Zap className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <span className="font-medium">Subscription</span>
                    <p className="text-xs text-muted-foreground">Manage your plan and billing</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
              
              <div 
                onClick={() => setActiveTab('notifications')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Bell className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="font-medium">Notifications</span>
                    <p className="text-xs text-muted-foreground">Email, push, and plan reminders</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">Security</h3>
            <div className="space-y-2">
              <div 
                onClick={() => setActiveTab('security')}
                className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Lock className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <span className="font-medium">Security</span>
                    <p className="text-xs text-muted-foreground">Password, 2FA, account safety</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tab Content Area */}
      <div className="w-full flex-1 overflow-y-auto pb-20 pt-6">
        {activeTab === 'account' && (
          <div className="px-6 space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4">Account Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                <Input 
                  id="email" 
                  value={currentUserProfile.email || ''} 
                  readOnly 
                  className="bg-muted border-border" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-muted-foreground">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={profileForm.phone} 
                  onChange={handleProfileChange} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate" className="text-muted-foreground">Birth Date</Label>
                <Input 
                  id="birthdate" 
                  type="date" 
                  value={profileForm.birthdate}
                  onChange={handleProfileChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-muted-foreground">Address</Label>
                <Input 
                  id="address" 
                  value={profileForm.address} 
                  onChange={handleProfileChange} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Language</Label>
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg border border-border">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>English (US)</span>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSavingProfile}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/20">
            <h3 className="text-lg font-semibold mb-2 text-red-400">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all of your content.
            </p>
            <Button 
              variant="destructive" 
              size="sm" 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </div>
        </div>
        )}

        {activeTab === 'profile' && (
          <div className="px-6 space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-muted-foreground">Full Name</Label>
                  <Input 
                    id="name" 
                    value={profileForm.name} 
                    onChange={handleProfileChange} 
                  />
                  <p className="text-xs text-muted-foreground">This will be displayed on your profile</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-muted-foreground">Username</Label>
                  <Input 
                    id="username" 
                    value={currentUserProfile.username || ''} 
                    readOnly 
                    className="bg-muted" 
                  />
                  <p className="text-xs text-muted-foreground">This is your unique username displayed on your profile</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-muted-foreground">Bio</Label>
                <textarea 
                  id="bio" 
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={profileForm.bio}
                  onChange={handleProfileChange}
                  placeholder="Tell us about yourself..."
                />
              </div>
              
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSavingProfile}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
          

        </div>
        )}

        {activeTab === 'subscription' && (
          <div className="px-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="w-full h-[300px] rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="w-full h-[400px] rounded-lg" />
                <Skeleton className="w-full h-[400px] rounded-lg" />
                <Skeleton className="w-full h-[400px] rounded-lg" />
              </div>
            </div>
          ) : (
            <>

              <Card>
                <CardHeader>
                  <CardTitle>Subscription Plans</CardTitle>
                  <CardDescription>Choose the plan that works for you</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Basic</CardTitle>
                        <CardDescription>For casual users</CardDescription>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">$0</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">• Up to 10 plans</p>
                        <p className="text-sm">• Up to 10 participants per plan</p>
                        <p className="text-sm">• Basic features</p>
                      </CardContent>
                      <CardFooter>
                        <SubscriptionManager
                          plan="basic"
                          currentSubscription={userData?.subscription}
                        />
                      </CardFooter>
                    </Card>
                    
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Premium</CardTitle>
                          <Badge>Popular</Badge>
                        </div>
                        <CardDescription>For frequent planners</CardDescription>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">$9.99</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">• Up to 100 plans</p>
                        <p className="text-sm">• Up to 50 participants per plan</p>
                        <p className="text-sm">• Premium features</p>
                        <p className="text-sm">• AI plan generation</p>
                      </CardContent>
                      <CardFooter>
                        <SubscriptionManager
                          plan="premium"
                          currentSubscription={userData?.subscription}
                        />
                      </CardFooter>
                    </Card>
                    
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle>Enterprise</CardTitle>
                        <CardDescription>For businesses</CardDescription>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">$29.99</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">• Unlimited plans</p>
                        <p className="text-sm">• Unlimited participants</p>
                        <p className="text-sm">• All premium features</p>
                        <p className="text-sm">• Priority support</p>
                        <p className="text-sm">• Custom branding</p>
                      </CardContent>
                      <CardFooter>
                        <SubscriptionManager
                          plan="enterprise"
                          currentSubscription={userData?.subscription}
                        />
                      </CardFooter>
                    </Card>
                  </div>
                </CardContent>
              </Card>
              
              {userData?.subscription && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Information</CardTitle>
                    <CardDescription>Manage your payment methods and billing history</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <CreditCard className="h-6 w-6 text-primary" />
                        <div>
                          <p className="font-medium">
                            {userData.subscription.paymentMethod.brand || 'Card'} •••• 
                            {userData.subscription.paymentMethod.lastFour || '****'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {userData.subscription.nextBillingDate ? 
                              format(new Date(userData.subscription.nextBillingDate.seconds * 1000), 'MM/yyyy') : 
                              'N/A'}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleUpdatePayment}
                        disabled={isUpdatingPayment}
                      >
                        {isUpdatingPayment ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          'Update'
                        )}
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <p className="text-sm">Next billing date</p>
                        <p className="text-sm font-medium">
                          {userData.subscription.nextBillingDate ? 
                            format(new Date(userData.subscription.nextBillingDate.seconds * 1000), 'PPP') : 
                            'N/A'}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-sm">Amount</p>
                        <p className="text-sm font-medium">
                          {userData.subscription.amount ? 
                            `$${userData.subscription.amount.toFixed(2)} ${userData.subscription.currency}` : 
                            'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="auto-renew" 
                        checked={userData.subscription.autoRenew}
                        disabled={isTogglingAutoRenew}
                        onCheckedChange={handleToggleAutoRenew}
                      />
                      <Label htmlFor="auto-renew">Auto-renew subscription</Label>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
        )}

        {activeTab === 'preferences' && (
          <div className="px-6 space-y-6">
          <div className="space-y-6">
            {/* Health & Diet Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="mr-2 h-5 w-5 text-pink-500" />
                  Health & Diet
                </CardTitle>
                <CardDescription>Manage your dietary restrictions and health preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.allergies && currentUserProfile.allergies.length > 0 ? (
                      currentUserProfile.allergies.map((allergy, index) => (
                        <Badge key={index} variant="secondary">{allergy}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No allergies specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dietary Restrictions</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.dietaryRestrictions && currentUserProfile.dietaryRestrictions.length > 0 ? (
                      currentUserProfile.dietaryRestrictions.map((restriction, index) => (
                        <Badge key={index} variant="secondary">{restriction}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No dietary restrictions specified</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link href="/onboarding?step=2" className="flex items-center text-sm text-primary hover:underline">
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    Edit Health & Diet Preferences
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Culinary Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ChefHat className="mr-2 h-5 w-5 text-orange-500" />
                  Culinary Preferences
                </CardTitle>
                <CardDescription>Your favorite cuisines and food preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Favorite Cuisines</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.favoriteCuisines && currentUserProfile.favoriteCuisines.length > 0 ? (
                      currentUserProfile.favoriteCuisines.map((cuisine, index) => (
                        <Badge key={index} variant="secondary">{cuisine}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No favorite cuisines specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>General Food Notes</Label>
                  <p className="text-sm text-foreground/90">
                    {currentUserProfile.generalPreferences || "No general food preferences specified"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activity Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-green-500" />
                  Activity Preferences
                </CardTitle>
                <CardDescription>Your activity preferences and limitations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Physical Limitations</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.physicalLimitations && currentUserProfile.physicalLimitations.length > 0 ? (
                      currentUserProfile.physicalLimitations.map((limitation, index) => (
                        <Badge key={index} variant="secondary">{limitation}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No physical limitations specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Activities</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.activityTypePreferences && currentUserProfile.activityTypePreferences.length > 0 ? (
                      currentUserProfile.activityTypePreferences.map((activity, index) => (
                        <Badge key={index} variant="secondary">{activity}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No preferred activities specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Disliked Activities</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.activityTypeDislikes && currentUserProfile.activityTypeDislikes.length > 0 ? (
                      currentUserProfile.activityTypeDislikes.map((activity, index) => (
                        <Badge key={index} variant="destructive">{activity}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No disliked activities specified</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Environmental Sensitivities</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentUserProfile.environmentalSensitivities && currentUserProfile.environmentalSensitivities.length > 0 ? (
                      currentUserProfile.environmentalSensitivities.map((sensitivity, index) => (
                        <Badge key={index} variant="secondary">{sensitivity}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No environmental sensitivities specified</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link href="/onboarding?step=3" className="flex items-center text-sm text-primary hover:underline">
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    Edit Activity Preferences
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {activeTab === 'planning' && (
          <div className="px-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Palette className="mr-2 h-5 w-5 text-indigo-500" />
                Planning Style
              </CardTitle>
              <CardDescription>Your planning preferences and style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">App Theme</Label>
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center space-x-3">
                    {mounted && theme === 'dark' ? (
                      <Moon className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Sun className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {mounted && theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {mounted && theme === 'dark' 
                          ? 'Dark theme for low-light environments' 
                          : 'Light theme for better visibility'
                        }
                      </p>
                    </div>
                  </div>
                  {mounted && (
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                      className="ml-4"
                    />
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Travel Tolerance</Label>
                  <p className="text-sm text-foreground/90">
                    {currentUserProfile.travelTolerance || "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Budget Notes</Label>
                  <p className="text-sm text-foreground/90">
                    {currentUserProfile.budgetFlexibilityNotes || "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Group Size</Label>
                  <p className="text-sm text-foreground/90">
                    {currentUserProfile.socialPreferences?.preferredGroupSize || "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Interaction Level</Label>
                  <p className="text-sm text-foreground/90">
                    {currentUserProfile.socialPreferences?.interactionLevel || "Not specified"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Availability Notes</Label>
                <p className="text-sm text-foreground/90">
                  {currentUserProfile.availabilityNotes || "No availability notes specified"}
                </p>
              </div>
              <div className="flex justify-end">
                <Link href="/onboarding?step=3" className="flex items-center text-sm text-primary hover:underline">
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Edit Planning Style
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === 'engagement' && (
          <div className="px-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Activity</CardTitle>
              <CardDescription>Track your engagement and activity level</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityScoreCard
                activityScore={userData?.activityScore || 0}
                plansCreated={userData?.userStats?.plansCreatedCount || 0}
                plansShared={userData?.userStats?.plansSharedOrExperiencedCount || 0}
                eventAttendance={userData?.userProfile?.eventAttendanceScore || 0}
                levelTitle={userData?.userProfile?.levelTitle || "Newbie Planner"}
                levelStars={userData?.userProfile?.levelStars || 1}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="mr-2 h-5 w-5 text-amber-500" />
                Engagement & Activity
              </CardTitle>
              <CardDescription>Your activity level and engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-foreground/90">
                    {currentUserProfile.eventAttendanceScore || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Attendance Score</p>
                </div>
                <div className="space-y-2">
                  <div className="text-xl font-semibold text-foreground/90">
                    {currentUserProfile.levelTitle || "Newbie Planner"}
                  </div>
                  <p className="text-sm text-muted-foreground">Level</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-center items-center space-x-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        className={`h-5 w-5 ${
                          i < (currentUserProfile.levelStars || 1) 
                            ? 'text-amber-400 fill-amber-400' 
                            : 'text-muted-foreground/30'
                        }`} 
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Stars</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {userData && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Statistics</CardTitle>
                <CardDescription>Your platform activity overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-foreground/90">
                      {userData.userStats?.plansCreatedCount || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Plans Created</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-foreground/90">
                      {userData.userStats?.plansSharedOrExperiencedCount || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Plans Shared/Experienced</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {activeTab === 'notifications' && (
          <div className="px-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch 
                  id="email-notifications" 
                  checked={notifications.email}
                  onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications on your devices</p>
                </div>
                <Switch 
                  id="push-notifications" 
                  checked={notifications.push}
                  onCheckedChange={(checked) => setNotifications({...notifications, push: checked})}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="plan-reminders">Plan Reminders</Label>
                  <p className="text-sm text-muted-foreground">Receive reminders about upcoming plans</p>
                </div>
                <Switch 
                  id="plan-reminders" 
                  checked={notifications.planReminders}
                  onCheckedChange={(checked) => setNotifications({...notifications, planReminders: checked})}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing">Marketing</Label>
                  <p className="text-sm text-muted-foreground">Receive marketing emails and promotions</p>
                </div>
                <Switch 
                  id="marketing" 
                  checked={notifications.marketing}
                  onCheckedChange={(checked) => setNotifications({...notifications, marketing: checked})}
                />
              </div>
              
              <div className="flex justify-end mt-4">
                <Button 
                  onClick={handleSaveNotifications} 
                  disabled={isSavingNotifications}
                >
                  {isSavingNotifications ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === 'privacy' && (
          <div className="px-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>Control who can see your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Plans Visibility</Label>
                  <p className="text-sm text-muted-foreground">Choose who can see the plans you've created</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="plans-public" 
                        name="plansVisibility" 
                        value="public" 
                        checked={privacySettings.plansVisibility === 'public'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, plansVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="plans-public" className="text-sm font-normal cursor-pointer">
                        <Globe className="inline h-4 w-4 mr-2" />
                        Public - Anyone can see your plans
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="plans-followers" 
                        name="plansVisibility" 
                        value="followers" 
                        checked={privacySettings.plansVisibility === 'followers'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, plansVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="plans-followers" className="text-sm font-normal cursor-pointer">
                        <UsersRound className="inline h-4 w-4 mr-2" />
                        Followers - Only your followers can see your plans
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="plans-friends" 
                        name="plansVisibility" 
                        value="friends" 
                        checked={privacySettings.plansVisibility === 'friends'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, plansVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="plans-friends" className="text-sm font-normal cursor-pointer">
                        <Heart className="inline h-4 w-4 mr-2" />
                        Friends - Only your friends can see your plans
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="plans-private" 
                        name="plansVisibility" 
                        value="private" 
                        checked={privacySettings.plansVisibility === 'private'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, plansVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="plans-private" className="text-sm font-normal cursor-pointer">
                        <Lock className="inline h-4 w-4 mr-2" />
                        Private - Only you can see your plans
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-medium">Followers List Visibility</Label>
                  <p className="text-sm text-muted-foreground">Choose who can see your followers list</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="followers-public" 
                        name="followersVisibility" 
                        value="public" 
                        checked={privacySettings.followersVisibility === 'public'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followersVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="followers-public" className="text-sm font-normal cursor-pointer">
                        <Globe className="inline h-4 w-4 mr-2" />
                        Public - Anyone can see your followers
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="followers-followers" 
                        name="followersVisibility" 
                        value="followers" 
                        checked={privacySettings.followersVisibility === 'followers'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followersVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="followers-followers" className="text-sm font-normal cursor-pointer">
                        <UsersRound className="inline h-4 w-4 mr-2" />
                        Followers - Only your followers can see your followers list
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="followers-friends" 
                        name="followersVisibility" 
                        value="friends" 
                        checked={privacySettings.followersVisibility === 'friends'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followersVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="followers-friends" className="text-sm font-normal cursor-pointer">
                        <Heart className="inline h-4 w-4 mr-2" />
                        Friends - Only your friends can see your followers list
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="followers-private" 
                        name="followersVisibility" 
                        value="private" 
                        checked={privacySettings.followersVisibility === 'private'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followersVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="followers-private" className="text-sm font-normal cursor-pointer">
                        <Lock className="inline h-4 w-4 mr-2" />
                        Private - Only you can see your followers list
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-medium">Following List Visibility</Label>
                  <p className="text-sm text-muted-foreground">Choose who can see who you're following</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="following-public" 
                        name="followingVisibility" 
                        value="public" 
                        checked={privacySettings.followingVisibility === 'public'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followingVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="following-public" className="text-sm font-normal cursor-pointer">
                        <Globe className="inline h-4 w-4 mr-2" />
                        Public - Anyone can see who you're following
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="following-followers" 
                        name="followingVisibility" 
                        value="followers" 
                        checked={privacySettings.followingVisibility === 'followers'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followingVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="following-followers" className="text-sm font-normal cursor-pointer">
                        <UsersRound className="inline h-4 w-4 mr-2" />
                        Followers - Only your followers can see who you're following
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="following-friends" 
                        name="followingVisibility" 
                        value="friends" 
                        checked={privacySettings.followingVisibility === 'friends'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followingVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="following-friends" className="text-sm font-normal cursor-pointer">
                        <Heart className="inline h-4 w-4 mr-2" />
                        Friends - Only your friends can see who you're following
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="following-private" 
                        name="followingVisibility" 
                        value="private" 
                        checked={privacySettings.followingVisibility === 'private'}
                        onChange={(e) => setPrivacySettings(prev => ({ ...prev, followingVisibility: e.target.value }))}
                        className="w-4 h-4 text-primary" 
                      />
                      <Label htmlFor="following-private" className="text-sm font-normal cursor-pointer">
                        <Lock className="inline h-4 w-4 mr-2" />
                        Private - Only you can see who you're following
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSavePrivacySettings}
                    disabled={isSavingPrivacy}
                  >
                    {isSavingPrivacy ? (
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : null}
                    Save Privacy Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Account Privacy</CardTitle>
              <CardDescription>Control who can follow you and see your content.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="private-account">Private Account</Label>
                <Switch
                  id="private-account"
                  checked={isPrivate}
                  onCheckedChange={handlePrivacyToggle}
                  disabled={isSavingPrivacySetting}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isPrivate ? 'Only people you approve can follow you.' : 'Anyone can follow you instantly.'}
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === 'security' && (
          <div className="px-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user && isPasswordBasedAccount() ? (
                <form onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <div className="relative">
                      <Input 
                        id="current-password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={securityForm.currentPassword}
                        onChange={handleSecurityChange}
                        name="currentPassword"
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input 
                      id="new-password" 
                      type="password" 
                      placeholder="••••••••"
                      value={securityForm.newPassword}
                      onChange={handleSecurityChange}
                      name="newPassword"
                      autoComplete="new-password"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      placeholder="••••••••"
                      value={securityForm.confirmPassword}
                      onChange={handleSecurityChange}
                      name="confirmPassword"
                      autoComplete="new-password"
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit"
                      disabled={isUpdatingPassword}
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="flex items-start">
                    <div className="mr-4 mt-0.5">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Third-Party Authentication</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your account uses {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'a third-party'} authentication method. 
                        Password management is handled by your authentication provider.
                      </p>
                      {user?.email && (
                        <p className="text-xs text-muted-foreground">
                          Signed in as: {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account by enabling two-factor authentication.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={handleEnable2FA}
                  disabled={isEnabling2FA}
                >
                  {isEnabling2FA ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Enable 2FA
                    </>
                  )}
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Sessions</Label>
                <p className="text-sm text-muted-foreground">
                  Manage your active sessions and sign out from other devices.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={handleSignOutAllDevices}
                  disabled={isSigningOutAll}
                >
                  {isSigningOutAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out from All Devices
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
      
      {/* Footer Actions */}
      {!activeTab && (
        <div className="px-6 mt-8 space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex flex-col space-y-3">
              <Button variant="outline" asChild>
                <Link href="/help">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help Center
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/privacy">
                  <FileText className="h-4 w-4 mr-2" />
                  Privacy Policy
                </Link>
              </Button>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
          </div>
          
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              Profile created: {currentUserProfile.createdAt && isValid(currentUserProfile.createdAt as Date) ? format(currentUserProfile.createdAt as Date, 'PPP p') : 'N/A'} <br/>
              Last updated: {currentUserProfile.updatedAt && isValid(currentUserProfile.updatedAt as Date) ? format(currentUserProfile.updatedAt as Date, 'PPP p') : 'N/A'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
