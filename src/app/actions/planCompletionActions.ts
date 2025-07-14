'use server';

import { firestoreAdmin, authAdmin } from '../../lib/firebaseAdmin';
// Using crypto.randomUUID() instead of uuid package for better compatibility
import { createTemplateFromPlan } from '@/lib/templateUtils';

const PLANS_COLLECTION = 'plans';
import type { Plan } from '../../types/user';
import { recordPlanCompletion, getCompletionStatus } from '../../services/planCompletionService.server';
import { revalidatePath } from 'next/cache';

// 🔤 Helper function for string similarity comparison
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  // Convert to lowercase and split into words
  const words1 = str1.toLowerCase().split(/\s+/).filter(Boolean);
  const words2 = str2.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate Jaccard similarity (intersection over union)
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

export async function markPlanAsCompletedAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[markPlanAsCompletedAction] Called for planId:', planId);
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

    // 🧠 Enhanced smart duplicate detection for template creation
    let shouldCreateNewTemplate = true;
    
    if (planData.originalPlanId) {
      // This plan was copied from another plan/template - check if it's been modified
      try {
        const originalPlanDoc = await firestoreAdmin.collection(PLANS_COLLECTION).doc(planData.originalPlanId).get();
        if (originalPlanDoc.exists) {
          const originalPlan = originalPlanDoc.data() as Plan;
          
          // 🔍 Enhanced comparison logic with normalized data
          const normalizeItineraryForComparison = (itinerary: any[]) => {
            return itinerary.map(item => ({
              placeName: item.placeName?.trim(),
              description: item.description?.trim(),
              address: item.address?.trim(),
              googlePlaceId: item.googlePlaceId,
              // Include activity type but ignore time-specific data
              activityType: item.activityType,
              estimatedDuration: item.estimatedDuration
            })).filter(item => item.placeName); // Remove empty items
          };

          const isContentUnmodified = (
            planData.name?.trim() === originalPlan.name?.trim() &&
            planData.description?.trim() === originalPlan.description?.trim() &&
            planData.location?.trim() === originalPlan.location?.trim() &&
            planData.city?.trim() === originalPlan.city?.trim() &&
            planData.eventType === originalPlan.eventType &&
            planData.priceRange === originalPlan.priceRange &&
            JSON.stringify(normalizeItineraryForComparison(planData.itinerary || [])) === 
            JSON.stringify(normalizeItineraryForComparison(originalPlan.itinerary || []))
          );
          
          // 🎯 Smart logic: Don't create template if:
          // 1. Content is unmodified AND original is already a template
          // 2. OR if original was created by Crossand Team (admin templates)
          if (isContentUnmodified && (
            originalPlan.isTemplate || 
            originalPlan.hostId === 'crossand-team' ||
            originalPlan.creatorName === 'Crossand Team'
          )) {
            shouldCreateNewTemplate = false;
            console.log(`[markPlanAsCompletedAction] Skipping template creation - plan ${planId} is unmodified from original template/admin plan ${planData.originalPlanId}`);
          }
        }
      } catch (error) {
        console.warn('[markPlanAsCompletedAction] Could not check original plan for modifications:', error);
        // If we can't check, err on the side of creating a template to avoid losing potential value
      }
    }
    
    // 🔄 Additional check: Look for similar existing templates to prevent near-duplicates
    if (shouldCreateNewTemplate) {
      try {
        const similarTemplatesQuery = await firestoreAdmin.collection(PLANS_COLLECTION)
          .where('isTemplate', '==', true)
          .where('city', '==', planData.city)
          .where('eventType', '==', planData.eventType)
          .where('status', '==', 'published')
          .limit(50)
          .get();

        const similarTemplates = similarTemplatesQuery.docs.map(doc => doc.data() as Plan);
        
        // Check for very similar templates by name similarity
        const currentName = planData.name?.toLowerCase().trim();
        const hasSimilarTemplate = similarTemplates.some(template => {
          const templateName = template.name?.toLowerCase().trim();
          if (!templateName || !currentName) return false;
          
          // Check for high similarity (>80% similar or same words)
          const similarity = calculateStringSimilarity(currentName, templateName);
          return similarity > 0.8;
        });
        
        if (hasSimilarTemplate) {
          shouldCreateNewTemplate = false;
          console.log(`[markPlanAsCompletedAction] Skipping template creation - similar template already exists for "${planData.name}" in ${planData.city}`);
        }
      } catch (error) {
        console.warn('[markPlanAsCompletedAction] Could not check for similar templates:', error);
        // Continue with template creation if similarity check fails
      }
    }

    // Prepare update data based on whether we should create a new template
    const baseUpdateData = {
      status: 'completed' as const, // Primary completion tracking field
      completedAt,
      completionConfirmedBy,
      highlightsEnabled: true,
      updatedAt: completedAt
    };

    let sanitizedUpdateData;
    
    if (shouldCreateNewTemplate) {
      // Just mark as completed - template will be created separately
      sanitizedUpdateData = baseUpdateData;
    } else {
      // Just mark as completed without converting to template
      sanitizedUpdateData = baseUpdateData;
    }

    console.log('[markPlanAsCompletedAction] shouldCreateNewTemplate:', shouldCreateNewTemplate);
    if (shouldCreateNewTemplate) {
      console.log('[markPlanAsCompletedAction] Creating template for planId:', planId);
    } else {
      console.log('[markPlanAsCompletedAction] Not creating template for planId:', planId);
    }

    // Before Firestore update
    console.log('[markPlanAsCompletedAction] Updating Firestore for planId:', planId, 'with data:', sanitizedUpdateData);
    try {
      // 1. Always update the original plan to completed (retain all user/event data)
      await firestoreAdmin.collection(PLANS_COLLECTION).doc(planId).update({
        ...baseUpdateData,
      });
      console.log('[markPlanAsCompletedAction] Original plan marked as completed:', planId);

      // 2. If shouldCreateNewTemplate, create a new template document
      if (shouldCreateNewTemplate) {
        const newTemplateId = crypto.randomUUID();
        const templateData = {
          ...createTemplateFromPlan(planData),
          id: newTemplateId,
        };
        await firestoreAdmin.collection(PLANS_COLLECTION).doc(newTemplateId).set(templateData);
        console.log('[markPlanAsCompletedAction] New template created:', newTemplateId, 'from plan:', planId);
      }
    } catch (updateError) {
      console.error('[markPlanAsCompletedAction] Firestore update FAILED for planId:', planId, updateError);
      throw updateError;
    }

    // Verify the completion status was properly set
    const finalStatus = await getCompletionStatus(planId, userId);
    if (!finalStatus?.isPlanCompleted) {
      console.warn(`[markPlanAsCompletedAction] Plan ${planId} completion status verification failed`);
    }

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

    // Verify the confirmation was properly recorded
    const finalStatus = await getCompletionStatus(planId, userId);
    if (!finalStatus?.isUserConfirmed) {
      console.warn(`[confirmPlanCompletionAction] User ${userId} confirmation for plan ${planId} verification failed`);
    }

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