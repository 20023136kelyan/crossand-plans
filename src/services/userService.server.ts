// src/services/userService.server.ts
import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { UserProfile, OnboardingProfileData, FriendEntry, SearchedUser, UserRoleType, UserStats, FriendStatus, AppTimestamp } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue, DocumentSnapshot, QueryDocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin'; // For FieldPath.documentId()
import { updateUserAvatarInFeedAdmin } from './feedService.server';
import { FirebaseQueryBuilder, COLLECTIONS, SUBCOLLECTIONS } from '@/lib/data/core/QueryBuilder';
import { createNotification } from './notificationService.server';

// Legacy constants for backward compatibility
const USER_COLLECTION = COLLECTIONS.USERS;
const FRIENDSHIPS_SUBCOLLECTION = SUBCOLLECTIONS.FRIENDSHIPS;
const PLANS_COLLECTION = COLLECTIONS.PLANS; // For plan counts
const FEED_POSTS_COLLECTION = COLLECTIONS.FEED_POSTS; // For post counts

// Helper to convert Admin Timestamps to JS Date or null for UserProfile
const convertAdminProfileTimestamps = (data: any): Pick<UserProfile, 'birthDate' | 'createdAt' | 'updatedAt'> => {
  const convert = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof AdminTimestamp) return ts.toDate();
    if (ts instanceof Date) return ts; // Should not happen if data is from Firestore Admin SDK
    if (ts && typeof ts.toDate === 'function') { // For objects that mimic Firestore Timestamp
        try { return ts.toDate(); } catch (e) { console.warn(`[convertAdminProfileTimestamps] Error converting toDate for value: ${JSON.stringify(ts)}`, e); }
    }
    if (typeof ts === 'string') { // For ISO strings, though Admin SDK usually gives Timestamps
        try {
            const parsedDate = new Date(ts);
            if (!isNaN(parsedDate.getTime())) return parsedDate;
        } catch (e) { console.warn(`[convertAdminProfileTimestamps] Error parsing date string: ${ts}`, e); }
    }
    console.warn(`[convertAdminProfileTimestamps] Unexpected timestamp type for UserProfile: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning null for optional or epoch for required.`);
    return null;
  };
  
  const nowEpoch = new Date(0); // Default for required timestamps if conversion fails
  return {
    birthDate: data.birthDate ? convert(data.birthDate) : null,
    // For createdAt/updatedAt, if they are missing/invalid, using epoch might be confusing.
    // Better to let them be null if data.createdAt/data.updatedAt are truly missing and handle that in UserProfile type or consumers.
    // However, UserProfile type defines them as AppTimestamp (which can't be null directly at root).
    // So, we provide a default if missing, or handle as error.
    createdAt: data.createdAt ? (convert(data.createdAt) || nowEpoch) : nowEpoch, 
    updatedAt: data.updatedAt ? (convert(data.updatedAt) || nowEpoch) : nowEpoch,
  };
};


export const getUserProfileAdmin = async (uid: string): Promise<UserProfile | null> => {
  if (!uid) {
    console.warn("[getUserProfileAdmin] UID not provided.");
    return null;
  }
  try {
    const userDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, uid);
    const userDocSnap = await userDocRef.get();

    if (userDocSnap.exists) {
      const data = userDocSnap.data() as any;
      const timestamps = convertAdminProfileTimestamps(data);
      return {
        uid,
        ...data,
        ...timestamps,
        role: data.role || 'user',
        isVerified: data.isVerified || false,
        bio: data.bio || null,
        name_lowercase: data.name ? data.name.toLowerCase() : null,
        // Ensure preference arrays exist
        allergies: data.allergies || [],
        dietaryRestrictions: data.dietaryRestrictions || [],
        favoriteCuisines: data.favoriteCuisines || [],
        physicalLimitations: data.physicalLimitations || [],
        activityTypePreferences: data.activityTypePreferences || [],
        activityTypeDislikes: data.activityTypeDislikes || [],
        environmentalSensitivities: data.environmentalSensitivities || [],
        preferences: data.preferences || [], // Combined preferences
        followers: data.followers || [],
        following: data.following || [],
      } as UserProfile;
    } else {
      console.warn('[getUserProfileAdmin] No such user profile document for UID (admin SDK):', uid);
      return null;
    }
  } catch (error) {
    console.error('[getUserProfileAdmin] Error fetching user profile (admin SDK):', error);
    throw error; // Re-throw to be caught by server action
  }
};

