import { firestoreAdmin } from '../lib/firebaseAdmin';
import type { Plan, PlanCompletion, UserAffinity } from '../types/user';
// Using crypto.randomUUID() instead of uuid package for better compatibility
import { addHours } from 'date-fns';
import * as crypto from 'crypto';
import { Firestore } from 'firebase-admin/firestore';
import { FirebaseQueryBuilder, COLLECTIONS } from '../lib/data/core/QueryBuilder';
import { createNotificationForMultipleUsers } from './notificationService.server';

// Legacy constants for backward compatibility
const PLANS_COLLECTION = COLLECTIONS.PLANS;
const PLAN_COMPLETIONS_COLLECTION = 'plan_completions';
const USER_AFFINITIES_COLLECTION = 'user_affinities';

// Unified completion status interface
export interface CompletionStatus {
  isPlanCompleted: boolean; // Plan-level completion (host marked as completed)
  isUserConfirmed: boolean; // User has confirmed their participation
  planCompletedAt?: string; // When host marked plan as completed
  userCompletedAt?: string; // When user confirmed their completion
  totalConfirmations: number; // Number of users who confirmed
  totalParticipants: number; // Total number of participants (including host)
  confirmationRate: number; // Percentage of participants who confirmed
}

/**
 * Get unified completion status for a plan and specific user
 */
export async function getCompletionStatus(
  planId: string, 
  userId: string
): Promise<CompletionStatus | null> {
  try {
    // Get plan data
    const planDoc = await FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId).get();
    if (!planDoc.exists) return null;
    
    const plan = planDoc.data() as Plan;
    
    // Get user's individual completion record
    const completionQuery = await FirebaseQueryBuilder.getFilteredQuery(PLAN_COMPLETIONS_COLLECTION, {
      planId: planId,
      userId: userId
    }, { limit: 1 }).get();
    
    const userCompletion = completionQuery.empty ? null : completionQuery.docs[0].data() as PlanCompletion;
    
    // Calculate totals
    const totalParticipants = 1 + (plan.participantUserIds?.length || 0); // Host + participants
    const totalConfirmations = plan.completionConfirmedBy?.length || 0;
    const confirmationRate = totalParticipants > 0 ? (totalConfirmations / totalParticipants) * 100 : 0;
    
    return {
      isPlanCompleted: plan.status === 'completed',
      isUserConfirmed: plan.completionConfirmedBy?.includes(userId) || false,
      planCompletedAt: plan.completedAt,
      userCompletedAt: userCompletion?.completedAt,
      totalConfirmations,
      totalParticipants,
      confirmationRate
    };
  } catch (error) {
    console.error('[getCompletionStatus] Error:', error);
    return null;
  }
}

/**
 * Check if a plan should be considered "fully completed"
 * A plan is fully completed when:
 * 1. Host has marked it as completed (status = 'completed')
 * 2. At least 50% of participants have confirmed (or all if less than 4 people)
 */
export function isFullyCompleted(status: CompletionStatus): boolean {
  if (!status.isPlanCompleted) return false;
  
  // For small groups (4 or fewer), require all to confirm
  if (status.totalParticipants <= 4) {
    return status.totalConfirmations === status.totalParticipants;
  }
  
  // For larger groups, require at least 50% confirmation
  return status.confirmationRate >= 50;
}

/**
 * Get completion status for multiple plans (for list views)
 */
export async function getBulkCompletionStatus(
  planIds: string[],
  userId: string
): Promise<Record<string, CompletionStatus>> {
  const results: Record<string, CompletionStatus> = {};
  
  // Process in batches to avoid overwhelming Firestore
  const batchSize = 10;
  for (let i = 0; i < planIds.length; i += batchSize) {
    const batch = planIds.slice(i, i + batchSize);
    const promises = batch.map(async (planId) => {
      const status = await getCompletionStatus(planId, userId);
      if (status) {
        results[planId] = status;
      }
    });
    await Promise.all(promises);
  }
  
  return results;
}

// Helper function to generate a unique QR code data
const generateQRCodeData = (planId: string, venueId: string): string => {
  const timestamp = Date.now();
  const uniqueString = `${planId}-${venueId}-${timestamp}`;
  return crypto.createHash('sha256').update(uniqueString).digest('hex');
};

// Helper function to calculate affinity score
const calculateAffinityScore = (completedCount: number, lastCompletedAt: string): number => {
  const now = new Date().getTime();
  const lastCompleted = new Date(lastCompletedAt).getTime();
  const daysSinceLastCompleted = (now - lastCompleted) / (1000 * 60 * 60 * 24);

  // Base score from completed plans together
  let baseScore = Math.log10(completedCount + 1) * 50; // 0-100 scale

  // Recency bonus/penalty
  const recencyFactor = Math.max(0, 100 - (daysSinceLastCompleted * 2)) / 100; // 0-1 scale
  
  return baseScore * recencyFactor;
};

// Generate QR code for venue plan verification
export async function generateVenuePlanQR(planId: string): Promise<string | null> {
  try {
    const plan = await FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId).get();
    if (!plan.exists) {
      throw new Error('Plan not found');
    }

    const planData = plan.data();
    if (!planData?.venueId) {
      throw new Error('No venue associated with this plan');
    }

    const qrData = generateQRCodeData(planId, planData.venueId);
    const expiresAt = addHours(new Date(), 24); // QR code expires in 24 hours

    await FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId).update({
      qrVerificationData: qrData,
      qrExpiresAt: expiresAt,
    });

    return qrData;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

