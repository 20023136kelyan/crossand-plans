// src/services/userService.ts (Client SDK functions)
import { db, ClientTimestamp } from '@/lib/firebase'; 
import type { UserProfile, FriendEntry, SearchedUser, FriendStatus, UserRoleType, AppTimestamp } from '@/types/user';
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  orderBy,
  where,
  documentId,
  onSnapshot, 
  type Unsubscribe, 
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';

const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';

// Helper to convert Client Timestamps to JS Date or null for UserProfile
const convertClientProfileTimestamps = (data: any): Pick<UserProfile, 'birthDate' | 'createdAt' | 'updatedAt'> => {
  const convert = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof ClientTimestamp) return ts.toDate();
    if (ts instanceof Date) return ts;
    if (ts && typeof ts.toDate === 'function') { // For objects that mimic Firestore Timestamp
        try { return ts.toDate(); } catch (e) { console.warn(`[convertClientProfileTimestamps client] Error converting toDate for value: ${JSON.stringify(ts)}`, e); }
    }
    if (typeof ts === 'string') { // For ISO strings
        try {
            const parsedDate = parseISO(ts);
            if (isValid(parsedDate)) return parsedDate;
        } catch (e) { console.warn(`[convertClientProfileTimestamps client] Error parsing date string: ${ts}`, e); }
    }
    console.warn(`[convertClientProfileTimestamps client] Unexpected timestamp type for UserProfile: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning null.`);
    return null;
  };
  
  const nowEpoch = new Date(0); // Fallback for required timestamps
  return {
    birthDate: data.birthDate ? convert(data.birthDate) : null,
    createdAt: data.createdAt ? (convert(data.createdAt) || nowEpoch) : nowEpoch,
    updatedAt: data.updatedAt ? (convert(data.updatedAt) || nowEpoch) : nowEpoch,
  };
};


export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  console.log(`[userService.ts client] getUserProfile called for UID: ${uid}`);
  
  if (!db) {
    console.warn("[userService.ts client] Firestore (db) is not initialized for getUserProfile.");
    return null;
  }
  if (!uid) {
    console.warn("[userService.ts client] getUserProfile called with no UID.");
    return null;
  }
  try {
    // Log the collection and document path we're trying to access
    console.log(`[userService.ts client] Attempting to fetch profile from collection '${USER_COLLECTION}' with ID '${uid}'`);
    
    const userDocRef = doc(db, USER_COLLECTION, uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      console.log(`[userService.ts client] Profile found for UID ${uid}:`, {
        hasName: !!data.name,
        hasUsername: !!data.username,
        hasEmail: !!data.email,
        hasPhysicalAddress: !!data.physicalAddress,
        dataKeys: Object.keys(data)
      });
      
      const timestamps = convertClientProfileTimestamps(data);
      const profile = { 
        uid, 
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
        preferences: data.preferences || [], // Ensure this is populated based on other arrays if needed
        followers: data.followers || [],
        following: data.following || [],
        // Make sure username is included (based on the memory about username consistency)
        username: data.username || null
        // 'friends' array is deprecated from UserProfile, use getFriendships for friend status
      } as UserProfile;
      
      console.log(`[userService.ts client] Successfully processed profile for UID ${uid}`);
      return profile;
    } else {
      console.warn(`[userService.ts client] No profile document found for UID: ${uid}`);
      return null;
    }
  } catch (error) {
    console.error('[userService.ts client] Error fetching user profile:', error);
    return null;
  }
};

export const getUsersProfiles = async (uids: string[]): Promise<UserProfile[]> => {
  if (!db) {
    console.warn("[userService.ts client] Firestore (db) is not initialized for getUsersProfiles.");
    return [];
  }
   if (!uids || uids.length === 0) {
    return [];
  }
  try {
    const profiles: UserProfile[] = [];
    const MAX_IN_QUERY_COUNT = 30; 
    for (let i = 0; i < uids.length; i += MAX_IN_QUERY_COUNT) {
        const chunk = uids.slice(i, i + MAX_IN_QUERY_COUNT);
        if (chunk.length === 0) continue;

        const usersRef = collection(db, USER_COLLECTION);
        const q = query(usersRef, where(documentId(), 'in', chunk));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => { 
          if (docSnap.exists()) { 
            const data = docSnap.data();
            const timestamps = convertClientProfileTimestamps(data);
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
          }
        });
    }
    return profiles;
  } catch (error) {
    console.error('[userService.ts client] Error fetching multiple user profiles:', error);
    return [];
  }
};

export const checkUserProfileExists = async (uid: string): Promise<boolean> => {
  if (!db) {
    console.warn("[userService.ts client] Firestore (db) is not initialized for checkUserProfileExists.");
    return false;
  }
  if (!uid) {
    console.warn("[userService.ts client] checkUserProfileExists called with no UID.");
    return false;
  }
  try {
    const userDocRef = doc(db, USER_COLLECTION, uid);
    const userDocSnap = await getDoc(userDocRef);
    return userDocSnap.exists();
  } catch (error) {
    console.error('[userService.ts client] Error checking user profile existence:', error);
    return false;
  }
};

export const getFriendships = (
  uid: string,
  onUpdate: (friends: FriendEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!db) {
    const err = new Error("Firestore (db) is not initialized for getFriendships.");
    console.warn(`[userService.ts client] ${err.message}`);
    if (onError) onError(err);
    onUpdate([]);
    return () => {}; 
  }
  if (!uid) {
    const err = new Error("User ID not provided for getFriendships.");
    console.warn(`[userService.ts client] ${err.message}`);
    onUpdate([]); 
    if (onError) onError(err);
    return () => {};
  }
  // console.log(`[userService.ts client] Setting up friendships listener for UID: ${uid}`);
  const friendshipsRef = collection(db, USER_COLLECTION, uid, FRIENDSHIPS_SUBCOLLECTION);
  const q = query(friendshipsRef); // Fetch all statuses, order by name if desired for display later

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const friendships: FriendEntry[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      const convertTimestamp = (ts: any): string | null => { // Changed AppTimestamp to string for client
        if (!ts) return null;
        if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
        if (ts instanceof Date) return ts.toISOString();
        if (ts && typeof ts.toDate === 'function') {
            try { return ts.toDate().toISOString(); } catch (e) { return null; }
        }
        if (typeof ts === 'string' && isValid(parseISO(ts))) return ts;
        return null;
      };
      
      friendships.push({ 
        friendUid: docSnap.id, 
        status: data.status as FriendStatus,
        name: data.name || null,
        avatarUrl: data.avatarUrl || null,
        role: data.role || null, // Ensure these are included
        isVerified: data.isVerified || false, // Ensure these are included
        requestedAt: convertTimestamp(data.requestedAt),
        friendsSince: convertTimestamp(data.friendsSince),
      } as FriendEntry);
    });
    // console.log(`[userService.ts client] Friendships updated for UID ${uid}. Count: ${friendships.length}`);
    onUpdate(friendships);
  }, (error) => {
    console.error("[userService.ts client] Error fetching friendships in real-time:", error);
    if (onError) onError(error);
    onUpdate([]); 
  });

  return unsubscribe;
};
