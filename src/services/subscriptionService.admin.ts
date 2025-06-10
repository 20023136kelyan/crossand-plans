import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import type { Subscription, SubscriptionStatus, SubscriptionPlan } from '@/types/subscription';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

export const createSubscription = async (
  userId: string,
  plan: SubscriptionPlan,
  priceId: string,
  amount: number,
  currency: string,
  paymentMethod: { type: 'card' | 'paypal'; lastFour?: string; brand?: string },
  customerId?: string,
  stripeSubscriptionId?: string
): Promise<string> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const now = AdminTimestamp.now();
  const expiresAt = new AdminTimestamp(now.seconds + 30 * 24 * 60 * 60, 0); // 30 days from now

  const subscriptionData: Omit<Subscription, 'id'> = {
    userId,
    status: 'active',
    plan,
    createdAt: now,
    expiresAt,
    autoRenew: true,
    lastBillingDate: now,
    nextBillingDate: expiresAt,
    cancelledAt: null,
    features: {
      maxPlans: plan === 'enterprise' ? Infinity : plan === 'premium' ? 100 : 10,
      maxParticipants: plan === 'enterprise' ? Infinity : plan === 'premium' ? 50 : 10,
      premiumFeatures: plan !== 'basic',
      prioritySupport: plan === 'enterprise',
      customBranding: plan === 'enterprise',
    },
    paymentMethod,
    priceId,
    amount,
    currency,
    customerId,
    stripeSubscriptionId,
  };

  const docRef = await firestoreAdmin.collection(SUBSCRIPTIONS_COLLECTION).add(subscriptionData);
  return docRef.id;
};

export const updateSubscriptionStatus = async (
  subscriptionId: string,
  status: SubscriptionStatus,
  cancelledAt?: Date
): Promise<void> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const updateData: Partial<Subscription> = {
    status,
    ...(cancelledAt && { cancelledAt: AdminTimestamp.fromDate(cancelledAt) }),
    ...(status === 'cancelled' && { autoRenew: false }),
  };

  await firestoreAdmin
    .collection(SUBSCRIPTIONS_COLLECTION)
    .doc(subscriptionId)
    .update(updateData);
};

export const getActiveSubscription = async (userId: string): Promise<Subscription | null> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const querySnapshot = await firestoreAdmin
    .collection(SUBSCRIPTIONS_COLLECTION)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Subscription;
};

export const checkSubscriptionExpiry = async (): Promise<void> => {
  if (!firestoreAdmin) {
    throw new Error('Firestore Admin SDK not initialized');
  }

  const now = AdminTimestamp.now();
  const expiredSubscriptions = await firestoreAdmin
    .collection(SUBSCRIPTIONS_COLLECTION)
    .where('status', '==', 'active')
    .where('expiresAt', '<=', now)
    .get();

  const batch = firestoreAdmin.batch();
  expiredSubscriptions.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'expired',
      autoRenew: false,
    });
  });

  if (!expiredSubscriptions.empty) {
    await batch.commit();
  }
};