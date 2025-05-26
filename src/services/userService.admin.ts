// src/services/userService.admin.ts
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { UserProfile, OnboardingProfileData, FriendEntry, FriendStatus, SearchedUser } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue } from 'firebase-admin/firestore';

const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';

export const getUserProfileAdmin = async (uid: string): Promise<UserProfile | null> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for getUserProfileAdmin.");
    return null;
  }
  try {
    const userDocRef = firestoreAdmin.collection(USER_COLLECTION).doc(uid);
    const userDocSnap = await userDocRef.get();

    if (userDocSnap.exists) {
      const data = userDocSnap.data() as any; 
      return { 
        uid, 
        ...data,
        birthDate: data.birthDate instanceof AdminTimestamp ? data.birthDate : (data.birthDate && typeof data.birthDate.toDate === 'function' ? data.birthDate.toDate() : null),
        createdAt: data.createdAt instanceof AdminTimestamp ? data.createdAt : (data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : AdminTimestamp.now()),
        updatedAt: data.updatedAt instanceof AdminTimestamp ? data.updatedAt : (data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : AdminTimestamp.now()),
      } as UserProfile;
    } else {
      console.warn('No such user profile document for UID (admin SDK):', uid);
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile (admin SDK):', error);
    return null;
  }
};

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
