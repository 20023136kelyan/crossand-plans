// src/app/actions/userActions.ts
'use server';

import {
  createUserProfileAdmin,
  updateUserProfileAdmin,
  updateUserProfileAvatarAdmin,
  searchUsersAdmin as searchUsersAdminService,
  getUserProfileAdmin as getUserProfileAdminService,
  getUserStatsAdmin as getUserStatsAdminService,
  sendFriendRequestAdmin,
  acceptFriendRequestAdmin,
  declineOrCancelFriendRequestAdmin,
  removeFriendAdmin,
  followUserAdmin,
  unfollowUserAdmin
} from '@/services/userService.server';
import { countries } from '@/app/(app)/onboarding/countries';
import { getFeedPostsAdmin } from '@/services/feedService.server';
import type { OnboardingProfileData, SearchedUser, UserProfile, UserStats, FriendStatus, FeedPost, UserPreferences } from '@/types/user'; // Added FeedPost and UserPreferences
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { authAdmin, storageAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { commonImageExtensions } from '@/lib/utils';
import { Firestore } from 'firebase-admin/firestore';

// Collection constants
const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';

interface AuthUserData {
  uid: string;
  displayName: string | null;
  username?: string | null;
  email: string | null;
  photoURL: string | null;
}

const clientOnboardingFormSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100).nullable(),
  bio: z.string().max(160, { message: "Bio cannot exceed 160 characters."}).optional().nullable(),
  selectedCountryCode: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  birthDate: z.string().optional().refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Birth date must be in YYYY-MM-DD format or empty.",
  }).nullable(),
  physicalAddress: z.object({
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  }).optional().nullable(),
  allergies: z.array(z.string()).optional().default([]),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  generalPreferences: z.string().max(500).optional().nullable(),
  favoriteCuisines: z.array(z.string()).optional().default([]),
  physicalLimitations: z.array(z.string()).optional().default([]),
  activityTypePreferences: z.array(z.string()).optional().default([]),
  activityTypeDislikes: z.array(z.string()).optional().default([]),
  environmentalSensitivities: z.array(z.string()).optional().default([]),
  travelTolerance: z.string().optional().nullable(),
  budgetFlexibilityNotes: z.string().max(300).optional().nullable(),
  socialPreferences: z.object({
    preferredGroupSize: z.string().optional().nullable(),
    interactionLevel: z.string().optional().nullable(),
  }).optional().nullable(),
  availabilityNotes: z.string().max(500).optional().nullable(),
});

/**
 * Complete onboarding action.
 * 
 * @param clientProfileFormData - Client profile form data.
 * @param authUserData - Auth user data.
 * @returns { success: boolean; error?: string; userId?: string } - Success status, error message, and user ID.
 */
