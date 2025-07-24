// src/services/planService.server.ts (Admin SDK functions for plans)
import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Plan, Rating, Comment, PlanShare, PlanShareStatus, UserProfile } from '@/types/user'; 
import { FieldValue, Timestamp as AdminTimestamp, type Firestore, type DocumentSnapshot, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getUserProfileAdmin } from './userService.server'; // For fetching host profile
import admin from 'firebase-admin'; // For FieldPath.documentId()

// Import centralized utilities
import { convertTimestampToISO } from '@/lib/data/core/TimestampUtils.server';
import { mapDocumentToPlan } from '@/lib/data/mappers/PlanMapper.server';
import { BaseService } from '@/lib/data/core/BaseService';
import { FirebaseQueryBuilder, COLLECTIONS, SUBCOLLECTIONS } from '@/lib/data/core/QueryBuilder';
import { createNotification, createNotificationForMultipleUsers } from './notificationService.server';

const PLANS_COLLECTION = 'plans';
const RATINGS_SUBCOLLECTION = 'ratings';
const COMMENTS_SUBCOLLECTION = 'comments';
const PLAN_SHARES_COLLECTION = 'planShares';

// Ensure Firestore is properly typed
const db = firestoreAdmin as Firestore;

export const createPlanAdmin = async (
  planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'hostName' | 'hostAvatarUrl'>,
  hostId: string
): Promise<string> => {
  if (!firestoreAdmin) {
    console.error("[createPlanAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  // // console.log('[createPlanAdmin] Data received (partial):', JSON.stringify(planData, null, 2).substring(0, 300) + "...");

  const hostProfile = await getUserProfileAdmin(hostId);

  try {
    // Filter out hostId from invitedParticipantUserIds for safety
    const safeInvitedParticipantUserIds = (planData.invitedParticipantUserIds || []).filter(uid => uid !== hostId);

    const participantResponses: { [userId: string]: string } = {}; 
    participantResponses[hostId] = 'going'; 
    safeInvitedParticipantUserIds.forEach(uid => {
      participantResponses[uid] = 'pending';
    });

    const dataToAdd = {
      ...planData,
      invitedParticipantUserIds: safeInvitedParticipantUserIds,
      hostId: hostId, 
      hostName: hostProfile?.name || null,
      hostAvatarUrl: hostProfile?.avatarUrl || null,
      participantResponses,
      averageRating: planData.averageRating === undefined ? null : planData.averageRating,
      reviewCount: planData.reviewCount === undefined ? 0 : planData.reviewCount,
      photoHighlights: planData.photoHighlights || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // // console.log('[createPlanAdmin] Data being added to Firestore:', JSON.stringify(dataToAdd, null, 2).substring(0, 300) + "...");
    const docRef = await firestoreAdmin.collection(PLANS_COLLECTION).add(dataToAdd);
    // --- Send actionable notifications to invited users (on plan creation) ---
    if (safeInvitedParticipantUserIds.length > 0) {
      const notificationData: any = {
        type: 'plan_invitation',
        title: 'invited you to a plan',
        description: planData.name || 'A plan',
        userName: hostProfile?.username || hostProfile?.firstName || hostProfile?.name || 'Someone',
        actionUrl: `/plans/${docRef.id}`,
        isRead: false,
        handled: false, // actionable!
        metadata: { planId: docRef.id },
        planImageUrl: planData.images && planData.images.length > 0 ? planData.images[0].url : undefined,
      };
      if (hostProfile?.avatarUrl) {
        notificationData.avatarUrl = hostProfile.avatarUrl;
      }
      await createNotificationForMultipleUsers(safeInvitedParticipantUserIds, notificationData);
    }
    // console.log(`[createPlanAdmin] Plan created successfully with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('[createPlanAdmin] Error creating plan in Firestore (Admin SDK):', error);
    throw error;
  }
};

export const updatePlanAdmin = async (
  planId: string,
  dataToUpdate: Partial<Omit<Plan, 'id' | 'createdAt' | 'hostId' | 'hostName' | 'hostAvatarUrl'>>,
  currentPlanData?: Plan 
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[updatePlanAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  try {
    const planDocRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
    
    let finalParticipantResponses = dataToUpdate.participantResponses || currentPlanData?.participantResponses || {};
    // --- Notification logic: track changes ---
    const oldInvitedIds = currentPlanData?.invitedParticipantUserIds || [];
    const newInvitedIds = dataToUpdate.invitedParticipantUserIds || oldInvitedIds;
    const newlyInvited = newInvitedIds.filter(uid => !oldInvitedIds.includes(uid));
    const hostId = currentPlanData?.hostId;
    const updaterId = (dataToUpdate as any)?.updaterId || null; // If available
    // Accept/decline logic: find status changes
    const oldResponses = currentPlanData?.participantResponses || {};
    const newResponses = dataToUpdate.participantResponses || oldResponses;
    const statusChanged: Array<{uid: string, oldStatus: string, newStatus: string}> = [];
    Object.keys(newResponses).forEach(uid => {
      if (oldResponses[uid] && newResponses[uid] && oldResponses[uid] !== newResponses[uid]) {
        statusChanged.push({uid, oldStatus: oldResponses[uid], newStatus: newResponses[uid]});
      }
    });
    // --- End notification logic tracking ---

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

    if ('hostId' in updatePayload) delete (updatePayload as any).hostId;
    if ('hostName' in updatePayload) delete (updatePayload as any).hostName;
    if ('hostAvatarUrl' in updatePayload) delete (updatePayload as any).hostAvatarUrl;
    // Explicitly allow averageRating and reviewCount to be updated if present in dataToUpdate
    if (dataToUpdate.averageRating !== undefined) updatePayload.averageRating = dataToUpdate.averageRating;
    if (dataToUpdate.reviewCount !== undefined) updatePayload.reviewCount = dataToUpdate.reviewCount;


    await planDocRef.update({
      ...dataToUpdate,
      participantResponses: finalParticipantResponses,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // --- Send notifications ---
    // 1. Notify newly invited users
    if (newlyInvited.length > 0 && hostId) {
      // Get host profile for notification
      const hostProfile = await getUserProfileAdmin(hostId);
      const notificationData: any = {
        type: 'plan_invitation',
        title: 'invited you to a plan',
        description: currentPlanData?.name || 'A plan',
        userName: hostProfile?.username || hostProfile?.firstName || hostProfile?.name || 'Someone',
        actionUrl: `/plans/${planId}`,
        isRead: false,
        handled: false, // <-- actionable!
        metadata: { planId },
        planImageUrl: currentPlanData?.images && currentPlanData.images.length > 0 ? currentPlanData.images[0].url : undefined,
      };
      
      if (hostProfile?.avatarUrl) {
        notificationData.avatarUrl = hostProfile.avatarUrl;
      }
      
      await createNotificationForMultipleUsers(newlyInvited, notificationData);
    }
    // 2. Notify host when someone accepts/declines
    if (hostId && statusChanged.length > 0) {
      for (const change of statusChanged) {
        if (change.newStatus === 'going' || change.newStatus === 'declined') {
          // Get participant profile for notification
          const participantProfile = await getUserProfileAdmin(change.uid);
          const notificationData: any = {
            type: 'plan_rsvp_response',
            title: `${change.newStatus === 'going' ? 'accepted' : 'declined'} your invitation`,
            description: `to your plan`,
            userName: participantProfile?.username || participantProfile?.firstName || participantProfile?.name || 'Someone',
            actionUrl: `/plans/${planId}`,
            isRead: false,
            metadata: { planId, participantId: change.uid, status: change.newStatus },
          };
          
          if (participantProfile?.avatarUrl) {
            notificationData.avatarUrl = participantProfile.avatarUrl;
          }
          
          await createNotification(hostId, notificationData);
        }
      }
    }
    // 3. Notify all participants (except updater) when plan details are changed
    if (currentPlanData && updaterId) {
      const allParticipants = [hostId, ...(currentPlanData.invitedParticipantUserIds || [])].filter((uid): uid is string => typeof uid === 'string');
      const notifyUsers = allParticipants.filter(uid => uid !== updaterId);
      if (notifyUsers.length > 0) {
        // Get updater profile for notification
        const updaterProfile = await getUserProfileAdmin(updaterId);
        const notificationData: any = {
          type: 'plan_share',
          title: 'updated the plan',
          description: 'Event details, location, or participants have been modified',
          userName: updaterProfile?.username || updaterProfile?.firstName || updaterProfile?.name || 'Someone',
          actionUrl: `/plans/${planId}`,
          isRead: false,
          metadata: { planId },
          planImageUrl: currentPlanData?.images && currentPlanData.images.length > 0 ? currentPlanData.images[0].url : undefined,
        };
        
        if (updaterProfile?.avatarUrl) {
          notificationData.avatarUrl = updaterProfile.avatarUrl;
        }
        
        await createNotificationForMultipleUsers(notifyUsers, notificationData);
      }
    }
  } catch (error) {
    console.error(`[updatePlanAdmin] Error updating plan ${planId} (Admin SDK):`, error);
    throw error;
  }
};

// Timestamp conversion now handled by centralized utility
const convertAdminTimestampToISO = convertTimestampToISO;

// Plan mapping now handled by centralized utility
const mapAdminDocToPlan = mapDocumentToPlan;


export const getPlanByIdAdminService = async (planId: string): Promise<Plan | null> => {
  try {
    const planDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId);
    const planDocSnap = await planDocRef.get();

    if (planDocSnap.exists) {
      return mapAdminDocToPlan(planDocSnap);
    } else {
      return null;
    }
  } catch (error) {
    console.error('[getPlanByIdAdminService] Error fetching plan:', error);
    return null;
  }
};

export const getPlansByIdsAdmin = async (planIds: string[]): Promise<Plan[]> => {
  return FirebaseQueryBuilder.getItemsByIds(
    COLLECTIONS.PLANS,
    planIds,
    mapAdminDocToPlan
  );
};


export const getAllPublishedPlansAdmin = async (): Promise<Plan[]> => {
  try {
    const query = FirebaseQueryBuilder.getPublishedQuery(COLLECTIONS.PLANS);
    const querySnapshot = await query.get();
    
    const plans: Plan[] = [];
    querySnapshot.forEach(docSnap => {
      plans.push(mapAdminDocToPlan(docSnap));
    });
    return plans;
  } catch (error) {
    console.error('[getAllPublishedPlansAdmin] Error fetching published plans (Admin SDK):', error);
    return [];
  }
};

export const getPublishedPlansByCityAdmin = async (cityName: string): Promise<Plan[]> => {
  if (!cityName || typeof cityName !== 'string') {
    console.error("[getPublishedPlansByCityAdmin] Invalid cityName provided.");
    return [];
  }
  try {
    const query = FirebaseQueryBuilder.getFilteredQuery(
      COLLECTIONS.PLANS,
      { status: 'published', city: cityName },
      { timeField: 'eventTime' }
    );
    const querySnapshot = await query.get();
    
    const plans: Plan[] = [];
    querySnapshot.forEach(docSnap => {
      plans.push(mapAdminDocToPlan(docSnap));
    });
    return plans;
  } catch (error) {
    console.error(`[getPublishedPlansByCityAdmin] Error fetching published plans for city ${cityName} (Admin SDK):`, error);
    return [];
  }
};


export const getPublishedPlansByCategoryAdmin = async (categoryName: string): Promise<Plan[]> => {
  if (!categoryName || typeof categoryName !== 'string') {
    console.error("[getPublishedPlansByCategoryAdmin] Invalid categoryName provided.");
    return [];
  }
  try {
    
    const query = FirebaseQueryBuilder.getFilteredQuery(
      COLLECTIONS.PLANS,
      { status: 'published', eventTypeLowercase: categoryName.toLowerCase() },
      { timeField: 'eventTime' }
    );
    const querySnapshot = await query.get();
    
    
    const plans: Plan[] = [];
    querySnapshot.forEach(docSnap => {
      plans.push(mapAdminDocToPlan(docSnap));
    });
    return plans;
  } catch (error) {
    console.error(`[getPublishedPlansByCategoryAdmin] Error fetching published plans for category ${categoryName} (Admin SDK):`, error);
    return [];
  }
};


export const setRatingAdmin = async (
  planId: string,
  userId: string,
  ratingValue: number,
  currentPlan: Plan 
): Promise<{ success: boolean; error?: string; newAverageRating?: number | null; newReviewCount?: number }> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };

  const planRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
  const ratingRef = planRef.collection(RATINGS_SUBCOLLECTION).doc(userId);

  try {
    let finalAverageRating: number | null = currentPlan.averageRating ?? null;
    let finalReviewCount: number = currentPlan.reviewCount || 0;

    await firestoreAdmin.runTransaction(async (transaction) => {
      const userRatingDoc = await transaction.get(ratingRef);
      const allRatingsSnapshot = await transaction.get(planRef.collection(RATINGS_SUBCOLLECTION));
      
      let totalRatingSum = 0;
      let numRatings = 0;

      allRatingsSnapshot.forEach(doc => {
        if (doc.id === userId) { 
          totalRatingSum += ratingValue;
        } else { 
          const ratingData = doc.data() as Rating;
          if (ratingData && typeof ratingData.value === 'number') {
            totalRatingSum += ratingData.value;
          }
        }
        numRatings++; 
      });
      
      if (!userRatingDoc.exists) {
        // numRatings already includes the new one.
      }
      
      transaction.set(ratingRef, {
        value: ratingValue,
        createdAt: FieldValue.serverTimestamp(),
        userId: userId, 
        planId: planId, 
      });
      
      finalAverageRating = numRatings > 0 ? totalRatingSum / numRatings : null;
      finalReviewCount = numRatings;
      
      transaction.update(planRef, {
        averageRating: finalAverageRating,
        reviewCount: finalReviewCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    // Notify plan host if rater is not the host
    if (currentPlan.hostId && userId !== currentPlan.hostId) {
      // Get rater profile for notification
      const raterProfile = await getUserProfileAdmin(userId);
      await createNotification(currentPlan.hostId, {
        type: 'plan_completion',
        title: 'rated your plan',
        description: `${ratingValue} stars`,
        userName: raterProfile?.username || raterProfile?.firstName || raterProfile?.name || 'Someone',
        actionUrl: `/plans/${planId}`,
        isRead: false,
        metadata: { planId, raterId: userId, ratingValue },
        planImageUrl: currentPlan.images && currentPlan.images.length > 0 ? currentPlan.images[0].url : undefined,
      });
    }
    return { 
      success: true, 
      newAverageRating: finalAverageRating, 
      newReviewCount: finalReviewCount
    };
  } catch (error: any) {
    console.error("Error setting rating and updating aggregates (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};

export const deleteRatingAdmin = async (
  planId: string,
  userId: string,
  currentPlanData: Plan 
): Promise<{ success: boolean; error?: string; newAverageRating?: number | null; newReviewCount?: number }> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };

  const planRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
  const ratingRef = planRef.collection(RATINGS_SUBCOLLECTION).doc(userId);

  try {
    let finalAverageRating: number | null = null;
    let finalReviewCount: number = 0;

    await firestoreAdmin.runTransaction(async (transaction) => {
      const userRatingDoc = await transaction.get(ratingRef);
      if (!userRatingDoc.exists) {
        // console.log(`[deleteRatingAdmin] Rating for user ${userId} on plan ${planId} not found. No changes needed to aggregates.`);
        finalAverageRating = currentPlanData.averageRating; // Keep current aggregates
        finalReviewCount = currentPlanData.reviewCount || 0;
        // No transaction.delete() if it doesn't exist, but we won't update plan aggregates either
        return; 
      }

      transaction.delete(ratingRef);

      const allRatingsSnapshot = await transaction.get(planRef.collection(RATINGS_SUBCOLLECTION));
      
      let totalRatingSum = 0;
      let numRatings = 0;

      allRatingsSnapshot.forEach(doc => {
        if (doc.id === userId) return; // Skip the rating being deleted from calculation
        
        const ratingData = doc.data() as Rating;
        if (ratingData && typeof ratingData.value === 'number') {
          totalRatingSum += ratingData.value;
          numRatings++;
        }
      });
      
      finalAverageRating = numRatings > 0 ? totalRatingSum / numRatings : null;
      finalReviewCount = numRatings;
      
      transaction.update(planRef, {
        averageRating: finalAverageRating,
        reviewCount: finalReviewCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    return { 
      success: true, 
      newAverageRating: finalAverageRating, 
      newReviewCount: finalReviewCount 
    };
  } catch (error: any) {
    console.error("Error deleting rating and updating aggregates (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};


export const addCommentAdmin = async (
  planId: string,
  commentData: Omit<Comment, 'id' | 'createdAt' | 'planId' | 'updatedAt'>
): Promise<{success: boolean, commentId?: string, error?: string, createdComment?: Comment}> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };
  
  const commentsRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).collection(COMMENTS_SUBCOLLECTION);
  const serverTimestamp = FieldValue.serverTimestamp();
  try {
    const newCommentData = {
      ...commentData,
      planId: planId, 
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp, 
    };
    const newCommentRef = await commentsRef.add(newCommentData);
    
    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
        updatedAt: serverTimestamp 
    });

    const createdCommentSnap = await newCommentRef.get();
    const createdData = createdCommentSnap.data();
    if (!createdData) throw new Error("Failed to fetch created comment data.");
    
    const finalComment: Comment = {
      id: newCommentRef.id,
      planId: createdData.planId,
      userId: createdData.userId,
      userName: createdData.userName,
      username: createdData.username || null,
      userAvatarUrl: createdData.userAvatarUrl,
      role: createdData.role || null,
      isVerified: createdData.isVerified || false,
      text: createdData.text,
      createdAt: convertAdminTimestampToISO(createdData.createdAt),
      updatedAt: convertAdminTimestampToISO(createdData.updatedAt),
    };
    
    return { success: true, commentId: newCommentRef.id, createdComment: finalComment };
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
        createdAt: commentData.createdAt, // Preserve original timestamp
        updatedAt: FieldValue.serverTimestamp() // Update the updatedAt timestamp
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

export const updateCommentAdmin = async (
  planId: string,
  commentId: string,
  newText: string,
  requestingUserId: string
): Promise<{ success: boolean; error?: string; updatedComment?: Comment }> => {
  if (!firestoreAdmin) return { success: false, error: "Firestore Admin SDK not initialized." };

  const commentRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).collection(COMMENTS_SUBCOLLECTION).doc(commentId);
  
  try {
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      throw new Error("Comment not found to update.");
    }
    const commentData = commentDoc.data() as Comment; // Cast to your Comment type
    if (commentData.userId !== requestingUserId) {
      throw new Error("User not authorized to update this comment.");
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    await commentRef.update({
      text: newText,
      updatedAt: serverTimestamp,
    });
    
    const updatedCommentSnap = await commentRef.get();
    const updatedData = updatedCommentSnap.data();
    if (!updatedData) throw new Error("Failed to fetch updated comment data.");

    const finalComment: Comment = {
      id: updatedCommentSnap.id,
      planId: updatedData.planId,
      userId: updatedData.userId,
      userName: updatedData.userName,
      username: updatedData.username || null,
      userAvatarUrl: updatedData.userAvatarUrl,
      role: updatedData.role || null,
      isVerified: updatedData.isVerified || false,
      text: updatedData.text,
      createdAt: convertAdminTimestampToISO(updatedData.createdAt),
      updatedAt: convertAdminTimestampToISO(serverTimestamp),
    };

    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
        updatedAt: serverTimestamp
    });

    return { success: true, updatedComment: finalComment };
  } catch (error: any) {
    console.error("Error updating comment (Admin SDK):", error);
    return { success: false, error: error.message };
  }
};

export const deleteCommentAdmin = async (planId: string, commentId: string, requestingUserId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[deleteCommentAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  const commentRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).collection(COMMENTS_SUBCOLLECTION).doc(commentId);
  try {
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      console.warn(`[deleteCommentAdmin] Comment ${commentId} in plan ${planId} not found. Skipping deletion.`);
      return;
    }
    const commentData = commentDoc.data() as Comment;
    if (commentData.userId !== requestingUserId) {
      console.warn(`[deleteCommentAdmin] User ${requestingUserId} is not owner of comment ${commentId}. Deletion denied.`);
      throw new Error("User not authorized to delete this comment.");
    }
    await commentRef.delete();
    // console.log(`[deleteCommentAdmin] Comment ${commentId} deleted successfully by ${requestingUserId}.`);
    
    // Optionally decrement commentsCount on plan document (consider transactions for accuracy)
    // For simplicity, not decrementing count here. Could be handled by a Cloud Function.
    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
        updatedAt: FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error(`[deleteCommentAdmin] Error deleting comment ${commentId} from plan ${planId}:`, error);
    throw error;
  }
};

export const deletePlanAdmin = async (planId: string, requestingUserId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[deletePlanAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }

  const planRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);

  try {
    const planDoc = await planRef.get();
    if (!planDoc.exists) {
      console.warn(`[deletePlanAdmin] Plan ${planId} not found. Skipping deletion.`);
      return;
    }
    const planData = mapAdminDocToPlan(planDoc); 
    if (planData.hostId !== requestingUserId) {
      console.warn(`[deletePlanAdmin] User ${requestingUserId} is not the host of plan ${planId}. Deletion denied.`);
      throw new Error("User not authorized to delete this plan.");
    }

    const subcollections = [RATINGS_SUBCOLLECTION, COMMENTS_SUBCOLLECTION];
    for (const subcollectionName of subcollections) {
      const subcollectionRef = planRef.collection(subcollectionName);
      const snapshot = await subcollectionRef.limit(500).get(); 
      let batch = firestoreAdmin.batch();
      let count = 0;
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        if (count === 499) { 
          batch.commit().then(() => {
            if (!firestoreAdmin) throw new Error("Firestore Admin SDK not available");
            batch = firestoreAdmin.batch();
          }); 
          count = 0;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
      // console.log(`[deletePlanAdmin] Deleted ${snapshot.docs.length} documents from ${subcollectionName} for plan ${planId}.`);
    }

    await planRef.delete();
    // console.log(`[deletePlanAdmin] Plan ${planId} deleted successfully by host ${requestingUserId}.`);

  } catch (error) {
    console.error(`[deletePlanAdmin] Error deleting plan ${planId}:`, error);
    throw error;
  }
};

export const createPlanShareInviteAdmin = async (
  originalPlanId: string,
  originalPlanName: string,
  sharedByUid: string,
  sharedByName: string,
  sharedByAvatarUrl: string | null,
  sharedWithUid: string
): Promise<string> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");

  const newShareRef = firestoreAdmin.collection(PLAN_SHARES_COLLECTION).doc();
  const shareData: Omit<PlanShare, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: FieldValue; updatedAt: FieldValue } = {
    originalPlanId,
    originalPlanName,
    sharedByUid,
    sharedByName,
    sharedByAvatarUrl,
    sharedWithUid,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await newShareRef.set(shareData);

  // Get the original plan to fetch its image
  const originalPlan = await getPlanByIdAdminService(originalPlanId);

  // --- Create informational notification for the recipient ---
  const notificationData: any = {
    type: 'plan_share',
    title: 'shared a plan with you',
    description: originalPlanName,
    userName: sharedByName,
    avatarUrl: sharedByAvatarUrl,
    actionUrl: `/plans/${originalPlanId}`,
    isRead: false,
    handled: true, // informational, not actionable
    status: 'informational',
    metadata: { planId: originalPlanId, shareId: newShareRef.id },
    planImageUrl: originalPlan?.images && originalPlan.images.length > 0 ? originalPlan.images[0].url : undefined,
  };
  await createNotification(sharedWithUid, notificationData);

  return newShareRef.id;
};

export const getPlanShareByIdAdmin = async (planShareId: string): Promise<PlanShare | null> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");
  const docSnap = await firestoreAdmin.collection(PLAN_SHARES_COLLECTION).doc(planShareId).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data()!;
  return {
    id: docSnap.id,
    ...data,
    createdAt: convertAdminTimestampToISO(data.createdAt),
    updatedAt: convertAdminTimestampToISO(data.updatedAt),
  } as PlanShare;
};

export const updatePlanShareStatusAdmin = async (planShareId: string, newStatus: PlanShareStatus): Promise<void> => {
  if (!firestoreAdmin) throw new Error("Firestore Admin SDK not initialized.");
  await firestoreAdmin.collection(PLAN_SHARES_COLLECTION).doc(planShareId).update({
    status: newStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
};

export const getCompletedPlansAdmin = async (): Promise<Plan[]> => {
  if (!firestoreAdmin) {
    console.error("[getCompletedPlansAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    return [];
  }
  try {
    
    const plansRef = firestoreAdmin.collection(PLANS_COLLECTION);
    
    // Query for plans that are:
    // 1. Published AND
    // 2. Explicitly marked as completed
    const completedPlansSnapshot = await plansRef
      .where('status', '==', 'published')
      .where('status', '==', 'completed')
      .get();

    const plans: Plan[] = [];

    // Process completed plans
    completedPlansSnapshot.forEach(docSnap => {
      const plan = mapAdminDocToPlan(docSnap);
      
      plans.push(plan);
    });

    
    return plans;
  } catch (error) {
    console.error('[getCompletedPlansAdmin] Error fetching completed plans (Admin SDK):', error);
    return [];
  }
};

export const getUserPlansAdmin = async (userId: string): Promise<Plan[]> => {
  if (!userId) {
    console.error("[getUserPlansAdmin] No userId provided.");
    return [];
  }
  
  try {
    // Get hosted plans (all statuses)
    const hostedQuery = FirebaseQueryBuilder.getFilteredQuery(
      COLLECTIONS.PLANS,
      { hostId: userId },
      { timeField: 'eventTime' }
    );
    const hostedSnapshot = await hostedQuery.get();
    
    // Get invited plans (all statuses)
    const invitedQuery = FirebaseQueryBuilder.getFilteredQuery(
      COLLECTIONS.PLANS,
      { invitedParticipantUserIds: userId }, // Note: This will need special handling in QueryBuilder for array-contains
      { timeField: 'eventTime' }
    );
    
    // For now, use direct query for array-contains since QueryBuilder doesn't handle it yet
    const invitedSnapshot = await FirebaseQueryBuilder.collection(COLLECTIONS.PLANS)
      .where('invitedParticipantUserIds', 'array-contains', userId)
      .orderBy('eventTime', 'desc')
      .get();
    
    const plans: Plan[] = [];
    const planIds = new Set<string>();
    
    // Add hosted plans
    hostedSnapshot.forEach(docSnap => {
      const plan = mapAdminDocToPlan(docSnap);
      if (!planIds.has(plan.id)) {
        plans.push(plan);
        planIds.add(plan.id);
      }
    });
    
    // Add invited plans (avoid duplicates)
    invitedSnapshot.forEach(docSnap => {
      const plan = mapAdminDocToPlan(docSnap);
      if (!planIds.has(plan.id)) {
        plans.push(plan);
        planIds.add(plan.id);
      }
    });
    
    // Sort by eventTime descending
    plans.sort((a, b) => {
      const timeA = new Date(a.eventTime).getTime();
      const timeB = new Date(b.eventTime).getTime();
      return timeB - timeA;
    });
    
    
    return plans;
  } catch (error) {
    console.error(`[getUserPlansAdmin] Error fetching plans for user ${userId}:`, error);
    return [];
  }
};
