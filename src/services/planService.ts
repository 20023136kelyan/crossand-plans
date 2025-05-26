// src/services/planService.ts (Client SDK functions for plans)
import { db, ClientTimestamp } from '@/lib/firebase'; // Ensure this is the CLIENT SDK db
import type { Plan, Comment, Rating, PlanShare, PlanShareStatus, PlanStatusType } from '@/types/user';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  // type QuerySnapshot, // Explicit type alias removed, direct import used below
} from 'firebase/firestore';
import { parseISO, isValid, isPast } from 'date-fns';
import { debounce } from 'lodash';

const PLANS_COLLECTION = 'plans';
const RATINGS_SUBCOLLECTION = 'ratings';
const COMMENTS_SUBCOLLECTION = 'comments';
const PLAN_SHARES_COLLECTION = 'planShares';

const convertClientPlanTimestampsToISO = (data: any): Pick<Plan, 'eventTime' | 'createdAt' | 'updatedAt' | 'itinerary'> => {
  const convertSingleTimestamp = (ts: any): string => {
    if (!ts) {
      // console.warn("[convertClientPlanTimestampsToISO] Received null or undefined timestamp, returning epoch ISO string.");
      return new Date(0).toISOString(); // Fallback for required fields
    }
    if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (ts && typeof ts.toDate === 'function') { // For objects that mimic Firestore Timestamp (e.g., from Admin SDK serialization)
        try { return ts.toDate().toISOString(); } catch (e) { /* ignore */ }
    }
    if (typeof ts === 'string') {
        try {
            const parsed = parseISO(ts);
            if (isValid(parsed)) return ts; // Already valid ISO string
        } catch (e) { /* ignore */ }
    }
    console.warn(`[convertClientPlanTimestampsToISO] Unexpected plan timestamp type: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning epoch ISO string.`);
    return new Date(0).toISOString();
  };

  const convertOptionalTimestamp = (ts: any): string | null => {
    if (!ts) return null;
    if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toISOString(); } catch (e) { return null; }
    }
    if (typeof ts === 'string') {
        try {
            const parsed = parseISO(ts);
            if (isValid(parsed)) return ts;
        } catch (e) { /* ignore */ }
    }
    return null;
  };

  return {
    eventTime: convertSingleTimestamp(data.eventTime),
    itinerary: data.itinerary?.map((item: any) => ({
      ...item,
      startTime: convertSingleTimestamp(item.startTime),
      endTime: convertOptionalTimestamp(item.endTime),
    })) || [],
    createdAt: convertSingleTimestamp(data.createdAt),
    updatedAt: convertSingleTimestamp(data.updatedAt),
  };
};

const mapDocToPlan = (docSnap: import('firebase/firestore').DocumentSnapshot<DocumentData>): Plan => {
  const data = docSnap.data()!; // We expect data if docSnap is from a QuerySnapshot or exists() was checked
  const timestamps = convertClientPlanTimestampsToISO(data);
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description || null,
    location: data.location,
    city: data.city,
    eventType: data.eventType || null,
    priceRange: data.priceRange || null,
    hostId: data.hostId,
    hostName: data.hostName || null,
    hostAvatarUrl: data.hostAvatarUrl || null,
    invitedParticipantUserIds: data.invitedParticipantUserIds || [],
    participantResponses: data.participantResponses || {},
    status: data.status || 'draft',
    planType: data.planType || 'single-stop',
    originalPlanId: data.originalPlanId || null,
    sharedByUid: data.sharedByUid || null,
    averageRating: data.averageRating === undefined ? null : data.averageRating,
    reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
    photoHighlights: data.photoHighlights || [],
    ...timestamps, 
  } as Plan;
};

