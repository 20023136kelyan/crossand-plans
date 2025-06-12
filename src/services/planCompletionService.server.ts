import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { PlanCompletion, UserAffinity, Plan } from '@/types/user';
import { v4 as uuidv4 } from 'uuid';
import { addHours } from 'date-fns';
import * as crypto from 'crypto';
import { Firestore } from 'firebase-admin/firestore';

const PLAN_COMPLETIONS_COLLECTION = 'plan_completions';
const USER_AFFINITIES_COLLECTION = 'user_affinities';

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
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return null;
  }

  const db = firestoreAdmin as Firestore;

  try {
    const plan = await db.collection('plans').doc(planId).get();
    if (!plan.exists) {
      throw new Error('Plan not found');
    }

    const planData = plan.data();
    if (!planData?.venueId) {
      throw new Error('No venue associated with this plan');
    }

    const qrData = generateQRCodeData(planId, planData.venueId);
    const expiresAt = addHours(new Date(), 24); // QR code expires in 24 hours

    await db.collection('plans').doc(planId).update({
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
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return false;
  }

  const db = firestoreAdmin as Firestore;

  try {
    const completion: PlanCompletion = {
      id: uuidv4(),
      planId,
      userId,
      completedAt: new Date().toISOString(),
      verificationMethod,
      participantIds,
      qrCodeData,
    };

    // Verify QR code if provided
    if (verificationMethod === 'qr_code' && qrCodeData) {
      const plan = await db.collection('plans').doc(planId).get();
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
    await db.collection(PLAN_COMPLETIONS_COLLECTION).doc(completion.id).set(completion);

    // Update affinity scores for all participant pairs
    const allParticipants = [...participantIds, userId];
    for (let i = 0; i < allParticipants.length; i++) {
      for (let j = i + 1; j < allParticipants.length; j++) {
        await updateAffinityScore(allParticipants[i], allParticipants[j]);
      }
    }

    return true;
  } catch (error) {
    console.error('Error recording plan completion:', error);
    return false;
  }
}

// Update affinity score between two users
async function updateAffinityScore(userId1: string, userId2: string): Promise<void> {
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return;
  }

  const db = firestoreAdmin as Firestore;

  try {
    // Ensure consistent ordering of user IDs
    const [sortedUser1, sortedUser2] = [userId1, userId2].sort();
    const affinityId = `${sortedUser1}-${sortedUser2}`;

    // Get all plan completions where both users participated
    const completions = await db.collection(PLAN_COMPLETIONS_COLLECTION)
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

    await db.collection(USER_AFFINITIES_COLLECTION).doc(affinityId).set(affinity);
  } catch (error) {
    console.error('Error updating affinity score:', error);
  }
}

// Get affinity score between two users
export async function getAffinityScore(userId1: string, userId2: string): Promise<number> {
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return 0;
  }

  const db = firestoreAdmin as Firestore;

  try {
    const [sortedUser1, sortedUser2] = [userId1, userId2].sort();
    const affinityId = `${sortedUser1}-${sortedUser2}`;

    const affinityDoc = await db.collection(USER_AFFINITIES_COLLECTION).doc(affinityId).get();
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
  if (!firestoreAdmin) {
    console.error('Firestore admin not initialized');
    return [];
  }

  const db = firestoreAdmin as Firestore;

  try {
    const affinities1 = await db.collection(USER_AFFINITIES_COLLECTION)
      .where('userId1', '==', userId)
      .get();

    const affinities2 = await db.collection(USER_AFFINITIES_COLLECTION)
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