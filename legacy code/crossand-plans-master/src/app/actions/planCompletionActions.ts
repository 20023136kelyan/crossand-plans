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

    await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
      isCompleted: true,
      completedAt,
      completionConfirmedBy,
      highlightsEnabled: true,
      isTemplate: true, // Make completed plans available as templates
      updatedAt: completedAt
    });

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