export const getPlanById = async (planId: string): Promise<Plan | null> => {
  if (!db) { 
    console.warn("[planService.ts client] Firestore (db) is not initialized for getPlanById.");
    return null;
  }
  if (!planId) {
    console.warn("[planService.ts client] getPlanById called with no planId.");
    return null;
  }
  try {
    const planDocRef = doc(db, PLANS_COLLECTION, planId);
    const planDocSnap = await getDoc(planDocRef);

    if (planDocSnap.exists()) {
      return mapDocToPlan(planDocSnap);
    } else {
      // console.log(`[planService.ts client] Plan not found: ${planId}`);
      return null;
    }
  } catch (error) {
    console.error(`[planService.ts client] Error fetching plan ${planId}:`, error);
    return null;
  }
};

export const getUserPlans = (
  userId: string,
  onPlansUpdate: (plans: Plan[], initialLoadComplete: boolean) => void
): (() => void) => {
  if (!db) {
    console.error("[planService.ts client] Firestore (db) not initialized for getUserPlans.");
    return () => {};
  }
  if (!userId) {
    console.warn("[planService.ts client] getUserPlans called with no userId.");
    onPlansUpdate([], true);
    return () => {};
  }

  const plansRef = collection(db, PLANS_COLLECTION);
  const allPlansMap = new Map<string, Plan>();
  const unsubscribes: Unsubscribe[] = [];

  let initialHostedSnapshotProcessed = false;
  let initialInvitedSnapshotProcessed = false;
  
  // Create a debounced version of the final update
  const debouncedFinalUpdate = debounce(() => {
    if (initialHostedSnapshotProcessed && initialInvitedSnapshotProcessed) {
      const finalPlansArray = Array.from(allPlansMap.values()).sort((a, b) => {
        const timeA = a.eventTime && isValid(parseISO(a.eventTime)) ? parseISO(a.eventTime).getTime() : 0;
        const timeB = b.eventTime && isValid(parseISO(b.eventTime)) ? parseISO(b.eventTime).getTime() : 0;
        return timeB - timeA;
      });
      onPlansUpdate(finalPlansArray, true);
    }
  }, 100);

  const processSnapshot = (
    snapshot: import('firebase/firestore').QuerySnapshot<DocumentData>,
    isInitialCallChecker: () => boolean,
    markInitialCallDone: () => void
  ) => {
    let changedSinceLastMapUpdate = false;
    
    snapshot.docChanges().forEach((change) => {
      const plan = mapDocToPlan(change.doc);
      if (change.type === "added" || change.type === "modified") {
        const existingPlan = allPlansMap.get(plan.id);
        if (JSON.stringify(existingPlan) !== JSON.stringify(plan)) {
          allPlansMap.set(plan.id, plan);
          changedSinceLastMapUpdate = true;
        }
      } else if (change.type === "removed") {
        if (allPlansMap.has(plan.id)) {
          allPlansMap.delete(plan.id);
          changedSinceLastMapUpdate = true;
        }
      }
    });

    if (isInitialCallChecker()) {
      markInitialCallDone();
      changedSinceLastMapUpdate = true;
    }
    
    if (changedSinceLastMapUpdate) {
      debouncedFinalUpdate();
    }
  };
  
  const hostedPlansQuery = query(
    plansRef,
    where('hostId', '==', userId),
    orderBy('eventTime', 'desc')
  );
  
  const unsubscribeHosted = onSnapshot(
    hostedPlansQuery,
    (snapshot) => processSnapshot(
      snapshot,
      () => !initialHostedSnapshotProcessed,
      () => { initialHostedSnapshotProcessed = true; }
    ),
    (error) => {
      console.error(`[planService.ts client] Error fetching hosted plans:`, error);
      initialHostedSnapshotProcessed = true;
      debouncedFinalUpdate();
    }
  );
  unsubscribes.push(unsubscribeHosted);

  const invitedPlansQuery = query(
    plansRef,
    where('invitedParticipantUserIds', 'array-contains', userId),
    orderBy('eventTime', 'desc')
  );
  
  const unsubscribeInvited = onSnapshot(
    invitedPlansQuery,
    (snapshot) => processSnapshot(
      snapshot,
      () => !initialInvitedSnapshotProcessed,
      () => { initialInvitedSnapshotProcessed = true; }
    ),
    (error) => {
      console.error(`[planService.ts client] Error fetching invited plans:`, error);
      initialInvitedSnapshotProcessed = true;
      debouncedFinalUpdate();
    }
  );
  unsubscribes.push(unsubscribeInvited);
  
  return () => {
    debouncedFinalUpdate.cancel();
    unsubscribes.forEach(unsub => unsub());
    allPlansMap.clear();
  };
};

