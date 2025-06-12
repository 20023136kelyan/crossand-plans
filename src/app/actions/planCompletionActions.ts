'use server';

import { firestoreAdmin, authAdmin } from '@/lib/firebaseAdmin';
import { recordPlanCompletion } from '@/services/planCompletionService.server';
import type { Plan } from '@/types/user';
import { revalidatePath } from 'next/cache';

const PLANS_COLLECTION = 'plans';

export async function markPlanAsCompletedAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!firestoreAdmin || !authAdmin) {
    console.error('[markPlanAsCompletedAction] Firebase Admin SDK is not initialized.');
    return { success: false, error: 'Database not available' };
  }

  try {
    // Verify the ID token and get user ID
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get the plan to verify it exists and user has permission
    const planDoc = await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).get();
    
    if (!planDoc.exists) {
      return { success: false, error: 'Plan not found' };
    }

    const planData = planDoc.data() as Plan;
    
    // Check if user is host or participant
    const isHost = planData.hostId === userId;
    const isParticipant = planData.invitedParticipantUserIds?.includes(userId);
    
    if (!isHost && !isParticipant) {
      return { success: false, error: 'You do not have permission to mark this plan as completed' };
    }

    // Check if plan is already completed
    if (planData.isCompleted) {
      return { success: false, error: 'Plan is already marked as completed' };
    }

    // Check if plan event time has passed
    if (planData.eventTime) {
      const eventDate = new Date(planData.eventTime);
      const now = new Date();
      if (eventDate > now) {
        return { success: false, error: 'Cannot mark future plans as completed' };
      }
    }

    // Record the completion in the plan completions collection
    const allParticipantIds = [planData.hostId, ...(planData.invitedParticipantUserIds || [])].filter(Boolean);
    const completionRecorded = await recordPlanCompletion(
      planId,
      userId,
      allParticipantIds,
      'manual'
    );

    if (!completionRecorded) {
      return { success: false, error: 'Failed to record plan completion' };
    }

    // Update the plan document
    const completedAt = new Date().toISOString();
    const completionConfirmedBy = planData.completionConfirmedBy || [];
    
    if (!completionConfirmedBy.includes(userId)) {
      completionConfirmedBy.push(userId);
    }

    // Check if this plan was copied from a template and if it has been modified
    let shouldCreateNewTemplate = true;
    
    if (planData.originalPlanId) {
      // This plan was copied from another plan/template - check if it's been modified
      try {
        const originalPlanDoc = await firestoreAdmin.collection(PLANS_COLLECTION).doc(planData.originalPlanId).get();
        if (originalPlanDoc.exists) {
          const originalPlan = originalPlanDoc.data() as Plan;
          
          // Compare key template fields to see if this plan is essentially the same
          const isUnmodified = (
            planData.name === originalPlan.name &&
            planData.description === originalPlan.description &&
            planData.location === originalPlan.location &&
            planData.city === originalPlan.city &&
            planData.eventType === originalPlan.eventType &&
            planData.priceRange === originalPlan.priceRange &&
            JSON.stringify(planData.itinerary.map(item => ({
              placeName: item.placeName,
              description: item.description,
              address: item.address,
              googlePlaceId: item.googlePlaceId
            }))) === JSON.stringify(originalPlan.itinerary.map(item => ({
              placeName: item.placeName,
              description: item.description,
              address: item.address,
              googlePlaceId: item.googlePlaceId
            })))
          );
          
          if (isUnmodified && originalPlan.isTemplate) {
            // Plan is unmodified from original template - don't create a new template
            shouldCreateNewTemplate = false;
          }
        }
      } catch (error) {
        console.warn('[markPlanAsCompletedAction] Could not check original plan for modifications:', error);
        // If we can't check, err on the side of creating a template
      }
    }

    // Prepare update data based on whether we should create a new template
    const baseUpdateData = {
      isCompleted: true,
      completedAt,
      completionConfirmedBy,
      highlightsEnabled: true,
      updatedAt: completedAt
    };

    let sanitizedUpdateData;
    
    if (shouldCreateNewTemplate) {
      // Create a new template from this completed plan
      sanitizedUpdateData = {
        ...baseUpdateData,
        isTemplate: true, // Make completed plans available as templates
        // Clear personal data for template use
        participantUserIds: [],
        invitedParticipantUserIds: [],
        participantResponses: {},
        // Keep original creator info for attribution (not host, as templates have no hosts)
        templateOriginalHostId: planData.hostId,
        templateOriginalHostName: planData.hostName,
        // Clear waitlist and other personal data
        waitlistUserIds: [],
        privateNotes: null,
        // Remove specific date but preserve time information in itinerary
        eventTime: null, // Templates don't have specific dates
        // Preserve essential template data
        name: planData.name,
        description: planData.description,
        location: planData.location,
        city: planData.city,
        eventType: planData.eventType,
        priceRange: planData.priceRange,
        // Preserve itinerary with time slots but remove specific dates
        itinerary: planData.itinerary.map(item => ({
          ...item,
          // Keep time information but remove date specificity
          startTime: item.startTime ? new Date(item.startTime).toTimeString().split(' ')[0] : null,
          endTime: item.endTime ? new Date(item.endTime).toTimeString().split(' ')[0] : null
        })),
        photoHighlights: planData.photoHighlights || [],
        // Preserve ratings and comments for templates
        averageRating: planData.averageRating,
        reviewCount: planData.reviewCount
      };
    } else {
      // Just mark as completed without converting to template
      sanitizedUpdateData = baseUpdateData;
    }

    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update(sanitizedUpdateData);

    // Revalidate relevant paths
    revalidatePath('/plans');
    revalidatePath('/explore');
    revalidatePath(`/p/${planId}`);

    console.log(`[markPlanAsCompletedAction] Successfully marked plan ${planId} as completed by user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error('[markPlanAsCompletedAction] Error marking plan as completed:', error);
    return { success: false, error: 'Failed to mark plan as completed' };
  }
}

export async function confirmPlanCompletionAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!firestoreAdmin || !authAdmin) {
    console.error('[confirmPlanCompletionAction] Firebase Admin SDK is not initialized.');
    return { success: false, error: 'Database not available' };
  }

  try {
    // Verify the ID token and get user ID
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get the plan to verify it exists and user has permission
    const planDoc = await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).get();
    
    if (!planDoc.exists) {
      return { success: false, error: 'Plan not found' };
    }

    const planData = planDoc.data() as Plan;
    
    // Check if user is host or participant
    const isHost = planData.hostId === userId;
    const isParticipant = planData.invitedParticipantUserIds?.includes(userId);
    
    if (!isHost && !isParticipant) {
      return { success: false, error: 'You do not have permission to confirm this plan completion' };
    }

    // Check if plan is already completed
    if (!planData.isCompleted) {
      return { success: false, error: 'Plan is not marked as completed yet' };
    }

    // Add user to completion confirmation list
    const completionConfirmedBy = planData.completionConfirmedBy || [];
    
    if (completionConfirmedBy.includes(userId)) {
      return { success: false, error: 'You have already confirmed this plan completion' };
    }

    completionConfirmedBy.push(userId);

    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
      completionConfirmedBy,
      updatedAt: new Date().toISOString()
    });

    // Revalidate relevant paths
    revalidatePath('/plans');
    revalidatePath(`/p/${planId}`);

    console.log(`[confirmPlanCompletionAction] User ${userId} confirmed completion of plan ${planId}`);
    return { success: true };

  } catch (error) {
    console.error('[confirmPlanCompletionAction] Error confirming plan completion:', error);
    return { success: false, error: 'Failed to confirm plan completion' };
  }
}