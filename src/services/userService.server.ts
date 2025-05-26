// src/services/userService.server.ts
import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { UserProfile, OnboardingProfileData, FriendEntry, SearchedUser, UserRoleType, UserStats, FriendStatus, AppTimestamp } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue } from 'firebase-admin/firestore';
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

    const combinedPreferences = Array.from(new Set([
        ...(profileData.allergies || []),
        ...(profileData.dietaryRestrictions || []),
        ...(profileData.favoriteCuisines || []),
        ...(profileData.activityTypePreferences || []),
        ...(profileData.activityTypeDislikes || []), // Ensure these are distinct strings
        ...(profileData.physicalLimitations || []),
        ...(profileData.environmentalSensitivities || []),
        ...(profileData.generalPreferences && profileData.generalPreferences.trim() !== '' ? [profileData.generalPreferences.trim()] : []),
      ].filter(p => typeof p === 'string' && p.trim() !== '')));


    const fullProfileData: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt' | 'birthDate'> & { createdAt: FieldValue; updatedAt: FieldValue, birthDate: AdminTimestamp | null } = {
      name: profileData.name,
      name_lowercase: profileData.name ? profileData.name.toLowerCase() : null,
      email: profileData.email ? profileData.email.toLowerCase() : null,
      avatarUrl: profileData.avatarUrl,
      bio: profileData.bio || null,
      countryDialCode: profileData.countryDialCode || null,
      phoneNumber: profileData.phoneNumber || null,
      birthDate: profileData.birthDate ? AdminTimestamp.fromDate(new Date(profileData.birthDate)) : null,
      physicalAddress: profileData.physicalAddress || null,
      
      allergies: profileData.allergies || [],
      dietaryRestrictions: profileData.dietaryRestrictions || [],
      generalPreferences: profileData.generalPreferences || '',
      favoriteCuisines: profileData.favoriteCuisines || [],
      physicalLimitations: profileData.physicalLimitations || [],
      activityTypePreferences: profileData.activityTypePreferences || [],
      activityTypeDislikes: profileData.activityTypeDislikes || [],
      environmentalSensitivities: profileData.environmentalSensitivities || [],
      
      travelTolerance: profileData.travelTolerance || '',
      budgetFlexibilityNotes: profileData.budgetFlexibilityNotes || '',
      socialPreferences: profileData.socialPreferences || null,
      availabilityNotes: profileData.availabilityNotes || '',
      
      preferences: combinedPreferences, // Use the combined and filtered list
      
      followers: [], 
      following: [], 
      
      eventAttendanceScore: 0,
      levelTitle: 'Newbie Planner',
      levelStars: 1,
      role: 'user' as UserRoleType,
      isVerified: false,
      
      createdAt: now,
      updatedAt: now,
    };

    await userDocRef.set(fullProfileData, { merge: true }); // Use merge: true if profile might partially exist
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
    const userDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(userId);
    await userDocRef.update({
      avatarUrl: newAvatarUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[updateUserProfileAvatarAdmin] Avatar URL updated for user ${userId}.`);

    // Update avatar URL in all feed posts and comments
    await updateUserAvatarInFeedAdmin(userId, newAvatarUrl);
  } catch (error) {
    console.error(`[updateUserProfileAvatarAdmin] Error updating avatar URL for user ${userId}:`, error);
    throw error;
  }
};


const isEmailAdmin = (term: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term);
const isPhoneNumberAdmin = (term: string): boolean => /^\+?[0-9\s-()]+$/.test(term) && term.length > 5;

export const searchUsersAdmin = async (searchTerm: string, currentUserId: string): Promise<SearchedUser[]> => {
  if (!firestoreAdmin) {
    console.error("[searchUsersAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  const trimmedSearchTerm = searchTerm.trim();
  if (!trimmedSearchTerm) return [];

  const usersRef = firestoreAdmin.collection(USER_COLLECTION);
  const resultsMap = new Map<string, SearchedUser>();
  const FINAL_LIMIT = 10; 

  // Search by Email (exact match, case-insensitive)
  if (isEmailAdmin(trimmedSearchTerm)) {
    try {
      const emailQuerySnapshot = await usersRef
        .where("email", "==", trimmedSearchTerm.toLowerCase())
        .limit(FINAL_LIMIT)
        .get();
      emailQuerySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUserId) { 
          const data = docSnap.data() as UserProfile;
          resultsMap.set(docSnap.id, {
            uid: docSnap.id, name: data.name, email: data.email, avatarUrl: data.avatarUrl,
            role: data.role || 'user', isVerified: data.isVerified || false
          });
        }
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during email search:", e); }
  }

  // Search by Phone Number (exact match)
  if (resultsMap.size < FINAL_LIMIT && isPhoneNumberAdmin(trimmedSearchTerm)) {
     try {
      const phoneQuerySnapshot = await usersRef
        .where("phoneNumber", "==", trimmedSearchTerm) 
        .limit(FINAL_LIMIT - resultsMap.size)
        .get();
      phoneQuerySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUserId && !resultsMap.has(docSnap.id)) { 
          const data = docSnap.data() as UserProfile;
          resultsMap.set(docSnap.id, {
            uid: docSnap.id, name: data.name, email: data.email, avatarUrl: data.avatarUrl,
            role: data.role || 'user', isVerified: data.isVerified || false
          });
        }
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during phone search:", e); }
  }
  
  // Search by Name (prefix match, case-insensitive using name_lowercase)
  if (resultsMap.size < FINAL_LIMIT && !isEmailAdmin(trimmedSearchTerm) && !isPhoneNumberAdmin(trimmedSearchTerm)) {
    const lowerSearchTermForName = trimmedSearchTerm.toLowerCase();
    try {
      const nameQuerySnapshot = await usersRef
        .orderBy("name_lowercase")
        .startAt(lowerSearchTermForName)
        .endAt(lowerSearchTermForName + '\uf8ff')
        .limit(FINAL_LIMIT - resultsMap.size)
        .get();
      nameQuerySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUserId && !resultsMap.has(docSnap.id)) { 
          const data = docSnap.data() as UserProfile;
          resultsMap.set(docSnap.id, {
            uid: docSnap.id, name: data.name, email: data.email, avatarUrl: data.avatarUrl,
            role: data.role || 'user', isVerified: data.isVerified || false
          });
        }
      });
    } catch (e) { console.error("[searchUsersAdmin] Error during name search:", e); }
  }
  
  return Array.from(resultsMap.values());
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
      if (planData.eventTime) {
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