// Record a plan completion
export async function recordPlanCompletion(
  planId: string,
  userId: string,
  participantIds: string[],
  verificationMethod: 'qr_code' | 'manual' | 'auto',
  qrCodeData?: string
): Promise<boolean> {
  try {
    // Check if user already has a completion record for this plan
    const existingQuery = await FirebaseQueryBuilder.getFilteredQuery(PLAN_COMPLETIONS_COLLECTION, {
      planId: planId,
      userId: userId
    }, { limit: 1 }).get();
    
    if (!existingQuery.empty) {
      console.log(`[recordPlanCompletion] User ${userId} already has completion record for plan ${planId}`);
      return true; // Already recorded, consider it successful
    }

    const completion: PlanCompletion = {
      id: crypto.randomUUID(),
      planId,
      userId,
      completedAt: new Date().toISOString(),
      verificationMethod,
      participantIds,
      ...(qrCodeData && { qrCodeData }),
    };

    // Verify QR code if provided
    if (verificationMethod === 'qr_code' && qrCodeData) {
      const plan = await FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId).get();
      if (!plan.exists) {
        throw new Error('Plan not found');
      }

      const planData = plan.data();
      if (planData?.qrVerificationData !== qrCodeData) {
        throw new Error('Invalid QR code');
      }

      if (planData?.qrExpiresAt && new Date(planData.qrExpiresAt) < new Date()) {
        throw new Error('QR code has expired');
      }

      completion.venueVerified = true;
    }

    // Record the completion
    await FirebaseQueryBuilder.collection(PLAN_COMPLETIONS_COLLECTION).doc(completion.id).set(completion);

    // Update affinity scores for all participant pairs
    const allParticipants = [...participantIds, userId];
    for (let i = 0; i < allParticipants.length; i++) {
      for (let j = i + 1; j < allParticipants.length; j++) {
        await updateAffinityScore(allParticipants[i], allParticipants[j]);
      }
    }
    // Notify all participants and host
    const planDoc = await FirebaseQueryBuilder.doc(COLLECTIONS.PLANS, planId).get();
    const planData = planDoc.exists ? planDoc.data() : null;
    const hostId = planData?.hostId;
    const notifyUsers = Array.from(new Set([...participantIds, userId, hostId].filter(Boolean)));
    if (notifyUsers.length > 0) {
      await createNotificationForMultipleUsers(notifyUsers, {
        type: 'plan_completion',
        title: 'Plan Completed',
        description: planData?.name ? `The plan "${planData.name}" has been completed.` : 'A plan you participated in has been completed.',
        actionUrl: `/plans/${planId}`,
        isRead: false,
        metadata: { planId },
      });
    }
    return true;
  } catch (error) {
    console.error('Error recording plan completion:', error);
    return false;
  }
}

// Update affinity score between two users
async function updateAffinityScore(userId1: string, userId2: string): Promise<void> {
  try {
    // Ensure consistent ordering of user IDs
    const [sortedUser1, sortedUser2] = [userId1, userId2].sort();
    const affinityId = `${sortedUser1}-${sortedUser2}`;

    // Get all plan completions where both users participated
    const completions = await FirebaseQueryBuilder.collection(PLAN_COMPLETIONS_COLLECTION)
      .where('participantIds', 'array-contains', sortedUser1)
      .get();

    const sharedCompletions = completions.docs
      .map(doc => doc.data() as PlanCompletion)
      .filter(completion => completion.participantIds.includes(sortedUser2))
      .sort((a: PlanCompletion, b: PlanCompletion) => 
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );

    if (sharedCompletions.length === 0) {
      return;
    }

    const affinity: UserAffinity = {
      userId1: sortedUser1,
      userId2: sortedUser2,
      score: calculateAffinityScore(sharedCompletions.length, sharedCompletions[0].completedAt),
      lastUpdated: new Date().toISOString(),
      completedPlansCount: sharedCompletions.length,
      lastPlanCompletedAt: sharedCompletions[0].completedAt,
    };

    await FirebaseQueryBuilder.collection(USER_AFFINITIES_COLLECTION).doc(affinityId).set(affinity);
  } catch (error) {
    console.error('Error updating affinity score:', error);
  }
}

// Get affinity score between two users
export async function getAffinityScore(userId1: string, userId2: string): Promise<number> {
  try {
    const [sortedUser1, sortedUser2] = [userId1, userId2].sort();
    const affinityId = `${sortedUser1}-${sortedUser2}`;

    const affinityDoc = await FirebaseQueryBuilder.collection(USER_AFFINITIES_COLLECTION).doc(affinityId).get();
    if (!affinityDoc.exists) {
      return 0;
    }

    const affinity = affinityDoc.data() as UserAffinity;
    return affinity.score;
  } catch (error) {
    console.error('Error getting affinity score:', error);
    return 0;
  }
}

// Get all user affinities for a user
export async function getUserAffinities(userId: string): Promise<UserAffinity[]> {
  try {
    const affinities1 = await FirebaseQueryBuilder.collection(USER_AFFINITIES_COLLECTION)
      .where('userId1', '==', userId)
      .get();

    const affinities2 = await FirebaseQueryBuilder.collection(USER_AFFINITIES_COLLECTION)
      .where('userId2', '==', userId)
      .get();

    const allAffinities = [
      ...affinities1.docs.map(doc => doc.data() as UserAffinity),
      ...affinities2.docs.map(doc => doc.data() as UserAffinity),
    ];

    return allAffinities.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error getting user affinities:', error);
    return [];
  }
}