export async function completeOnboardingAction(
  clientProfileFormData: z.infer<typeof clientOnboardingFormSchema>,
  authUserData: AuthUserData
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!authAdmin) {
    console.error("[completeOnboardingAction] Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }

  if (!firestoreAdmin) {
    console.error("[completeOnboardingAction] Admin Firestore service not available.");
    return { success: false, error: "Server error: Database service not available." };
  }

  const userId = authUserData.uid;
  
  try {
    // Don't use Google profile picture URL directly to avoid rate limiting issues
    // Only use it if the user hasn't set their own avatar yet
    let avatarUrl = null;
    
    // Check if we already have a profile with an avatar
    try {
      const existingUserDoc = await firestoreAdmin.collection('users').doc(userId).get();
      if (existingUserDoc.exists) {
        const existingData = existingUserDoc.data();
        // Keep existing avatar if available
        if (existingData?.avatarUrl && !existingData.avatarUrl.includes('googleusercontent.com')) {
          avatarUrl = existingData.avatarUrl;
        }
      }
    } catch (error) {
      console.error("[completeOnboardingAction] Error checking existing profile:", error);
      // Continue with null avatarUrl if there's an error
    }
    
    // Convert form data to profile data format
    const profileData: OnboardingProfileData & {
      name: string | null;
      username: string | null;
      email: string | null;
      avatarUrl: string | null;
    } = {
      name: clientProfileFormData.name || null,
      username: clientProfileFormData.username || null,
      email: authUserData.email,
      avatarUrl: avatarUrl, // Use existing avatar or null (don't use Google URL)
      bio: clientProfileFormData.bio || null,
      countryDialCode: clientProfileFormData.selectedCountryCode ? 
        countries.find((c: { code: string; dialCode: string }) => c.code === clientProfileFormData.selectedCountryCode)?.dialCode || null : null,
      phoneNumber: clientProfileFormData.phoneNumber || null,
      birthDate: clientProfileFormData.birthDate ? clientProfileFormData.birthDate : null,
      physicalAddress: clientProfileFormData.physicalAddress || null,
      allergies: clientProfileFormData.allergies || [],
      dietaryRestrictions: clientProfileFormData.dietaryRestrictions || [],
      favoriteCuisines: clientProfileFormData.favoriteCuisines || [],
      generalPreferences: clientProfileFormData.generalPreferences || '',
      physicalLimitations: clientProfileFormData.physicalLimitations || [],
      activityTypePreferences: clientProfileFormData.activityTypePreferences || [],
      activityTypeDislikes: clientProfileFormData.activityTypeDislikes || [],
      environmentalSensitivities: clientProfileFormData.environmentalSensitivities || [],
      travelTolerance: clientProfileFormData.travelTolerance || '',
      budgetFlexibilityNotes: clientProfileFormData.budgetFlexibilityNotes || '',
      socialPreferences: clientProfileFormData.socialPreferences ? {
        preferredGroupSize: clientProfileFormData.socialPreferences.preferredGroupSize || null,
        interactionLevel: clientProfileFormData.socialPreferences.interactionLevel || null
      } : { preferredGroupSize: null, interactionLevel: null },
      availabilityNotes: clientProfileFormData.availabilityNotes || '',
    };

    await createUserProfileAdmin(userId, profileData);
    revalidatePath('/profile');
    revalidatePath(`/users/${userId}`);
    revalidatePath('/(app)/layout', 'layout');
    return { success: true, userId };
  } catch (error) {
    console.error("[completeOnboardingAction] Error creating user profile:", error);
    return { success: false, error: "Failed to complete onboarding. Please try again." };
  }
}

export async function updateUserAvatarAction(
  formData: FormData,
  idToken: string
): Promise<{ success: boolean; newAvatarUrl?: string; error?: string }> {
  if (!authAdmin) {
    console.error("[updateUserAvatarAction] Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!storageAdmin) {
    console.error("[updateUserAvatarAction] Admin Storage service not available.");
    return { success: false, error: "Server error: Storage service not available." };
  }
  if (!firestoreAdmin) {
     console.error("[updateUserAvatarAction] Admin Firestore service not available.");
    return { success: false, error: "Server error: Database service not available." };
  }

  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    console.error("[updateUserAvatarAction] ID Token verification error:", error);
    let e = 'Authentication failed. Invalid or expired token.';
    if (error.code === 'auth/id-token-expired') e = 'Your session has expired. Please log in again.';
    else if (error.code === 'auth/argument-error') e = 'Authentication token is malformed.';
    return { success: false, error: e };
  }

  const imageFile = formData.get('avatarImage') as File | null;
  if (!imageFile) {
    return { success: false, error: "No image file provided." };
  }

  const getMimeTypeFromServer = (fileName: string): string | null => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return null;
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml', 'avif': 'image/avif'
    };
    return mimeTypes[extension] || null;
  };

  let determinedContentType = imageFile.type;
  if (!determinedContentType || !determinedContentType.startsWith('image/')) {
    determinedContentType = getMimeTypeFromServer(imageFile.name);
  }

  if (!determinedContentType || !determinedContentType.startsWith('image/')) {
    return { success: false, error: `Invalid file type for ${imageFile.name}. Please use JPG, PNG, GIF, WEBP.` };
  }

  if (imageFile.size > 2 * 1024 * 1024) { // 2MB limit
    return { success: false, error: "Image size should not exceed 2MB." };
  }

  try {
    const bucketNameForAction = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = bucketNameForAction ? storageAdmin.bucket(bucketNameForAction) : storageAdmin.bucket();
    if (!bucket) {
      console.error("[updateUserAvatarAction] Could not access Firebase Storage bucket.");
      return { success: false, error: 'Server error: Storage bucket not accessible.' };
    }
    const bucketName = bucket.name;

    const originalName = imageFile.name;
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    // Use a consistent filename like 'profile_pic' to overwrite, or add a timestamp for versions
    const fileName = `user_avatars/${userId}/profile_pic.${extension}`; 
    
    const blob = bucket.file(fileName);
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    await blob.save(buffer, {
      metadata: { 
        contentType: determinedContentType, 
        cacheControl: 'no-cache, max-age=0',
        customMetadata: { uploaderUid: userId } 
      },
      public: true,
    });
    
    // Construct the public URL manually - this is more reliable for public objects
    const downloadURL = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(fileName)}?t=${Date.now()}`;
    
    await updateUserProfileAvatarAdmin(userId, downloadURL);

    // Revalidate all affected pages
    revalidatePath(`/users/${userId}`);
    revalidatePath(`/profile`);
    revalidatePath('/(app)/layout', 'layout'); // To refresh avatar in navs
    revalidatePath('/feed'); // Refresh feed to update user's posts
    revalidatePath('/explore'); // Refresh explore page where user might appear
    revalidatePath('/messages'); // Refresh messages where user's avatar appears
    return { success: true, newAvatarUrl: downloadURL };

  } catch (error: any) {
    console.error(`[updateUserAvatarAction] Error processing avatar for user ${userId}:`, error);
    return { success: false, error: error.message || "Could not update avatar." };
  }
}


interface ProfilePageData {
  userProfile: UserProfile | null;
  userPosts: FeedPost[]; 
  userStats: UserStats | null;
  isViewerFollowing?: boolean | null; 
  friendshipStatusWithViewer?: FriendStatus | 'not_friends' | 'is_self' | null;
}

export async function fetchPublicUserProfileDataAction(
  profileId: string,
  idToken?: string | null 
): Promise<ProfilePageData & { error?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { userProfile: null, userPosts: [], userStats: null, error: "Server error: Core services not available." };
  }
  
  let currentViewerId: string | null = null;
  if (idToken) {
    try {
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      currentViewerId = decodedToken.uid;
    } catch (error) {
      // Proceed as unauthenticated viewer
    }
  }

  try {
    const userProfile = await getUserProfileAdminService(profileId);
    if (!userProfile) {
      return { userProfile: null, userPosts: [], userStats: null, error: "User profile not found." };
    }
    
    const { posts: userPosts } = await getFeedPostsAdmin(currentViewerId, 50, profileId); 
    const userStats = await getUserStatsAdminService(profileId);

    let isViewerFollowing: boolean = false; // Initialize to false
    if (currentViewerId && currentViewerId !== profileId) { // Ensure it's not the user's own profile
      isViewerFollowing = (userProfile.followers || []).includes(currentViewerId); // Use empty array if followers is undefined
    }

    let friendshipStatusWithViewer: FriendStatus | 'not_friends' | 'is_self' | null = 'not_friends';
    if (currentViewerId) {
      if (currentViewerId === profileId) {
        friendshipStatusWithViewer = 'is_self';
      } else {
        try {
            const friendshipDoc = await firestoreAdmin.collection(USER_COLLECTION).doc(currentViewerId).collection(FRIENDSHIPS_SUBCOLLECTION).doc(profileId).get();
            if (friendshipDoc.exists) {
               friendshipStatusWithViewer = friendshipDoc.data()?.status as FriendStatus;
            } else {
                const otherWayFriendshipDoc = await firestoreAdmin.collection(USER_COLLECTION).doc(profileId).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentViewerId).get();
                if (otherWayFriendshipDoc.exists && otherWayFriendshipDoc.data()?.status === 'pending_sent') {
                    friendshipStatusWithViewer = 'pending_received';
                } else {
                    friendshipStatusWithViewer = 'not_friends';
                }
            }
        } catch (fsError: any) {
            friendshipStatusWithViewer = 'not_friends';
        }
      }
    }

    return { userProfile, userPosts, userStats, isViewerFollowing, friendshipStatusWithViewer };
  } catch (error: any) {
    return { userProfile: null, userPosts: [], userStats: null, error: error.message || "Failed to fetch profile data." };
  }
}

export async function searchUsersAction(
    searchTerm: string,
    idToken: string
): Promise<{ success: boolean; users?: SearchedUser[]; error?: string }> {
    if (!authAdmin) {
      return { success: false, error: "Server error: Authentication service not available." };
    }
    if (!idToken) {
        return { success: false, error: 'Authentication token missing.' };
    }
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (authError: any) {
        let specificError = 'Authentication failed. Invalid or expired token.';
        if (authError.code === 'auth/id-token-expired') {
            specificError = 'Your session has expired. Please log in again.';
        } else if (authError.code === 'auth/argument-error') {
            specificError = 'Authentication token is malformed. Please try again.';
        }
        return { success: false, error: specificError };
    }
    const currentUserId = decodedToken.uid;

    try {
        const users = await searchUsersAdminService(searchTerm, currentUserId);
        return { success: true, users };
    } catch (error: any) {
        return { success: false, error: error.message || "Failed to search users." };
    }
}

export async function sendFriendRequestAction(
  targetUserId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Auth service not available." };
  }

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    if (currentUserId === targetUserId) {
      return { success: false, error: "You cannot send a friend request to yourself." };
    }

    // Get both user profiles
    const [currentUserProfile, targetUserProfile] = await Promise.all([
      getUserProfileAdminService(currentUserId),
      getUserProfileAdminService(targetUserId)
    ]);

    if (!currentUserProfile || !targetUserProfile) {
      return { success: false, error: "Could not find one or both user profiles." };
    }

    // Send friend request using admin service
    await sendFriendRequestAdmin(currentUserProfile, targetUserProfile);

    return {
      success: true,
      message: `Friend request sent to ${targetUserProfile.name || 'user'}.`
    };
  } catch (error: any) {
    console.error('Error in sendFriendRequestAction:', error);
    return {
      success: false,
      error: error.message || "Failed to send friend request."
    };
  }
}

export async function acceptFriendRequestAction(
  requesterId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Auth service not available." };
  }

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    // Get both user profiles
    const [currentUserProfile, requesterProfile] = await Promise.all([
      getUserProfileAdminService(currentUserId),
      getUserProfileAdminService(requesterId)
    ]);

    if (!currentUserProfile || !requesterProfile) {
      return { success: false, error: "Could not find one or both user profiles." };
    }

    // Accept friend request using admin service
    const result = await acceptFriendRequestAdmin(currentUserProfile, requesterProfile);
    revalidatePath(`/users/${requesterId}`);
    return { success: true, message: "Friend request accepted successfully." };
  } catch (error: any) {
    console.error('Error in acceptFriendRequestAction:', error);
    return {
      success: false,
      error: error.message || "Failed to accept friend request."
    };
  }
}

export async function declineFriendRequestAction(
  targetUserId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Auth service not available." };
  }

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    await declineOrCancelFriendRequestAdmin(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    return {
      success: true,
      message: "Friend request declined."
    };
  } catch (error: any) {
    console.error('Error in declineFriendRequestAction:', error);
    return {
      success: false,
      error: error.message || "Failed to decline friend request."
    };
  }
}

export async function removeFriendAction(
  targetUserId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Auth service not available." };
  }

  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    await removeFriendAdmin(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    return {
      success: true,
      message: "Friend removed."
    };
  } catch (error: any) {
    console.error('Error in removeFriendAction:', error);
    return {
      success: false,
      error: error.message || "Failed to remove friend."
    };
  }
}

export async function followUserAction(
  targetUserId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  if (!idToken) return { success: false, error: "Authentication token missing." };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (authError.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }
  const currentUserId = decodedToken.uid;

  if (currentUserId === targetUserId) {
    return { success: false, error: "You cannot follow yourself." };
  }

  try {
    await followUserAdmin(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    revalidatePath('/feed');
    return { success: true, message: "User followed successfully." };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to follow user." };
  }
}

export async function unfollowUserAction(
  targetUserId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  if (!idToken) return { success: false, error: "Authentication token missing." };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (authError.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }
  const currentUserId = decodedToken.uid;

  try {
    await unfollowUserAdmin(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    revalidatePath('/feed');
    return { success: true, message: "User unfollowed successfully." };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to unfollow user." };
  }
}

export async function getUserLocationAction(userId: string): Promise<{ 
  success: boolean; 
  data?: { city: string; country: string; state?: string; }; 
  error?: string; 
}> {
  console.log(`[getUserLocationAction] Starting location fetch for user ID: ${userId}`);
  
  // Default location to return if we can't get the actual location
  const defaultLocationData = {
    city: 'Unknown',
    country: 'Unknown',
    state: 'Unknown'
  };
  
  if (!userId || userId === 'undefined') {
    console.warn('[getUserLocationAction] Invalid user ID provided');
    return { 
      success: true, 
      data: {
        city: 'Unknown',
        country: 'Unknown'
      }
    };
  }
  
  if (!firestoreAdmin) {
    console.warn('[getUserLocationAction] Database not initialized');
    return { 
      success: true, 
      data: {
        city: 'Unknown',
        country: 'Unknown'
      }
    };
  }

  try {
    // First try to get the user profile directly
    console.log(`[getUserLocationAction] Fetching profile for userId: ${userId}`);
    const userProfile = await getUserProfileAdminService(userId);
    
    if (!userProfile) {
      console.warn(`[getUserLocationAction] Profile fetch returned null for userId: ${userId}`);
      return { 
        success: true, 
        data: {
          city: 'Unknown',
          country: 'Unknown'
        }
      };
    }
    
    console.log(`[getUserLocationAction] Retrieved profile for userId: ${userId}`, { 
      hasPhysicalAddress: !!userProfile.physicalAddress,
      username: userProfile.username || 'not set',
      name: userProfile.name || 'not set',
      profileKeys: Object.keys(userProfile)
    });
    
    // Check if physicalAddress exists and has the required fields
    if (!userProfile.physicalAddress) {
      console.warn(`[getUserLocationAction] No physicalAddress in profile for userId: ${userId}`);
      return { 
        success: true, 
        data: {
          city: 'Unknown',
          country: 'Unknown'
        }
      };
    }
    
    const physicalAddress = userProfile.physicalAddress;
    const city = physicalAddress.city || 'Unknown';
    const country = physicalAddress.country || 'Unknown';
    const state = physicalAddress.state || 'Unknown';
    
    console.log(`[getUserLocationAction] Retrieved location:`, { city, state, country });
    
    // Return location data with fallbacks for any missing fields
    return {
      success: true,
      data: {
        city,
        country,
        state
      }
    };
  } catch (error) {
    console.error('[getUserLocationAction] Error fetching user location:', error);
    return { 
      success: true, 
      data: {
        city: 'Unknown',
        country: 'Unknown'
      }
    };
  }
}

export async function getUserPreferencesAction(userId: string): Promise<UserPreferences | null> {
  if (!firestoreAdmin) {
    console.error('[getUserPreferencesAction] Database not initialized');
    return null;
  }

  try {
    const userProfileRef = firestoreAdmin.collection(USER_COLLECTION).doc(userId);
    const userProfileDoc = await userProfileRef.get();

    if (!userProfileDoc.exists) {
      console.warn(`[getUserPreferencesAction] User profile not found for userId: ${userId}`);
      return null;
    }

    const userData = userProfileDoc.data() as any;
    
    // Create default preferences if not available
    const userPreferences: UserPreferences = {
      preferredCategories: [],
      preferredLocations: [],
      preferredPriceRange: '',
      preferredDayOfWeek: [],
      preferredTimeOfDay: []
    };
    
    // If preferences exist and are properly structured, extract them
    if (userData.preferences && typeof userData.preferences === 'object' && !Array.isArray(userData.preferences)) {
      userPreferences.preferredCategories = userData.preferences.categories || [];
      userPreferences.preferredLocations = userData.preferences.locations || [];
      userPreferences.preferredPriceRange = userData.preferences.priceRange || '';
      userPreferences.preferredDayOfWeek = userData.preferences.dayOfWeek || [];
      userPreferences.preferredTimeOfDay = userData.preferences.timeOfDay || [];
    }

    return userPreferences;
  } catch (error) {
    console.error('[getUserPreferencesAction] Error fetching user preferences:', error);
    return null;
  }
}

/**
* Updates a user profile with the provided data
* @param userId - The user ID to update
* @param profileData - The profile data to update
* @returns Promise with success status and error message if any
*/
export async function updateUserProfileAction(
userId: string,
profileData: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
console.log(`[updateUserProfileAction] Starting profile update for user ID: ${userId}`);
  
if (!userId) {
console.warn('[updateUserProfileAction] Invalid user ID provided');
return { success: false, error: 'Invalid user ID' };
}
  
if (!firestoreAdmin) {
console.warn('[updateUserProfileAction] Database not initialized');
return { success: false, error: 'Database not initialized' };
}

try {
// If username is provided, ensure it's set in the profile
if (profileData.username) {
console.log(`[updateUserProfileAction] Updating username to: ${profileData.username}`);
}

// If name is provided, update name_lowercase as well
if (profileData.name) {
profileData.name_lowercase = profileData.name.toLowerCase();
console.log(`[updateUserProfileAction] Updating name to: ${profileData.name}`);
}
  
// Update the user profile using the admin service
await updateUserProfileAdmin(userId, profileData);
  
console.log(`[updateUserProfileAction] Successfully updated profile for user ${userId}`);
return { success: true };
} catch (error) {
console.error('[updateUserProfileAction] Error updating user profile:', error);
return { 
  success: false, 
  error: error instanceof Error ? error.message : 'Unknown error updating profile'
};
}
}
