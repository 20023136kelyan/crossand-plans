// src/services/userService.server.ts
import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { UserProfile, OnboardingProfileData, FriendEntry, SearchedUser, UserRoleType, UserStats, FriendStatus, AppTimestamp } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue, DocumentSnapshot, QueryDocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin'; // For FieldPath.documentId()
import { updateUserAvatarInFeedAdmin } from './feedService.server';

const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';
const PLANS_COLLECTION = 'plans'; // For plan counts
const FEED_POSTS_COLLECTION = 'feedPosts'; // For post counts

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
  if (!firestoreAdmin) {
    console.error("[getUserProfileAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  if (!uid) {
    console.warn("[getUserProfileAdmin] UID not provided.");
    return null;
  }
  try {
    const userDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(uid);
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
  if (!firestoreAdmin) {
    console.error("[getUsersProfilesAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
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
        const userDocRefs = chunk.map(uid => firestoreAdmin.collection(USER_COLLECTION).doc(uid));
        const userDocSnaps = await firestoreAdmin.getAll(...userDocRefs);

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

export const createUserProfileAdmin = async (
  uid: string,
  profileData: OnboardingProfileData & { // AuthUserData combined in action
    name: string | null;
    username: string | null;
    email: string | null;
    avatarUrl: string | null;
  }
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[createUserProfileAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  try {
    const userDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(uid);
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
      
      console.log(`[createUserProfileAdmin] Generated username '${username}' for user ${uid}`);
    }

    // Simplified profile data with only essential fields
    const basicProfileData: Record<string, any> = {
      name: profileData.name,
      username: username,
      name_lowercase: profileData.name ? profileData.name.toLowerCase() : null,
      email: profileData.email ? profileData.email.toLowerCase() : null,
      avatarUrl: profileData.avatarUrl,
      role: 'user' as UserRoleType,
      isVerified: false,
      updatedAt: now,
    };
    
    // Only set createdAt if this is a new document
    if (!exists) {
      basicProfileData.createdAt = now;
    }

    // Only add these fields if they're explicitly provided
    if (profileData.bio) basicProfileData.bio = profileData.bio;
    if (profileData.physicalAddress) basicProfileData.physicalAddress = profileData.physicalAddress;
    if (profileData.countryDialCode) basicProfileData.countryDialCode = profileData.countryDialCode;
    if (profileData.phoneNumber) basicProfileData.phoneNumber = profileData.phoneNumber;
    
    // Only set explicitly provided fields to avoid creating default arrays and values
    await userDocRef.set(basicProfileData, { merge: true });
    console.log('[createUserProfileAdmin] User profile created/updated successfully with Admin SDK for UID:', uid);
  } catch (error) {
    console.error('[createUserProfileAdmin] Error creating/updating user profile with Admin SDK:', error);
    throw error;
  }
};

export const updateUserProfileAvatarAdmin = async (userId: string, newAvatarUrl: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[updateUserProfileAvatarAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  try {
    const userRef = firestoreAdmin.collection(USER_COLLECTION).doc(userId);
    await userRef.update({
      avatarUrl: newAvatarUrl,
      updatedAt: AdminTimestamp.now()
    });

    // Also update avatar URL in feed posts
    await updateUserAvatarInFeedAdmin(userId, newAvatarUrl);

    console.log(`[updateUserProfileAvatarAdmin] Updated avatar URL for user ${userId}`);
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
  if (!firestoreAdmin) {
    console.error("[updateUserProfileAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }

  if (!userId) {
    console.error("[updateUserProfileAdmin] Invalid user ID provided");
    throw new Error("Invalid user ID");
  }

  try {
    console.log(`[updateUserProfileAdmin] Updating profile for user ${userId}`, {
      fieldsToUpdate: Object.keys(profileData)
    });
    
    const userRef = firestoreAdmin.collection(USER_COLLECTION).doc(userId);
    
    // Always update the updatedAt timestamp
    const dataToUpdate = {
      ...profileData,
      updatedAt: AdminTimestamp.now()
    };
    
    await userRef.update(dataToUpdate);
    
    console.log(`[updateUserProfileAdmin] Successfully updated profile for user ${userId}`);
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
  if (!firestoreAdmin) {
    console.error("[searchUsersAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }

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
      name: data.name,
      username: data.username || null,
      email: data.email,
      avatarUrl: data.avatarUrl,
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
        const name = data.name;
        const username = data.username;
        
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


export const sendFriendRequestAdmin = async (
  fromUserProfile: UserProfile, 
  toUserProfile: UserProfile    
): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  if (fromUserProfile.uid === toUserProfile.uid) throw new Error("Cannot send friend request to oneself.");

  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  const senderRef = firestoreAdmin.collection(USER_COLLECTION).doc(fromUserProfile.uid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(toUserProfile.uid);
  const senderEntry: Omit<FriendEntry, 'friendUid' | 'requestedAt' | 'friendsSince'> & { requestedAt: FieldValue } = {
    status: 'pending_sent',
    name: toUserProfile.name,
    avatarUrl: toUserProfile.avatarUrl,
    role: toUserProfile.role,
    isVerified: toUserProfile.isVerified,
    requestedAt: now,
  };
  batch.set(senderRef, senderEntry);

  const receiverRef = firestoreAdmin.collection(USER_COLLECTION).doc(toUserProfile.uid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(fromUserProfile.uid);
  const receiverEntry: Omit<FriendEntry, 'friendUid' | 'requestedAt' | 'friendsSince'> & { requestedAt: FieldValue } = {
    status: 'pending_received',
    name: fromUserProfile.name,
    avatarUrl: fromUserProfile.avatarUrl,
    role: fromUserProfile.role,
    isVerified: fromUserProfile.isVerified,
    requestedAt: now,
  };
  batch.set(receiverRef, receiverEntry);

  try {
    await batch.commit();
  } catch (error) {
    console.error("[sendFriendRequestAdmin] Error sending friend request (Admin SDK):", error);
    throw error;
  }
};

export const acceptFriendRequestAdmin = async (
    currentUserProfile: UserProfile, 
    requesterProfile: UserProfile     
): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();
  
  const currentUserUid = currentUserProfile.uid;
  const requesterUid = requesterProfile.uid;

  // Update friendship entries to 'friends'
  const currentUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(requesterUid);
  batch.set(currentUserFriendshipRef, { // Use set with merge to update or create if it was somehow missing
    status: 'friends' as FriendStatus,
    friendsSince: now,
    name: requesterProfile.name, 
    avatarUrl: requesterProfile.avatarUrl,
    role: requesterProfile.role,
    isVerified: requesterProfile.isVerified,
    requestedAt: now, // or keep existing requestedAt if needed
  }, { merge: true });

  const requesterFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(requesterUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserUid);
  batch.set(requesterFriendshipRef, { // Use set with merge
    status: 'friends' as FriendStatus,
    friendsSince: now,
    name: currentUserProfile.name, 
    avatarUrl: currentUserProfile.avatarUrl,
    role: currentUserProfile.role,
    isVerified: currentUserProfile.isVerified,
    requestedAt: now,
  }, { merge: true });

  // Update followers/following arrays for mutual follow
  const currentUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid);
  const requesterDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(requesterUid);

  batch.update(currentUserDocRef, {
    following: FieldValue.arrayUnion(requesterUid),
    followers: FieldValue.arrayUnion(requesterUid),
    updatedAt: now
  });
  batch.update(requesterDocRef, {
    following: FieldValue.arrayUnion(currentUserUid),
    followers: FieldValue.arrayUnion(currentUserUid),
    updatedAt: now
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error("[acceptFriendRequestAdmin] Error accepting friend request (Admin SDK):", error);
    throw error;
  }
};

export const declineOrCancelFriendRequestAdmin = async (currentUserUid: string, otherUserUid: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const batch = firestoreAdmin.batch();

  const currentUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(otherUserUid);
  batch.delete(currentUserFriendshipRef);

  const otherUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(otherUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserUid);
  batch.delete(otherUserFriendshipRef);

  // Note: This action does NOT automatically unfollow. 
  // If a request is declined, it doesn't mean an existing follow (if any) should be removed.
  // Unfollowing is a separate action.

  try {
    await batch.commit();
  } catch (error) {
    console.error("[declineOrCancelFriendRequestAdmin] Error declining/cancelling friend request (Admin SDK):", error);
    throw error;
  }
};

export const removeFriendAdmin = async (currentUserUid: string, friendUid: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Server configuration error: Database service not available.");
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  // Delete friendship entries
  const currentUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(friendUid);
  batch.delete(currentUserFriendshipRef);
  const friendFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(friendUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserUid);
  batch.delete(friendFriendshipRef);

  // Unfollow each other
  const currentUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid);
  const friendDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(friendUid);

  batch.update(currentUserDocRef, {
    following: FieldValue.arrayRemove(friendUid),
    // Followers list of currentUser is affected by friendUid unfollowing *them*, which is a separate action.
    // This action is currentUser unfriending (and thus unfollowing) friendUid.
    // And friendUid is also unfollowing currentUser.
    followers: FieldValue.arrayRemove(friendUid), 
    updatedAt: now
  });
  batch.update(friendDocRef, {
    following: FieldValue.arrayRemove(currentUserUid), 
    followers: FieldValue.arrayRemove(currentUserUid),
    updatedAt: now
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error("[removeFriendAdmin] Error removing friend (Admin SDK):", error);
    throw error;
  }
};

export const getFriendUidsAdmin = async (userId: string): Promise<string[]> => {
  if (!firestoreAdmin) {
    console.error("[getFriendUidsAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  try {
    const friendshipsRef = firestoreAdmin.collection(USER_COLLECTION).doc(userId).collection(FRIENDSHIPS_SUBCOLLECTION);
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
  if (!firestoreAdmin) {
    console.error("[getUserStatsAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  try {
    const userProfile = await getUserProfileAdmin(userId); // Fetches full profile including followers/following arrays
    if (!userProfile) {
      console.warn(`[getUserStatsAdmin] User profile not found for UID ${userId}. Returning zero stats.`);
      return { postCount: 0, plansCreatedCount: 0, plansSharedOrExperiencedCount: 0, followersCount: 0, followingCount: 0 };
    }

    const plansRef = firestoreAdmin.collection(PLANS_COLLECTION);
    const feedPostsRef = firestoreAdmin.collection(FEED_POSTS_COLLECTION);
    
    const createdQuery = plansRef.where('hostId', '==', userId);
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
      if (planData.isCompleted && planData.completionConfirmedBy && 
          planData.completionConfirmedBy.includes(userId)) {
        plansExperiencedCount++;
      } else if (planData.eventTime && !planData.isCompleted) {
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

export const followUserAdmin = async (currentUserId: string, targetUserId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[followUserAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  if (currentUserId === targetUserId) throw new Error("Cannot follow yourself.");

  const currentUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserId);
  const targetUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(targetUserId);
  const now = FieldValue.serverTimestamp();
  const batch = firestoreAdmin.batch();

  batch.update(currentUserDocRef, { following: FieldValue.arrayUnion(targetUserId), updatedAt: now });
  batch.update(targetUserDocRef, { followers: FieldValue.arrayUnion(currentUserId), updatedAt: now });

  // Check for mutual follow to establish/update friendship
  try {
    // To check for mutuality, we need the target user's data *before* this batch commits to see their current 'following' list.
    // Or, assume this follow action might complete a mutual follow initiated by a friend request.
    // For simplicity in this batch, we'll optimistically set/update friendship if this follow completes a mutual one.
    // This requires fetching both profiles to get current name/avatar.
    const [currentUserProfile, targetUserProfile] = await Promise.all([
        getUserProfileAdmin(currentUserId),
        getUserProfileAdmin(targetUserId)
    ]);

    if (!currentUserProfile || !targetUserProfile) {
        console.warn("[followUserAdmin] Could not fetch one or both profiles for friendship update. Skipping friendship subcollection update.");
    } else {
        // Check if target is ALREADY following current user (before this transaction)
        const targetIsFollowingCurrentUser = (targetUserProfile.following || []).includes(currentUserId);
        
        if (targetIsFollowingCurrentUser) { // This follow by current user makes it mutual
            const currentUserFriendshipRef = currentUserDocRef.collection(FRIENDSHIPS_SUBCOLLECTION).doc(targetUserId);
            batch.set(currentUserFriendshipRef, {
                status: 'friends' as FriendStatus,
                friendsSince: now,
                name: targetUserProfile.name,
                avatarUrl: targetUserProfile.avatarUrl,
                role: targetUserProfile.role,
                isVerified: targetUserProfile.isVerified,
            }, { merge: true });

            const targetUserFriendshipRef = targetUserDocRef.collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserId);
            batch.set(targetUserFriendshipRef, {
                status: 'friends' as FriendStatus,
                friendsSince: now,
                name: currentUserProfile.name,
                avatarUrl: currentUserProfile.avatarUrl,
                role: currentUserProfile.role,
                isVerified: currentUserProfile.isVerified,
            }, { merge: true });
            console.log(`[followUserAdmin] Mutual follow established between ${currentUserId} and ${targetUserId}. Friendship status updated.`);
        } else {
             console.log(`[followUserAdmin] ${currentUserId} followed ${targetUserId}. Not yet mutual for friendship status.`);
        }
    }
    await batch.commit();
  } catch (error) {
    console.error(`Error in followUserAdmin (${currentUserId} -> ${targetUserId}):`, error);
    // If batch.commit() fails, the whole operation is rolled back.
    throw error;
  }
};

export const unfollowUserAdmin = async (currentUserId: string, targetUserId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[unfollowUserAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }

  const currentUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserId);
  const targetUserDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(targetUserId);
  const now = FieldValue.serverTimestamp();
  const batch = firestoreAdmin.batch();

  batch.update(currentUserDocRef, { following: FieldValue.arrayRemove(targetUserId), updatedAt: now });
  batch.update(targetUserDocRef, { followers: FieldValue.arrayRemove(currentUserId), updatedAt: now });

  // Unfollowing breaks any "friends" status, so delete friendship entries.
  const currentUserFriendshipRef = currentUserDocRef.collection(FRIENDSHIPS_SUBCOLLECTION).doc(targetUserId);
  batch.delete(currentUserFriendshipRef);
  const targetUserFriendshipRef = targetUserDocRef.collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserId);
  batch.delete(targetUserFriendshipRef);
  console.log(`[unfollowUserAdmin] Friendship entries between ${currentUserId} and ${targetUserId} marked for deletion.`);

  try {
    await batch.commit();
  } catch (error) {
    console.error(`Error in unfollowUserAdmin (${currentUserId} -> ${targetUserId}):`, error);
    throw error;
  }
};