export const getUsersProfilesAdmin = async (uids: string[]): Promise<UserProfile[]> => {
  if (!uids || uids.length === 0) {
    return [];
  }

  try {
    const profiles: UserProfile[] = [];
    const MAX_GET_ALL_COUNT = 30; // Firestore 'in' query limit (though getAll uses individual gets)
    const chunks: string[][] = [];

    for (let i = 0; i < uids.length; i += MAX_GET_ALL_COUNT) {
        chunks.push(uids.slice(i, i + MAX_GET_ALL_COUNT));
    }

    for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        const userDocRefs = chunk.map(uid => FirebaseQueryBuilder.doc(COLLECTIONS.USERS, uid));
        const userDocSnaps = await firestoreAdmin!.getAll(...userDocRefs);

        userDocSnaps.forEach(docSnap => {
          if (docSnap.exists) {
            const data = docSnap.data() as any;
            const timestamps = convertAdminProfileTimestamps(data);
            profiles.push({
              uid: docSnap.id,
              ...data,
              ...timestamps,
              role: data.role || 'user',
              isVerified: data.isVerified || false,
              bio: data.bio || null,
              name_lowercase: data.name ? data.name.toLowerCase() : null,
              allergies: data.allergies || [],
              dietaryRestrictions: data.dietaryRestrictions || [],
              favoriteCuisines: data.favoriteCuisines || [],
              physicalLimitations: data.physicalLimitations || [],
              activityTypePreferences: data.activityTypePreferences || [],
              activityTypeDislikes: data.activityTypeDislikes || [],
              environmentalSensitivities: data.environmentalSensitivities || [],
              preferences: data.preferences || [],
              followers: data.followers || [],
              following: data.following || [],
            } as UserProfile);
          } else {
            console.warn(`[getUsersProfilesAdmin] Profile not found for UID (admin SDK): ${docSnap.id}`);
          }
        });
    }
    return profiles;
  } catch (error) {
    console.error('[getUsersProfilesAdmin] Error fetching multiple user profiles (admin SDK):', error);
    throw error;
  }
};

/**
 * Creates default collections for a new user
 * @param uid - The user ID
 */
export const createDefaultUserCollections = async (uid: string): Promise<void> => {
  try {
    const db = firestoreAdmin as Firestore;
    
    // Create default userStats
    const userStatsRef = db.collection('userStats').doc(uid);
    await userStatsRef.set({
      plansCreatedCount: 0,
      plansSharedOrExperiencedCount: 0,
      postCount: 0,
      followersCount: 0,
      followingCount: 0,
      totalRatingsReceived: 0,
      averageRating: 0,
      lastActivityDate: AdminTimestamp.now(),
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now()
    });
    
    // Create default userNotificationPreferences
    const notificationPrefsRef = db.collection('userNotificationPreferences').doc(uid);
    await notificationPrefsRef.set({
      emailNotifications: true,
      pushNotifications: true,
      planReminders: true,
      marketingEmails: false,
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now()
    });
    
    // Create default userSecurity (empty for now, will be populated when 2FA is enabled)
    const userSecurityRef = db.collection('userSecurity').doc(uid);
    await userSecurityRef.set({
      twoFactorEnabled: false,
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now()
    });
    
    // Create default subscription (free tier)
    const subscriptionRef = db.collection('subscriptions').doc(uid);
    await subscriptionRef.set({
      userId: uid,
      status: 'inactive', // Free tier
      plan: 'free',
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now()
    });
    
    
  } catch (error) {
    console.error(`[createDefaultUserCollections] Error creating default collections for user ${uid}:`, error);
    // Don't throw error - this is not critical for user creation
  }
};

