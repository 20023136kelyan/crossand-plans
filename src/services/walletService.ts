import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FirebaseQueryBuilder, COLLECTIONS } from '@/lib/data/core/QueryBuilder';
import type { Firestore } from 'firebase-admin/firestore';

export interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'reward' | 'redemption';
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface WalletData {
  balance: number;
  credits: number;
  rewardPoints: number;
  transactions: Transaction[];
  rewards: any[];
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'credits' | 'feature_boost' | 'discount';
  available: boolean;
  metadata?: Record<string, any>;
}

// Add missing collections to QueryBuilder constants
const WALLETS_COLLECTION = 'wallets';

/**
 * Get user's wallet data including balance, credits, reward points, and transaction history
 */
export async function getUserWalletData(userId: string): Promise<WalletData> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;

  // Get user's wallet data using QueryBuilder
  const walletDoc = await FirebaseQueryBuilder.doc(WALLETS_COLLECTION, userId).get();
  let walletData = {
    balance: 0,
    credits: 0,
    rewardPoints: 0
  };

  if (walletDoc.exists) {
    const data = walletDoc.data();
    walletData = {
      balance: data?.balance || 0,
      credits: data?.credits || 0,
      rewardPoints: data?.rewardPoints || 0
    };
  } else {
    // Create wallet for new user with welcome bonus
    const newWalletData = {
      balance: 500, // $5.00 welcome bonus
      credits: 0,
      rewardPoints: 100, // 100 welcome reward points
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await FirebaseQueryBuilder.doc(WALLETS_COLLECTION, userId).set(newWalletData);
    walletData = newWalletData;

    // Create welcome transactions
    await createWelcomeTransactions(userId);
  }

  // Get transaction history using QueryBuilder
  const transactionsQuery = FirebaseQueryBuilder.getUserTransactionsQuery(userId, { limit: 50 });
  const transactionsSnapshot = await transactionsQuery.get();

  const transactions = transactionsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      date: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      status: data.status || 'completed',
      metadata: data.metadata
    };
  });

  // Get available rewards using QueryBuilder
  const rewardsQuery = FirebaseQueryBuilder.buildQuery({
    collection: COLLECTIONS.REWARDS,
    filters: [{ field: 'available', operator: '==', value: true }],
    orderBy: [{ field: 'cost', direction: 'asc' }],
    limit: 50
  });
  const rewardsSnapshot = await rewardsQuery.get();

  const rewards = rewardsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    available: true
  }));

  return {
    balance: walletData.balance,
    credits: walletData.credits,
    rewardPoints: walletData.rewardPoints,
    transactions,
    rewards
  };
}

/**
 * Create welcome transactions for new users
 */
async function createWelcomeTransactions(userId: string): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const batch = FirebaseQueryBuilder.createBatch();
  const now = new Date();

  // Welcome bonus transaction
  const welcomeBonusRef = FirebaseQueryBuilder.collection(COLLECTIONS.TRANSACTIONS).doc();
  batch.set(welcomeBonusRef, {
    userId,
    type: 'credit',
    amount: 500,
    description: 'Welcome bonus',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: {
      source: 'welcome_bonus',
      automated: true
    }
  });

  // Welcome reward points transaction
  const rewardPointsRef = FirebaseQueryBuilder.collection(COLLECTIONS.TRANSACTIONS).doc();
  batch.set(rewardPointsRef, {
    userId,
    type: 'reward',
    amount: 100,
    description: 'Sign-up reward points',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: {
      source: 'signup_bonus',
      automated: true
    }
  });

  await batch.commit();
}

/**
 * Add a transaction to user's wallet
 */
export async function addTransaction(
  userId: string,
  type: Transaction['type'],
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<string> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const batch = FirebaseQueryBuilder.createBatch();
  const now = new Date();

  // Create transaction record using QueryBuilder
  const transactionRef = FirebaseQueryBuilder.collection(COLLECTIONS.TRANSACTIONS).doc();
  batch.set(transactionRef, {
    userId,
    type,
    amount,
    description,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: metadata || {}
  });

  // Update wallet balance using QueryBuilder
  const walletRef = FirebaseQueryBuilder.doc(WALLETS_COLLECTION, userId);
  const walletDoc = await walletRef.get();
  
  if (walletDoc.exists) {
    const currentData = walletDoc.data();
    const newBalance = (currentData?.balance || 0) + (type === 'credit' ? amount : -amount);
    const newCredits = type === 'credit' ? (currentData?.credits || 0) + amount : currentData?.credits || 0;
    const newRewardPoints = type === 'reward' ? (currentData?.rewardPoints || 0) + amount : currentData?.rewardPoints || 0;
    
    batch.update(walletRef, {
      balance: Math.max(0, newBalance),
      credits: Math.max(0, newCredits),
      rewardPoints: Math.max(0, newRewardPoints),
      updatedAt: now
    });
  }

  await batch.commit();
  return transactionRef.id;
}

/**
 * Redeem a reward using reward points
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
  pointsCost: number
): Promise<{ success: boolean; message: string }> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  // Get user's current wallet data using QueryBuilder
  const walletDoc = await FirebaseQueryBuilder.doc(WALLETS_COLLECTION, userId).get();
  
  if (!walletDoc.exists) {
    return { success: false, message: 'Wallet not found' };
  }

  const walletData = walletDoc.data();
  const currentPoints = walletData?.rewardPoints || 0;

  if (currentPoints < pointsCost) {
    return { 
      success: false, 
      message: `Insufficient reward points. You have ${currentPoints}, but need ${pointsCost}.` 
    };
  }

  // Get reward details using QueryBuilder
  const rewardDoc = await FirebaseQueryBuilder.doc(COLLECTIONS.REWARDS, rewardId).get();
  
  if (!rewardDoc.exists) {
    return { success: false, message: 'Reward not found' };
  }

  const rewardData = rewardDoc.data();
  if (!rewardData?.available) {
    return { success: false, message: 'Reward is no longer available' };
  }

  const batch = FirebaseQueryBuilder.createBatch();
  const now = new Date();

  // Update wallet to deduct points
  const walletRef = FirebaseQueryBuilder.doc(WALLETS_COLLECTION, userId);
  batch.update(walletRef, {
    rewardPoints: currentPoints - pointsCost,
    updatedAt: now
  });

  // Create redemption transaction
  const transactionRef = FirebaseQueryBuilder.collection(COLLECTIONS.TRANSACTIONS).doc();
  batch.set(transactionRef, {
    userId,
    type: 'redemption',
    amount: pointsCost,
    description: `Redeemed: ${rewardData.name}`,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: {
      rewardId,
      rewardType: rewardData.type,
      automated: false
    }
  });

  try {
    await batch.commit();
    return { 
      success: true, 
      message: `Successfully redeemed ${rewardData.name}!` 
    };
  } catch (error) {
    console.error('Error redeeming reward:', error);
    return { 
      success: false, 
      message: 'Failed to redeem reward. Please try again.' 
    };
  }
}