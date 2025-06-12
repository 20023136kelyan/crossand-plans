
// Admin SDK functions for plans - for server-side use only
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Plan, Rating, Comment } from '@/types/user'; 
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

const PLANS_COLLECTION = 'plans';
const RATINGS_SUBCOLLECTION = 'ratings';
const COMMENTS_SUBCOLLECTION = 'comments';


export const createPlanAdmin = async (
  planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  if (!firestoreAdmin) {
    console.error("[createPlanAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }

  try {
    const participantResponses: { [userId: string]: string } = {}; 
    participantResponses[planData.hostId] = 'going'; 

    if (planData.invitedParticipantUserIds) {
      planData.invitedParticipantUserIds.forEach(uid => {
        if (uid !== planData.hostId) {
          participantResponses[uid] = 'pending';
        }
      });
    }

    const dataToAdd = {
      ...planData,
      participantResponses,
      averageRating: planData.averageRating === undefined ? null : planData.averageRating,
      reviewCount: planData.reviewCount === undefined ? 0 : planData.reviewCount,
      photoHighlights: planData.photoHighlights || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log('[createPlanAdmin] Data being added to Firestore:', JSON.stringify(dataToAdd, null, 2));
    const docRef = await firestoreAdmin.collection(PLANS_COLLECTION).add(dataToAdd);
    return docRef.id;
  } catch (error) {
    console.error('[createPlanAdmin] Error creating plan in Firestore (Admin SDK):', error);
    throw error;
  }
};

export const updatePlanAdmin = async (
  planId: string,
  dataToUpdate: Partial<Omit<Plan, 'id' | 'createdAt' | 'hostId'>>,
  currentPlanData?: Plan 
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[updatePlanAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  try {
    const planDocRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
    
    let finalParticipantResponses = dataToUpdate.participantResponses || currentPlanData?.participantResponses || {};

    if (dataToUpdate.invitedParticipantUserIds && currentPlanData) {
      const newInvitedIds = dataToUpdate.invitedParticipantUserIds;
      const oldInvitedIds = currentPlanData.invitedParticipantUserIds || [];
      const currentResponses = { ...(currentPlanData.participantResponses || {}) };

      if (currentPlanData.hostId && (!currentResponses[currentPlanData.hostId] || currentResponses[currentPlanData.hostId] === 'pending')) {
        currentResponses[currentPlanData.hostId] = 'going';
      }

      newInvitedIds.forEach(uid => {
        if (!currentResponses[uid] && uid !== currentPlanData.hostId) {
          currentResponses[uid] = 'pending';
        }
      });

      const idsToRemove = oldInvitedIds.filter(uid => !newInvitedIds.includes(uid) && uid !== currentPlanData.hostId);
      idsToRemove.forEach(uid => {
        delete currentResponses[uid];
      });
      finalParticipantResponses = currentResponses;
    }
    
    const updatePayload:any = { 
        ...dataToUpdate,
        participantResponses: finalParticipantResponses,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (dataToUpdate.photoHighlights === undefined && currentPlanData?.photoHighlights) {
        updatePayload.photoHighlights = currentPlanData.photoHighlights;
    } else if (dataToUpdate.photoHighlights === undefined) {
        updatePayload.photoHighlights = [];
    }

    if ('hostId' in updatePayload) {
      delete (updatePayload as any).hostId;
    }
    await planDocRef.update(updatePayload);
  } catch (error) {
    console.error(`[updatePlanAdmin] Error updating plan ${planId} (Admin SDK):`, error);
    throw error;
  }
};

const convertAdminTimestampToISO = (ts: any): string => {
  if (ts instanceof AdminTimestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string' && !isNaN(Date.parse(ts))) return ts; 
  if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString();
  // Fallback for unexpected types or null/undefined, indicates potential data issue
  // Returning a very old date might be better than crashing if a date is expected.
  // Consider logging a warning here if ts is unexpectedly null/undefined.
  if (ts === null || ts === undefined) {
    console.warn("[convertAdminTimestampToISO] Received null or undefined timestamp, returning epoch.");
    return new Date(0).toISOString(); 
  }
  console.warn(`[convertAdminTimestampToISO] Unexpected timestamp type: ${typeof ts}, value: ${ts}. Returning epoch.`);
  return new Date(0).toISOString();
};


export const getPlanByIdAdmin = async (planId: string): Promise<Plan | null> => {
  if (!firestoreAdmin) {
    console.error("[getPlanByIdAdmin] Firestore Admin SDK is not initialized.");
    return null;
  }
  try {
    const planDocRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
    const planDocSnap = await planDocRef.get();

    if (planDocSnap.exists) {
      const data = planDocSnap.data();
      if (!data) return null;
      
      const processedPlan = {
        id: planDocSnap.id,
        name: data.name,
        description: data.description || null,
        eventTime: convertAdminTimestampToISO(data.eventTime),
        location: data.location,
        city: data.city,
        eventType: data.eventType || null,
        priceRange: data.priceRange || null,
        hostId: data.hostId,
        invitedParticipantUserIds: data.invitedParticipantUserIds || [],
        participantResponses: data.participantResponses || {},
        itinerary: data.itinerary?.map((item: any) => ({
          ...item,
          startTime: convertAdminTimestampToISO(item.startTime),
          endTime: item.endTime ? convertAdminTimestampToISO(item.endTime) : null,
        })) || [],
        status: data.status,
        planType: data.planType,
        originalPlanId: data.originalPlanId || null,
        sharedByUid: data.sharedByUid || null,
        averageRating: data.averageRating === undefined ? null : data.averageRating,
        reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
        photoHighlights: data.photoHighlights || [],
        createdAt: convertAdminTimestampToISO(data.createdAt),
        updatedAt: convertAdminTimestampToISO(data.updatedAt),
      } as Plan;
      return processedPlan;
    } else {
      return null;
    }
  } catch (error) {
    console.error('[getPlanByIdAdmin] Error fetching plan:', error);
    return null;
  }
};

export const getAllPublishedPlansAdmin = async (): Promise<Plan[]> => {
  if (!firestoreAdmin) {
    console.error("[getAllPublishedPlansAdmin] Firestore Admin SDK is not initialized.");
    return [];
  }
  try {
    const plansRef = firestoreAdmin.collection(PLANS_COLLECTION);
    const q = plansRef.where('status', '==', 'published').orderBy('eventTime', 'desc');
    const querySnapshot = await q.get();
    
    const plans: Plan[] = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data) {
        plans.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || null,
          eventTime: convertAdminTimestampToISO(data.eventTime),
          location: data.location,
          city: data.city,
          eventType: data.eventType || null,
          priceRange: data.priceRange || null,
          hostId: data.hostId,
          invitedParticipantUserIds: data.invitedParticipantUserIds || [],
          participantResponses: data.participantResponses || {},
          itinerary: data.itinerary?.map((item: any) => ({
            ...item,
            startTime: convertAdminTimestampToISO(item.startTime),
            endTime: item.endTime ? convertAdminTimestampToISO(item.endTime) : null,
          })) || [],
          status: data.status,
          planType: data.planType,
          originalPlanId: data.originalPlanId || null,
          sharedByUid: data.sharedByUid || null,
          averageRating: data.averageRating === undefined ? null : data.averageRating,
          reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
          photoHighlights: data.photoHighlights || [],
          createdAt: convertAdminTimestampToISO(data.createdAt),
          updatedAt: convertAdminTimestampToISO(data.updatedAt),
        } as Plan);
      }
    });
    return plans;
  } catch (error) {
    console.error('[getAllPublishedPlansAdmin] Error fetching published plans:', error);
    return [];
  }
};

export const getPublishedPlansByCityAdmin = async (cityName: string): Promise<Plan[]> => {
  if (!firestoreAdmin) {
    console.error("[getPublishedPlansByCityAdmin] Firestore Admin SDK is not initialized.");
    return [];
  }
  if (!cityName || typeof cityName !== 'string') {
    console.error("[getPublishedPlansByCityAdmin] Invalid cityName provided.");
    return [];
  }
  try {
    const plansRef = firestoreAdmin.collection(PLANS_COLLECTION);
    const q = plansRef
      .where('status', '==', 'published')
      .where('city', '==', cityName)
      .orderBy('eventTime', 'desc');
    const querySnapshot = await q.get();
    
    const plans: Plan[] = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data) {
        plans.push({
          id: docSnap.id,
          // ... (map all fields as in getAllPublishedPlansAdmin)
          name: data.name,
          description: data.description || null,
          eventTime: convertAdminTimestampToISO(data.eventTime),
          location: data.location,
          city: data.city,
          eventType: data.eventType || null,
          priceRange: data.priceRange || null,
          hostId: data.hostId,
          invitedParticipantUserIds: data.invitedParticipantUserIds || [],
          participantResponses: data.participantResponses || {},
          itinerary: data.itinerary?.map((item: any) => ({
            ...item,
            startTime: convertAdminTimestampToISO(item.startTime),
            endTime: item.endTime ? convertAdminTimestampToISO(item.endTime) : null,
          })) || [],
          status: data.status,
          planType: data.planType,
          originalPlanId: data.originalPlanId || null,
          sharedByUid: data.sharedByUid || null,
          averageRating: data.averageRating === undefined ? null : data.averageRating,
          reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
          photoHighlights: data.photoHighlights || [],
          createdAt: convertAdminTimestampToISO(data.createdAt),
          updatedAt: convertAdminTimestampToISO(data.updatedAt),
        } as Plan);
      }
    });
    return plans;
  } catch (error) {
    console.error(`[getPublishedPlansByCityAdmin] Error fetching published plans for city ${cityName}:`, error);
    return [];
  }
};