export const createUserProfileAdmin = async (
  uid: string,
  profileData: OnboardingProfileData & { // AuthUserData combined in action
    name: string | null;
    username: string | null;
    email: string | null;
    avatarUrl: string | null;
  }
): Promise<void> => {
  try {
    const userDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, uid);
    const now = FieldValue.serverTimestamp();
    
    // Check if user already exists to avoid overwriting data
    const existingDoc = await userDocRef.get();
    const exists = existingDoc.exists;
    
    // Generate a username if not provided
    let username = profileData.username;
    if (!username) {
      // Try to create a username from email
      if (profileData.email) {
        username = profileData.email.split('@')[0];
      } 
      // If still no username, use name with random numbers
      if (!username && profileData.name) {
        username = profileData.name.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
      }
      // Last resort
      if (!username) {
        username = 'user' + Date.now().toString().slice(-6);
      }
      

    }

    // Complete profile data including all preferences
    const completeProfileData: Record<string, any> = {
      name: profileData.name,
      username: username,
      name_lowercase: profileData.name ? profileData.name.toLowerCase() : null,
      email: profileData.email ? profileData.email.toLowerCase() : null,
      avatarUrl: profileData.avatarUrl,
      role: 'user' as UserRoleType,
      isVerified: false,
      updatedAt: now,
      // Add all preference fields
      allergies: profileData.allergies || [],
      dietaryRestrictions: profileData.dietaryRestrictions || [],
      favoriteCuisines: profileData.favoriteCuisines || [],
      generalPreferences: profileData.generalPreferences || '',
      physicalLimitations: profileData.physicalLimitations || [],
      activityTypePreferences: profileData.activityTypePreferences || [],
      activityTypeDislikes: profileData.activityTypeDislikes || [],
      environmentalSensitivities: profileData.environmentalSensitivities || [],
      travelTolerance: profileData.travelTolerance || '',
      budgetFlexibilityNotes: profileData.budgetFlexibilityNotes || '',
      socialPreferences: profileData.socialPreferences || { preferredGroupSize: null, interactionLevel: null },
      availabilityNotes: profileData.availabilityNotes || '',
    };
    
    // Only set createdAt if this is a new document
    if (!exists) {
      completeProfileData.createdAt = now;
    }

    // Add optional fields if provided
    if (profileData.bio) completeProfileData.bio = profileData.bio;
    if (profileData.physicalAddress) completeProfileData.physicalAddress = profileData.physicalAddress;
    if (profileData.countryDialCode) completeProfileData.countryDialCode = profileData.countryDialCode;
    if (profileData.phoneNumber) completeProfileData.phoneNumber = profileData.phoneNumber;
    if (profileData.birthDate) completeProfileData.birthDate = profileData.birthDate;
    
    // Save complete profile data
    await userDocRef.set(completeProfileData, { merge: true });
    
    // Create default collections for new users
    if (!exists) {
      await createDefaultUserCollections(uid);
    }
    
    
  } catch (error) {
    console.error('[createUserProfileAdmin] Error creating/updating user profile with Admin SDK:', error);
    throw error;
  }
};

