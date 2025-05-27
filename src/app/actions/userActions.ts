// src/app/actions/userActions.ts
'use server';

import {
  createUserProfileAdmin,
  searchUsersAdmin as searchUsersAdminService,
  sendFriendRequestAdmin as sendFriendRequestAdminService,
  acceptFriendRequestAdmin as acceptFriendRequestAdminService,
  declineOrCancelFriendRequestAdmin as declineOrCancelFriendRequestAdminService,
  removeFriendAdmin as removeFriendAdminService,
  getUserProfileAdmin as getUserProfileAdminService,
  getUsersProfilesAdmin as getUsersProfilesAdminService, // Correct alias
  getUserStatsAdmin as getUserStatsAdminService,
  followUserAdmin as followUserAdminService,
  unfollowUserAdmin as unfollowUserAdminService,
  updateUserProfileAvatarAdmin,
} from '@/services/userService.server';
import { getFeedPostsAdmin } from '@/services/feedService.server';
import type { OnboardingProfileData, SearchedUser, UserProfile, UserStats, FriendStatus, FeedPost, UserPreferences } from '@/types/user'; // Added FeedPost and UserPreferences
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { authAdmin, storageAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { commonImageExtensions } from '@/lib/utils';
import { Firestore } from 'firebase-admin/firestore';


interface AuthUserData {
  uid: string;
  displayName: string | null;
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


export async function completeOnboardingAction(
  clientProfileFormData: z.infer<typeof clientOnboardingFormSchema>,
  authUserData: AuthUserData
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Authentication service not available." };
  }
  if (!firestoreAdmin) {
    return { success: false, error: "Server error: Database service not available." };
  }
  if (!authUserData || !authUserData.uid) {
    return { success: false, error: 'User not authenticated for onboarding action.' };
  }

  try {
    const validationResult = clientOnboardingFormSchema.safeParse(clientProfileFormData);
    if (!validationResult.success) {
      return { success: false, error: "Invalid form data. " + JSON.stringify(validationResult.error.flatten().fieldErrors) };
    }
    const validatedProfileData = validationResult.data;
    
    const profilePayloadForAdminService: OnboardingProfileData & {
      name: string | null; 
      email: string | null;
      avatarUrl: string | null;
    } = {
      ...validatedProfileData,
      countryDialCode: null, 
      name: validatedProfileData.name || authUserData.displayName, 
      email: authUserData.email, 
      avatarUrl: authUserData.photoURL, 
    };
    
    await createUserProfileAdmin(authUserData.uid, profilePayloadForAdminService);

    revalidatePath('/profile');
    revalidatePath(`/users/${authUserData.uid}`);
    revalidatePath('/(app)/layout', 'layout');
    return { success: true, userId: authUserData.uid };

  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save profile.' };
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
    await sendFriendRequestAdminService(currentUserProfile, targetUserProfile);

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
    await acceptFriendRequestAdminService(currentUserProfile, requesterProfile);

    return {
      success: true,
      message: `You are now friends with ${requesterProfile.name || 'user'}.`
    };
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

    await declineOrCancelFriendRequestAdminService(currentUserId, targetUserId);

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

    await removeFriendAdminService(currentUserId, targetUserId);

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
    await followUserAdminService(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    revalidatePath(`/users/${currentUserId}`);
    revalidatePath('/explore'); 
    revalidatePath('/messages'); 
    return { success: true, message: "Successfully followed user." };
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
    await unfollowUserAdminService(currentUserId, targetUserId);
    revalidatePath(`/users/${targetUserId}`);
    revalidatePath(`/users/${currentUserId}`);
    revalidatePath('/explore');
    revalidatePath('/messages');
    return { success: true, message: "Successfully unfollowed user." };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to unfollow user." };
  }
}

export async function getUserLocationAction(userId: string): Promise<{ 
  success: boolean; 
  data?: { city: string; country: string; }; 
  error?: string; 
}> {
  if (!firestoreAdmin) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    const userDoc = await (firestoreAdmin as Firestore)
      .collection('userProfiles')
      .doc(userId)
      .get();

    const userData = userDoc.data();
    
    if (!userData?.physicalAddress?.city || !userData?.physicalAddress?.country) {
      return { success: false, error: 'Location not found' };
    }

    return {
      success: true,
      data: {
        city: userData.physicalAddress.city,
        country: userData.physicalAddress.country
      }
    };
  } catch (error) {
    console.error('[getUserLocationAction] Error:', error);
    return { success: false, error: 'Failed to fetch user location' };
  }
}

export async function getUserPreferencesAction(userId: string): Promise<UserPreferences | null> {
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return null;
  }

  try {
    const userDoc = await firestoreAdmin.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    if (!userData?.preferences) return null;

    return {
      preferredCategories: userData.preferences.categories || [],
      preferredLocations: userData.preferences.locations || [],
      preferredPriceRange: userData.preferences.priceRange || '',
      preferredDayOfWeek: userData.preferences.dayOfWeek || [],
      preferredTimeOfDay: userData.preferences.timeOfDay || []
    };
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return null;
  }
}
