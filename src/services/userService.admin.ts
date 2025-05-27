// src/services/userService.admin.ts
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { UserProfile, OnboardingProfileData, FriendEntry, FriendStatus, SearchedUser } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue, Firestore } from 'firebase-admin/firestore';

const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';

interface UserStats {
  plansCreatedCount: number;
  plansSharedOrExperiencedCount: number;
  totalRatingsReceived: number;
  averageRating: number;
  lastActivityDate: Date;
}

interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  eventAttendanceScore: number;
  levelTitle: string;
  levelStars: number;
  createdAt: Date;
  updatedAt: Date;
}

export const getUserStatsAdmin = async (userId: string): Promise<UserStats | null> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const db = firestoreAdmin as Firestore;

  try {
    const statsDoc = await db.collection('userStats').doc(userId).get();
    
    if (!statsDoc.exists) {
      return null;
    }

    const data = statsDoc.data();
    return {
      plansCreatedCount: data?.plansCreatedCount || 0,
      plansSharedOrExperiencedCount: data?.plansSharedOrExperiencedCount || 0,
      totalRatingsReceived: data?.totalRatingsReceived || 0,
      averageRating: data?.averageRating || 0,
      lastActivityDate: data?.lastActivityDate?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('[getUserStatsAdmin] Error fetching user stats:', error);
    return null;
  }
};

export const getUserProfileAdmin = async (userId: string): Promise<UserProfile | null> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const db = firestoreAdmin as Firestore;

  try {
    const profileDoc = await db.collection('users').doc(userId).get();
    
    if (!profileDoc.exists) {
      return null;
    }

    const data = profileDoc.data();
    return {
      userId: profileDoc.id,
      displayName: data?.displayName || '',
      email: data?.email || '',
      photoURL: data?.photoURL || '',
      eventAttendanceScore: data?.eventAttendanceScore || 0,
      levelTitle: calculateLevelTitle(data?.eventAttendanceScore || 0),
      levelStars: calculateLevelStars(data?.eventAttendanceScore || 0),
      createdAt: data?.createdAt?.toDate() || new Date(),
      updatedAt: data?.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('[getUserProfileAdmin] Error fetching user profile:', error);
    return null;
  }
};

function calculateLevelTitle(score: number): string {
  if (score >= 90) return "Master Planner";
  if (score >= 70) return "Expert Planner";
  if (score >= 50) return "Advanced Planner";
  if (score >= 30) return "Intermediate Planner";
  if (score >= 10) return "Beginner Planner";
  return "Newbie Planner";
}

function calculateLevelStars(score: number): number {
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  if (score >= 10) return 1;
  return 0;
}

export const getUsersProfilesAdmin = async (uids: string[]): Promise<UserProfile[]> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for getUsersProfilesAdmin.");
    return [];
  }
  if (!uids || uids.length === 0) {
    return [];
  }

  try {
    const profiles: UserProfile[] = [];
    const MAX_GET_ALL_COUNT = 30; 
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
            profiles.push({ 
              uid: docSnap.id, 
              ...data,
              birthDate: data.birthDate instanceof AdminTimestamp ? data.birthDate : (data.birthDate && typeof data.birthDate.toDate === 'function' ? data.birthDate.toDate() : null),
              createdAt: data.createdAt instanceof AdminTimestamp ? data.createdAt : (data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : AdminTimestamp.now()),
              updatedAt: data.updatedAt instanceof AdminTimestamp ? data.updatedAt : (data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : AdminTimestamp.now()),
            } as UserProfile);
          } else {
            console.warn(`Profile not found for UID (admin SDK): ${docSnap.id}`);
          }
        });
    }
    return profiles;
  } catch (error) {
    console.error('Error fetching multiple user profiles (admin SDK):', error);
    return [];
  }
};

export const createUserProfileAdmin = async (
  uid: string,
  profileData: Omit<OnboardingProfileData, 'selectedCountryCode' | 'birthDate'> & { 
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    birthDate?: string | null; 
  }
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for createUserProfileAdmin.");
    throw new Error("Firestore Admin SDK not available");
  }
  try {
    const userDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(uid);

    const fullProfileData: Omit<UserProfile, 'uid'> = {
      name: profileData.name,
      email: profileData.email ? profileData.email.toLowerCase() : null,
      avatarUrl: profileData.avatarUrl,
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
      preferences: [
        ...(profileData.allergies || []),
        ...(profileData.dietaryRestrictions || []),
        ...(profileData.favoriteCuisines || []),
        ...(profileData.activityTypePreferences || []),
      ].filter(p => p && p.trim() !== ''),
      friends: [],
      eventAttendanceScore: 0,
      levelTitle: 'Newbie Planner',
      levelStars: 1,
      createdAt: FieldValue.serverTimestamp() as AdminTimestamp,
      updatedAt: FieldValue.serverTimestamp() as AdminTimestamp,
    };

    await userDocRef.set(fullProfileData);
    console.log('User profile created successfully with Admin SDK for UID:', uid);
  } catch (error) {
    console.error('Error creating user profile with Admin SDK:', error);
    throw error;
  }
};

// --- Friend Management Admin Functions ---