export const updateUserProfileAvatarAdmin = async (userId: string, newAvatarUrl: string): Promise<void> => {
  try {
    const userRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, userId);
    await userRef.update({
      avatarUrl: newAvatarUrl,
      updatedAt: AdminTimestamp.now()
    });

    // Also update avatar URL in feed posts
    await updateUserAvatarInFeedAdmin(userId, newAvatarUrl);

    
  } catch (error) {
    console.error(`[updateUserProfileAvatarAdmin] Error updating avatar URL for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Updates a user profile with the provided data
 * @param userId - The user ID to update
 * @param profileData - The profile data to update
 * @returns Promise<void>
 */
export const updateUserProfileAdmin = async (userId: string, profileData: Partial<UserProfile>): Promise<void> => {
  if (!userId) {
    console.error("[updateUserProfileAdmin] Invalid user ID provided");
    throw new Error("Invalid user ID");
  }

  try {
    const userRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, userId);
    // Always update the updatedAt timestamp
    const dataToUpdate = {
      ...profileData,
      updatedAt: AdminTimestamp.now()
    };
    await userRef.update(dataToUpdate);
  } catch (error) {
    console.error(`[updateUserProfileAdmin] Error updating profile for user ${userId}:`, error);
    throw error;
  }
};


const isEmailAdmin = (term: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term);
const isPhoneNumberAdmin = (term: string): boolean => /^\+?[0-9\s-()]+$/.test(term) && term.length > 5;

// Enhanced search result with ranking data
interface SearchResultWithRanking extends SearchedUser {
  score: number;
  matchType: 'email' | 'phone' | 'name_exact' | 'name_prefix' | 'name_substring' | 'username_exact' | 'username_prefix' | 'username_substring';
  mutualFriends?: number;
  locationScore?: number;
}

// Calculate location similarity score (0-1)
const calculateLocationScore = (currentUserLocation: any, targetUserLocation: any): number => {
  if (!currentUserLocation || !targetUserLocation) return 0;
  
  let score = 0;
  if (currentUserLocation.country === targetUserLocation.country) {
    score += 0.3;
    if (currentUserLocation.state === targetUserLocation.state) {
      score += 0.3;
      if (currentUserLocation.city === targetUserLocation.city) {
        score += 0.4;
      }
    }
  }
  return score;
};

// Calculate mutual friends count
const calculateMutualFriends = async (db: Firestore, currentUserId: string, targetUserId: string): Promise<number> => {
  try {
    const currentUserFriendsRef = db.collection(USER_COLLECTION).doc(currentUserId).collection(FRIENDSHIPS_SUBCOLLECTION);
    const targetUserFriendsRef = db.collection(USER_COLLECTION).doc(targetUserId).collection(FRIENDSHIPS_SUBCOLLECTION);
    
    const [currentFriends, targetFriends] = await Promise.all([
      currentUserFriendsRef.where('status', '==', 'friends').get(),
      targetUserFriendsRef.where('status', '==', 'friends').get()
    ]);
    
    const currentFriendIds = new Set(currentFriends.docs.map(doc => doc.id));
    const targetFriendIds = new Set(targetFriends.docs.map(doc => doc.id));
    
    return Array.from(currentFriendIds).filter(id => targetFriendIds.has(id)).length;
  } catch (e) {
    console.error('[calculateMutualFriends] Error:', e);
    return 0;
  }
};

// Check if text contains search term (case-insensitive)
const containsText = (text: string | null, searchTerm: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
};

// Check if text starts with search term (case-insensitive)
const startsWithText = (text: string | null, searchTerm: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().startsWith(searchTerm.toLowerCase());
};

// Check if text exactly matches search term (case-insensitive)
const exactMatch = (text: string | null, searchTerm: string): boolean => {
  if (!text) return false;
  return text.toLowerCase() === searchTerm.toLowerCase();
};

export const searchUsersAdmin = async (searchTerm: string, currentUserId: string): Promise<SearchedUser[]> => {

  const db = firestoreAdmin as Firestore;
  const trimmedSearchTerm = searchTerm.trim();
  if (!trimmedSearchTerm) return [];

  const usersRef = db.collection(USER_COLLECTION);
  const resultsMap = new Map<string, SearchResultWithRanking>();
  const SEARCH_LIMIT = 50; // Get more results for better ranking
  const FINAL_LIMIT = 15; // Return top 15 after ranking

  // Get current user's data for location comparison
  let currentUserData: UserProfile | null = null;
  try {
    const currentUserDoc = await usersRef.doc(currentUserId).get();
    if (currentUserDoc.exists) {
      currentUserData = currentUserDoc.data() as UserProfile;
    }
  } catch (e) {
    console.error('[searchUsersAdmin] Error fetching current user data:', e);
  }

  // Get current user's friendships
  const currentUserFriendshipsRef = usersRef.doc(currentUserId).collection(FRIENDSHIPS_SUBCOLLECTION);
  const friendshipsSnapshot = await currentUserFriendshipsRef.get();
  
  const friendshipStatuses = new Map<string, FriendStatus>();
  
  friendshipsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data();
    if (!data.status) return;
    
    const otherUserId = doc.id;
    friendshipStatuses.set(otherUserId, data.status as FriendStatus);
  });

  const addUserToResults = (docSnap: QueryDocumentSnapshot, matchType: SearchResultWithRanking['matchType'], baseScore: number) => {
    if (docSnap.id === currentUserId || resultsMap.has(docSnap.id)) return;
    
    const data = docSnap.data() as UserProfile;
    const userObj: SearchResultWithRanking = {
      uid: docSnap.id,
      name: data.name || null,
      username: data.username || null,
      email: data.email || null,
      avatarUrl: data.avatarUrl || null,
      role: data.role || 'user',
      isVerified: data.isVerified || false,
      friendshipStatus: friendshipStatuses.get(docSnap.id) || 'not_friends',
      score: baseScore,
      matchType,
      locationScore: currentUserData ? calculateLocationScore(currentUserData.physicalAddress, data.physicalAddress) : 0
    };
    resultsMap.set(docSnap.id, userObj);
  };

  // Search by Email (exact match, case-insensitive) - Highest priority
  if (isEmailAdmin(trimmedSearchTerm)) {
    try {
      const emailQuerySnapshot = await usersRef
        .where("email", "==", trimmedSearchTerm.toLowerCase())
        .limit(SEARCH_LIMIT)
        .get();
      emailQuerySnapshot.forEach((docSnap: QueryDocumentSnapshot) => {
        addUserToResults(docSnap, 'email', 100);
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during email search:", e); }
  }

  // Search by Phone Number (exact match) - High priority
  if (resultsMap.size < SEARCH_LIMIT && isPhoneNumberAdmin(trimmedSearchTerm)) {
     try {
      const phoneQuerySnapshot = await usersRef
        .where("phoneNumber", "==", trimmedSearchTerm) 
        .limit(SEARCH_LIMIT - resultsMap.size)
        .get();
      phoneQuerySnapshot.forEach((docSnap: QueryDocumentSnapshot) => {
        addUserToResults(docSnap, 'phone', 95);
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during phone search:", e); }
  }

  // For non-email/phone searches, do comprehensive text matching
  if (resultsMap.size < SEARCH_LIMIT && !isEmailAdmin(trimmedSearchTerm) && !isPhoneNumberAdmin(trimmedSearchTerm)) {
    try {
      // Get a broader set of users to search through
      const allUsersSnapshot = await usersRef.limit(500).get();
      
      allUsersSnapshot.forEach((docSnap: QueryDocumentSnapshot) => {
        if (docSnap.id === currentUserId || resultsMap.has(docSnap.id)) return;
        
        const data = docSnap.data() as UserProfile;
        const name = data.name || null;
        const username = data.username || null;
        
        // Check for exact matches first (highest scores)
        if (exactMatch(name, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'name_exact', 90);
        } else if (exactMatch(username, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'username_exact', 85);
        }
        // Check for prefix matches (high scores)
        else if (startsWithText(name, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'name_prefix', 80);
        } else if (startsWithText(username, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'username_prefix', 75);
        }
        // Check for substring matches (medium scores)
        else if (containsText(name, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'name_substring', 60);
        } else if (containsText(username, trimmedSearchTerm)) {
          addUserToResults(docSnap, 'username_substring', 55);
        }
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during comprehensive search:", e); }
  }

  // Calculate mutual friends for ranking (async operation)
  const resultsArray = Array.from(resultsMap.values());
  const mutualFriendsPromises = resultsArray.map(async (user) => {
    const mutualFriends = await calculateMutualFriends(db, currentUserId, user.uid);
    user.mutualFriends = mutualFriends;
    return user;
  });

  const resultsWithMutualFriends = await Promise.all(mutualFriendsPromises);

  // Enhanced ranking algorithm
  const rankedResults = resultsWithMutualFriends
    .map(user => {
      let finalScore = user.score;
      
      // Boost score based on mutual friends (up to +20 points)
      if (user.mutualFriends && user.mutualFriends > 0) {
        finalScore += Math.min(user.mutualFriends * 5, 20);
      }
      
      // Boost score based on location proximity (up to +15 points)
      if (user.locationScore && user.locationScore > 0) {
        finalScore += user.locationScore * 15;
      }
      
      // Boost verified users slightly (+5 points)
      if (user.isVerified) {
        finalScore += 5;
      }
      
      // Boost users with friendship status (+10 points)
      if (user.friendshipStatus && user.friendshipStatus !== 'not_friends') {
        finalScore += 10;
      }
      
      return { ...user, score: finalScore };
    })
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, FINAL_LIMIT) // Take top results
    .map(({ score, matchType, mutualFriends, locationScore, ...user }) => user); // Remove ranking metadata

  return rankedResults;
};


export const getFriendUidsAdmin = async (userId: string): Promise<string[]> => {
  try {
    const friendshipsRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.USERS, userId, SUBCOLLECTIONS.FRIENDSHIPS);
    const snapshot = await friendshipsRef.where('status', '==', 'friends').get();

    if (snapshot.empty) {
      return [];
    }
    const friendUids: string[] = snapshot.docs.map(doc => doc.id);
    return friendUids;
  } catch (error) {
    console.error(`[getFriendUidsAdmin] Error fetching friend UIDs for user ${userId}:`, error);
    throw error;
  }
};


export const getUserStatsAdmin = async (userId: string): Promise<UserStats> => {
  try {
    const userProfile = await getUserProfileAdmin(userId); // Fetches full profile including followers/following arrays
    if (!userProfile) {
      console.warn(`[getUserStatsAdmin] User profile not found for UID ${userId}. Returning zero stats.`);
      return { postCount: 0, plansCreatedCount: 0, plansSharedOrExperiencedCount: 0, followersCount: 0, followingCount: 0 };
    }

    const plansRef = FirebaseQueryBuilder.collection(COLLECTIONS.PLANS);
    const feedPostsRef = FirebaseQueryBuilder.collection(COLLECTIONS.FEED_POSTS);
    
    // Count plans created by user (exclude drafts unless they're completed)
    const createdQuery = plansRef
      .where('hostId', '==', userId)
      .where('status', 'in', ['published', 'completed']); // Only count published or completed plans
    const createdSnapshotPromise = createdQuery.count().get();
    
    const experiencedQuery = plansRef
      .where('invitedParticipantUserIds', 'array-contains', userId)
      .where('status', '==', 'published') // Only count participation in published plans
      .where(`participantResponses.${userId}`, '==', 'going'); 
    const experiencedSnapshotPromise = experiencedQuery.get(); 
    
    const postsQuery = feedPostsRef.where('userId', '==', userId);
    const postsSnapshotPromise = postsQuery.count().get();

    const [createdSnapshot, experiencedSnapshot, postsSnapshot] = await Promise.all([
      createdSnapshotPromise,
      experiencedSnapshotPromise,
      postsSnapshotPromise
    ]);

    const plansCreatedCount = createdSnapshot.data().count;
    
    let plansExperiencedCount = 0;
    experiencedSnapshot.forEach(doc => {
      const planData = doc.data();
      
      // Check if plan is completed and user confirmed completion
      if (planData.status === 'completed' && planData.completionConfirmedBy && 
          planData.completionConfirmedBy.includes(userId)) {
        plansExperiencedCount++;
      } else if (planData.eventTime && planData.status !== 'completed') {
        // Fallback to old logic for plans without completion tracking
        let eventDate;
        if (planData.eventTime instanceof AdminTimestamp) {
            eventDate = planData.eventTime.toDate();
        } else if (typeof planData.eventTime === 'string') {
            eventDate = new Date(planData.eventTime); 
        } else if (typeof planData.eventTime === 'object' && planData.eventTime.seconds !== undefined) {
            eventDate = new Date(planData.eventTime.seconds * 1000);
        } else {
            eventDate = new Date(0); 
        }
        if (eventDate < new Date()) { 
          plansExperiencedCount++;
        }
      }
    });

    const postCount = postsSnapshot.data().count;

    // Get followers/following counts directly from the fetched userProfile
    const followersCount = userProfile?.followers?.length || 0;
    const followingCount = userProfile?.following?.length || 0;

    return { 
      postCount, 
      plansCreatedCount, 
      plansSharedOrExperiencedCount: plansExperiencedCount, 
      followersCount,
      followingCount,
    };
  } catch (error) {
    console.error(`[getUserStatsAdmin] Error fetching stats for user ${userId}:`, error);
    throw error; 
  }
};

// Remove all friend request functions - friendship is now determined by mutual following
// Only keep follow/unfollow functions

// UserProfile type should have isPrivate, pendingFollowRequests, sentFollowRequests
// Update followUserAdmin to handle privacy
export const followUserAdmin = async (currentUserId: string, targetUserId: string): Promise<void> => {
  if (currentUserId === targetUserId) throw new Error("Cannot follow yourself.");
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");

  const [currentUserProfile, targetUserProfile] = await Promise.all([
    getUserProfileAdmin(currentUserId),
    getUserProfileAdmin(targetUserId)
  ]);

  if (!currentUserProfile || !targetUserProfile) {
    throw new Error("Could not fetch one or both user profiles.");
  }

  const currentUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, currentUserId);
  const targetUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, targetUserId);
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  if (targetUserProfile.isPrivate) {
    // Add to pendingFollowRequests and sentFollowRequests
    batch.update(targetUserDocRef, {
      pendingFollowRequests: FieldValue.arrayUnion(currentUserId),
      updatedAt: now
    });
    batch.update(currentUserDocRef, {
      sentFollowRequests: FieldValue.arrayUnion(targetUserId),
      updatedAt: now
    });
    // Add notification for the target user with user info
    const notificationsRef = FirebaseQueryBuilder.collection(COLLECTIONS.USERS).doc(targetUserId).collection('notifications');
    const notificationData: any = {
      type: 'follow_request',
      fromUserId: currentUserId,
      title: 'requested to follow you',
      userName: currentUserProfile.username || currentUserProfile.firstName || currentUserProfile.name || 'Someone',
      createdAt: now,
      isRead: false,
      handled: false // <-- Ensure this is set for actionable requests
    };
    if (currentUserProfile.avatarUrl) {
      notificationData.avatarUrl = currentUserProfile.avatarUrl;
    }
    batch.set(notificationsRef.doc(), notificationData);
  } else {
    // Public: add to followers/following instantly
    batch.update(currentUserDocRef, {
      following: FieldValue.arrayUnion(targetUserId),
      updatedAt: now
    });
    batch.update(targetUserDocRef, {
      followers: FieldValue.arrayUnion(currentUserId),
      updatedAt: now
    });
    // Notify user of new follower
    const notificationData: any = {
      type: 'follow_notice', // CHANGED from 'follow_request'
      title: 'is now following you',
      userName: currentUserProfile.username || currentUserProfile.firstName || currentUserProfile.name || 'Someone',
      actionUrl: `/u/${currentUserId}`,
      isRead: false,
      metadata: { followerId: currentUserId },
      status: 'informational', // Mark as informational so it is not actionable
      handled: true // Mark as handled so it does not show in pending
    };
    if (currentUserProfile.avatarUrl) {
      notificationData.avatarUrl = currentUserProfile.avatarUrl;
    }
    await createNotification(targetUserId, notificationData);
  }
  await batch.commit();
  // --- Friendship sync ---
  await updateFriendshipStatus(currentUserId, targetUserId);
};

// Approve follow request
export const approveFollowRequestAdmin = async (currentUserId: string, requesterId: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const currentUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, currentUserId);
  const requesterDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, requesterId);
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();
  // Remove from pending/sent requests
  batch.update(currentUserDocRef, {
    pendingFollowRequests: FieldValue.arrayRemove(requesterId),
    followers: FieldValue.arrayUnion(requesterId),
    updatedAt: now
  });
  batch.update(requesterDocRef, {
    sentFollowRequests: FieldValue.arrayRemove(currentUserId),
    following: FieldValue.arrayUnion(currentUserId),
    updatedAt: now
  });
  await batch.commit();
  // --- Friendship sync ---
  await updateFriendshipStatus(currentUserId, requesterId);
  // Create informational notification for the target user (currentUserId) that requesterId is now following them
  const requesterProfile = await getUserProfileAdmin(requesterId);
  if (requesterProfile) {
    const notificationData: any = {
      type: 'follow_notice', // CHANGED from 'follow_request'
      title: 'is now following you',
      userName: requesterProfile.username || requesterProfile.firstName || requesterProfile.name || 'Someone',
      actionUrl: `/u/${requesterId}`,
      isRead: false,
      metadata: { followerId: requesterId },
      status: 'informational',
      handled: true
    };
    if (requesterProfile.avatarUrl) {
      notificationData.avatarUrl = requesterProfile.avatarUrl;
    }
    await createNotification(currentUserId, notificationData);
  }
};

// Deny follow request
export const denyFollowRequestAdmin = async (currentUserId: string, requesterId: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const currentUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, currentUserId);
  const requesterDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, requesterId);
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();
  batch.update(currentUserDocRef, {
    pendingFollowRequests: FieldValue.arrayRemove(requesterId),
    updatedAt: now
  });
  batch.update(requesterDocRef, {
    sentFollowRequests: FieldValue.arrayRemove(currentUserId),
    updatedAt: now
  });
  await batch.commit();
};

export const unfollowUserAdmin = async (currentUserId: string, targetUserId: string): Promise<void> => {
  if (currentUserId === targetUserId) throw new Error("Cannot unfollow yourself.");
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");

  const currentUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, currentUserId);
  const targetUserDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.USERS, targetUserId);

  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  // Remove from current users following list
  batch.update(currentUserDocRef, {
    following: FieldValue.arrayRemove(targetUserId),
    updatedAt: now
  });

  // Remove from target users followers list
  batch.update(targetUserDocRef, {
    followers: FieldValue.arrayRemove(currentUserId),
    updatedAt: now
  });

  await batch.commit();
  // --- Friendship sync ---
  await updateFriendshipStatus(currentUserId, targetUserId);
  
};

// === Premium Status and Activity Score Functions ===
// Moved from userService.admin.ts during consolidation

export const calculateUserPremiumStatus = async (userId: string): Promise<boolean> => {
  try {
    // Get user's subscription data from a subscriptions collection
    const subscriptionDoc = await FirebaseQueryBuilder
      .getFilteredQuery(COLLECTIONS.SUBSCRIPTIONS, [
        ['userId', '==', userId],
        ['status', '==', 'active']
      ], { limit: 1 })
      .get();

    return !subscriptionDoc.empty;
  } catch (error) {
    console.error('[calculateUserPremiumStatus] Error checking premium status:', error);
    return false;
  }
};

export const calculateUserActivityScore = async (userId: string): Promise<number> => {
  try {
    const userStats = await getUserStatsAdmin(userId);
    const userProfile = await getUserProfileAdmin(userId);

    if (!userStats || !userProfile) {
      return 0;
    }

    // Base score calculation
    let activityScore = 0;

    // Plans contribution (40% of total score)
    const plansScore = (userStats.plansCreatedCount * 2) + userStats.plansSharedOrExperiencedCount;
    activityScore += Math.min(40, (plansScore / 10) * 40); // Cap at 40 points

    // Social engagement (30% of total score)
    const socialScore = userStats.postCount + (userStats.followersCount * 0.5) + (userStats.followingCount * 0.5);
    activityScore += Math.min(30, (socialScore / 20) * 30); // Cap at 30 points

    // Event attendance (30% of total score)
    const attendanceScore = userProfile.eventAttendanceScore;
    activityScore += Math.min(30, (attendanceScore / 100) * 30); // Cap at 30 points

    return Math.round(activityScore);
  } catch (error) {
    console.error('[calculateUserActivityScore] Error calculating activity score:', error);
    return 0;
  }
};

// --- Unified Friendship Status Helper ---
async function updateFriendshipStatus(userA: string, userB: string) {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const [profileA, profileB] = await Promise.all([
    getUserProfileAdmin(userA),
    getUserProfileAdmin(userB)
  ]);
  if (!profileA || !profileB) return;
  const aFollowsB = profileA.following?.includes(userB);
  const bFollowsA = profileB.following?.includes(userA);
  const friendshipsARef = FirebaseQueryBuilder.subcollection(COLLECTIONS.USERS, userA, 'friendships').doc(userB);
  const friendshipsBRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.USERS, userB, 'friendships').doc(userA);
  const now = FieldValue.serverTimestamp();
  if (aFollowsB && bFollowsA) {
    // Mutual: set both to friends
    await Promise.all([
      friendshipsARef.set({
        friendUid: userB,
        status: 'friends',
        friendsSince: now
      }, { merge: true }),
      friendshipsBRef.set({
        friendUid: userA,
        status: 'friends',
        friendsSince: now
      }, { merge: true })
    ]);
  } else if (aFollowsB) {
    // A sent request or is following B
    await Promise.all([
      friendshipsARef.set({
        friendUid: userB,
        status: 'pending_sent',
        requestedAt: now
      }, { merge: true }),
      friendshipsBRef.set({
        friendUid: userA,
        status: 'pending_received',
        requestedAt: now
      }, { merge: true })
    ]);
  } else if (bFollowsA) {
    // B sent request or is following A
    await Promise.all([
      friendshipsARef.set({
        friendUid: userB,
        status: 'pending_received',
        requestedAt: now
      }, { merge: true }),
      friendshipsBRef.set({
        friendUid: userA,
        status: 'pending_sent',
        requestedAt: now
      }, { merge: true })
    ]);
  } else {
    // No relationship
    await Promise.all([
      friendshipsARef.delete(),
      friendshipsBRef.delete()
    ]);
  }
}