export const setRatingAdmin = async (
  planId: string,
  userId: string,
  ratingValue: number,
  currentPlan: Plan 
): Promise<{ success: boolean; error?: string; newAverageRating?: number; newReviewCount?: number }> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };

  const planRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
  const ratingRef = planRef.collection(RATINGS_SUBCOLLECTION).doc(userId);

  try {
    let newAverageRating = currentPlan.averageRating ?? undefined;
    let newReviewCount = currentPlan.reviewCount || 0;

    await firestoreAdmin.runTransaction(async (transaction) => {
      const userRatingDoc = await transaction.get(ratingRef);
      const planRatingsSnapshot = await transaction.get(planRef.collection(RATINGS_SUBCOLLECTION));
      
      let totalRatingValue = 0;
      let currentReviewCount = 0; 

      planRatingsSnapshot.forEach(doc => {
        if (doc.id === userId) { 
          totalRatingValue += ratingValue;
        } else { 
          const ratingData = doc.data() as Rating;
          if (ratingData && typeof ratingData.value === 'number') {
            totalRatingValue += ratingData.value;
          }
        }
        currentReviewCount++;
      });
      
      if (!userRatingDoc.exists) {
        // If this is a new rating, currentReviewCount already reflects it.
        // If it's not a new rating, it means it's an update to an existing one,
        // and currentReviewCount is also correct.
      } else {
        // If it's an update, and we already counted the new ratingValue for this user,
        // we don't need to decrement currentReviewCount if it was just an update to an existing rating.
        // currentReviewCount will be the total number of distinct users who have rated.
      }


      transaction.set(ratingRef, {
        value: ratingValue,
        createdAt: FieldValue.serverTimestamp(),
        userId: userId, 
        planId: planId, 
      });
      
      newAverageRating = currentReviewCount > 0 ? totalRatingValue / currentReviewCount : undefined;
      newReviewCount = currentReviewCount;
      
      transaction.update(planRef, {
        averageRating: newAverageRating,
        reviewCount: newReviewCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    return { 
      success: true, 
      newAverageRating: newAverageRating, 
      newReviewCount: newReviewCount
    };
  } catch (error: any) {
    console.error("Error setting rating and updating aggregates (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};

export const addCommentAdmin = async (
  planId: string,
  commentData: Omit<Comment, 'id' | 'createdAt' | 'planId'>
): Promise<{success: boolean, commentId?: string, error?: string}> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };
  
  const commentsRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).collection(COMMENTS_SUBCOLLECTION);
  try {
    const newCommentRef = await commentsRef.add({
      ...commentData,
      planId: planId, 
      createdAt: FieldValue.serverTimestamp(),
    });
    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
        updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true, commentId: newCommentRef.id };
  } catch (error: any) {
    console.error("Error adding comment (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};

export const copyCommentsFromTemplate = async (
  originalPlanId: string,
  newPlanId: string
): Promise<{success: boolean, error?: string}> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };
  
  try {
    // Get all comments from the original plan
    const originalCommentsRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(originalPlanId).collection(COMMENTS_SUBCOLLECTION);
    const commentsSnapshot = await originalCommentsRef.orderBy('createdAt', 'asc').get();
    
    if (commentsSnapshot.empty) {
      return { success: true }; // No comments to copy
    }
    
    // Copy each comment to the new plan
    const newCommentsRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(newPlanId).collection(COMMENTS_SUBCOLLECTION);
    const batch = firestoreAdmin.batch();
    
    commentsSnapshot.docs.forEach(doc => {
      const commentData = doc.data();
      const newCommentRef = newCommentsRef.doc();
      batch.set(newCommentRef, {
        ...commentData,
        planId: newPlanId, // Update to new plan ID
        createdAt: commentData.createdAt // Preserve original timestamp
      });
    });
    
    await batch.commit();
    
    // Update the new plan's updatedAt timestamp
    await firestoreAdmin.collection(PLANS_COLLECTION).doc(newPlanId).update({
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Error copying comments from template (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};