export const getPendingPlanInvitationsCount = (
  userId: string,
  onCountUpdate: (count: number) => void
): Unsubscribe => {
  if (!db) {
    console.warn("[planService.ts client] Firestore (db) is not initialized for getPendingPlanInvitationsCount.");
    return () => {};
  }
  if (!userId) {
    console.warn("[planService.ts client] getPendingPlanInvitationsCount called with no userId.");
    onCountUpdate(0);
    return () => {};
  }
  const plansRef = collection(db, PLANS_COLLECTION);
  const q = query(
    plansRef,
    where('invitedParticipantUserIds', 'array-contains', userId),
    where('status', '==', 'published' as PlanStatusType)
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    let count = 0;
    querySnapshot.forEach((docSnap) => {
      const plan = mapDocToPlan(docSnap); 
      try {
        const eventDate = parseISO(plan.eventTime);
        if (isValid(eventDate) && !isPast(eventDate)) { // Only upcoming published invitations
          const userRsvp = plan.participantResponses?.[userId];
          if (!userRsvp || userRsvp === 'pending' || userRsvp === 'maybe') { 
            count++;
          }
        }
      } catch (e) {
        // console.warn("[planService.ts client] Invalid date format for plan during invitation count:", plan.id, plan.eventTime, e);
      }
    });
    onCountUpdate(count);
  }, (error) => {
    console.error("[planService.ts client] Error fetching pending plan invitations count:", error);
    onCountUpdate(0);
  });

  return unsubscribe;
};

// Helper function for converting comment timestamps
const convertClientCommentTimestampToISO = (ts: any): string => {
    if (!ts) return new Date(0).toISOString(); // Fallback for required createdAt
    if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toISOString(); } catch (e) { /* ignore */ }
    }
    if (typeof ts === 'string') {
        try {
            const parsed = parseISO(ts);
            if (isValid(parsed)) return ts;
        } catch (e) { /* ignore */ }
    }
    console.warn(`[convertClientCommentTimestampToISO] Unexpected comment timestamp type: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning epoch.`);
    return new Date(0).toISOString();
};


export const getPlanComments = (
  planId: string,
  onUpdate: (comments: Comment[]) => void
): Unsubscribe => {
  if (!db) {
    console.warn("[planService.ts client] Firestore (db) is not initialized for getPlanComments.");
    return () => {};
  }
  if (!planId) {
    console.warn("[planService.ts client] getPlanComments called with no planId.");
    onUpdate([]);
    return () => {};
  }
  const commentsRef = collection(db, PLANS_COLLECTION, planId, COMMENTS_SUBCOLLECTION);
  const q = query(commentsRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        planId: data.planId, // Should already be there from server-side write
        userName: data.userName,
        userAvatarUrl: data.userAvatarUrl,
        text: data.text,
        createdAt: convertClientCommentTimestampToISO(data.createdAt),
      } as Comment;
    });
    onUpdate(comments);
  }, (error) => {
    console.error(`[planService.ts client] Error fetching comments for plan ${planId}:`, error);
    onUpdate([]);
  });
  return unsubscribe;
};

export const getUserRatingForPlan = async (planId: string, userId: string): Promise<Rating | null> => {
  if (!db) {
    console.warn("[planService.ts client] Firestore (db) is not initialized for getUserRatingForPlan.");
    return null;
  }
  if (!planId || !userId) return null;
  try {
    const ratingDocRef = doc(db, PLANS_COLLECTION, planId, RATINGS_SUBCOLLECTION, userId);
    const ratingDocSnap = await getDoc(ratingDocRef);
    if (ratingDocSnap.exists()) {
      const data = ratingDocSnap.data();
      return {
        userId: userId, 
        planId: planId,
        value: data.value, 
        createdAt: convertClientCommentTimestampToISO(data.createdAt), // Re-use comment timestamp helper
      } as Rating;
    }
    return null;
  } catch (error) {
    console.error(`[planService.ts client] Error fetching user rating for plan ${planId}:`, error);
    return null;
  }
};