export const sendFriendRequestAdmin = async (
  fromUser: { uid: string; name: string | null; avatarUrl: string | null },
  toUser: { uid: string; name: string | null; avatarUrl: string | null }
): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  const senderRef = firestoreAdmin.collection(USER_COLLECTION).doc(fromUser.uid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(toUser.uid);
  const senderEntry: Omit<FriendEntry, 'friendUid'> = { 
    status: 'pending_sent',
    name: toUser.name,
    avatarUrl: toUser.avatarUrl,
    requestedAt: now as AdminTimestamp,
  };
  batch.set(senderRef, senderEntry);

  const receiverRef = firestoreAdmin.collection(USER_COLLECTION).doc(toUser.uid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(fromUser.uid);
  const receiverEntry: Omit<FriendEntry, 'friendUid'> = {
    status: 'pending_received',
    name: fromUser.name,
    avatarUrl: fromUser.avatarUrl,
    requestedAt: now as AdminTimestamp,
  };
  batch.set(receiverRef, receiverEntry);

  try {
    await batch.commit();
  } catch (error) {
    console.error("Error sending friend request (Admin SDK):", error);
    throw error;
  }
};

export const acceptFriendRequestAdmin = async (currentUserUid: string, requesterUid: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");
  const batch = firestoreAdmin.batch();
  const now = FieldValue.serverTimestamp();

  const currentUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(requesterUid);
  batch.update(currentUserFriendshipRef, { status: 'friends', friendsSince: now });

  const requesterFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(requesterUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserUid);
  batch.update(requesterFriendshipRef, { status: 'friends', friendsSince: now });

  try {
    await batch.commit();
  } catch (error) {
    console.error("Error accepting friend request (Admin SDK):", error);
    throw error;
  }
};

export const declineOrCancelFriendRequestAdmin = async (currentUserUid: string, otherUserUid: string): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");
  const batch = firestoreAdmin.batch();

  const currentUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(currentUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(otherUserUid);
  batch.delete(currentUserFriendshipRef);

  const otherUserFriendshipRef = firestoreAdmin.collection(USER_COLLECTION).doc(otherUserUid).collection(FRIENDSHIPS_SUBCOLLECTION).doc(currentUserUid);
  batch.delete(otherUserFriendshipRef);

  try {
    await batch.commit();
  } catch (error) {
    console.error("Error declining/cancelling friend request (Admin SDK):", error);
    throw error;
  }
};

export const removeFriendAdmin = async (currentUserUid: string, friendUid: string): Promise<void> => {
  return declineOrCancelFriendRequestAdmin(currentUserUid, friendUid);
};

// --- NEW: User Search with Admin SDK ---
const isEmailAdmin = (term: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term);
const isPhoneNumberAdmin = (term: string): boolean => /^\+?[0-9\s-()]+$/.test(term) && term.length > 5;

export const searchUsersAdmin = async (searchTerm: string, currentUserId: string): Promise<SearchedUser[]> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for searchUsersAdmin.");
    throw new Error("Firestore Admin SDK not available");
  }
  if (!searchTerm.trim()) return [];

  const usersRef = firestoreAdmin.collection(USER_COLLECTION);
  let querySnapshot;
  const lowerSearchTerm = searchTerm.toLowerCase();

  try {
    if (isEmailAdmin(lowerSearchTerm)) {
      querySnapshot = await usersRef.where("email", "==", lowerSearchTerm).limit(10).get();
    } else if (isPhoneNumberAdmin(searchTerm)) {
      // This assumes exact match on how phone number is stored.
      // For more flexible search, consider normalized phone number field.
      querySnapshot = await usersRef.where("phoneNumber", "==", searchTerm).limit(10).get();
    } else {
      // Basic prefix search on name (case-sensitive with Firestore default indexing for strings)
      // For true case-insensitive prefix search, you'd typically store a lowercase version of the name.
      querySnapshot = await usersRef
        .orderBy("name")
        .startAt(searchTerm)
        .endAt(searchTerm + '\uf8ff')
        .limit(10)
        .get();
    }

    const users: SearchedUser[] = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.id !== currentUserId) {
        const data = docSnap.data() as UserProfile; // Assume data matches UserProfile structure
        users.push({
          uid: docSnap.id,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatarUrl,
          // friendshipStatus will be determined on the client or by another lookup if needed here
        });
      }
    });
    return users;
  } catch (error) {
    console.error("Error searching users (Admin SDK):", error);
    throw error;
  }
};

export const calculateUserPremiumStatus = async (userId: string): Promise<boolean> => {
  if (!firestoreAdmin) {
    console.error("[calculateUserPremiumStatus] CRITICAL: Firestore Admin SDK is not initialized.");
    return false;
  }

  try {
    // Get user's subscription data from a subscriptions collection
    const subscriptionDoc = await firestoreAdmin
      .collection('subscriptions')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    return !subscriptionDoc.empty;
  } catch (error) {
    console.error('[calculateUserPremiumStatus] Error checking premium status:', error);
    return false;
  }
};

export const calculateUserActivityScore = async (userId: string): Promise<number> => {
  if (!firestoreAdmin) {
    console.error("[calculateUserActivityScore] CRITICAL: Firestore Admin SDK is not initialized.");
    return 0;
  }

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