export const getUserCompletedPlans = async (userId: string): Promise<Plan[]> => {
  if (!db) {
    console.warn("[planService.ts client] Firestore (db) is not initialized for getUserCompletedPlans.");
    return [];
  }
  if (!userId) {
    console.warn("[planService.ts client] getUserCompletedPlans called with no userId.");
    return [];
  }
  
  const plansRef = collection(db, PLANS_COLLECTION);
  const planMap = new Map<string, Plan>();

  try {
    const hostedQuery = query(plansRef, where('hostId', '==', userId));
    const hostedSnapshot = await getDocs(hostedQuery);
    hostedSnapshot.forEach(docSnap => {
      const plan = mapDocToPlan(docSnap);
      planMap.set(plan.id, plan);
    });

    const invitedQuery = query(plansRef, where('invitedParticipantUserIds', 'array-contains', userId));
    const invitedSnapshot = await getDocs(invitedQuery);
    invitedSnapshot.forEach(docSnap => {
      if (!planMap.has(docSnap.id)) { 
        const plan = mapDocToPlan(docSnap);
        planMap.set(plan.id, plan);
      }
    });
    
    const allPlans = Array.from(planMap.values());
    const completedPlans = allPlans.filter(plan => {
      try {
        const eventDate = parseISO(plan.eventTime);
        return isValid(eventDate) && isPast(eventDate);
      } catch (e) {
        // console.warn(`[planService.ts client] Invalid date format for plan ${plan.id} during completion check:`, plan.eventTime, e);
        return false;
      }
    });

    return completedPlans.sort((a, b) => {
        const timeA = a.eventTime && isValid(parseISO(a.eventTime)) ? parseISO(a.eventTime).getTime() : 0;
        const timeB = b.eventTime && isValid(parseISO(b.eventTime)) ? parseISO(b.eventTime).getTime() : 0;
        return timeB - timeA; 
    }); 
  } catch (error) {
    console.error("[planService.ts client] Error fetching completed plans:", error);
    return [];
  }
};


export const getPendingPlanSharesForUser = (
  userId: string,
  onUpdate: (shares: PlanShare[]) => void
): Unsubscribe => {
  if (!db) {
    console.warn("[planService.ts client] Firestore (db) is not initialized for getPendingPlanSharesForUser.");
    return () => {};
  }
  if (!userId) {
    console.warn("[planService.ts client] getPendingPlanSharesForUser called with no userId.");
    onUpdate([]);
    return () => {};
  }
  const sharesRef = collection(db, PLAN_SHARES_COLLECTION);
  const q = query(
    sharesRef,
    where('sharedWithUid', '==', userId),
    where('status', '==', 'pending' as PlanShareStatus),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const pendingShares = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const timestamps = convertClientPlanTimestampsToISO({ createdAt: data.createdAt, updatedAt: data.updatedAt });
      return {
        id: docSnap.id,
        originalPlanId: data.originalPlanId,
        originalPlanName: data.originalPlanName,
        sharedByUid: data.sharedByUid,
        sharedByName: data.sharedByName,
        sharedByAvatarUrl: data.sharedByAvatarUrl,
        sharedWithUid: data.sharedWithUid,
        status: data.status,
        createdAt: timestamps.createdAt,
        updatedAt: timestamps.updatedAt,
      } as PlanShare;
    });
    onUpdate(pendingShares);
  }, (error) => {
    console.error(`[planService.ts client] Error fetching pending plan shares for user ${userId}:`, error);
    onUpdate([]);
  });
  return unsubscribe;
};
