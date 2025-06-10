import { firestoreAdmin } from '@/lib/firebaseAdmin';
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

/**
 * Get user's wallet data including balance, credits, reward points, and transaction history
 */
export async function getUserWalletData(userId: string): Promise<WalletData> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;

  // Get user's wallet data
  const walletDoc = await db.collection('wallets').doc(userId).get();
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
    
    await db.collection('wallets').doc(userId).set(newWalletData);
    walletData = newWalletData;

    // Create welcome transactions
    await createWelcomeTransactions(userId);
  }

  // Get transaction history
  const transactionsQuery = await db
    .collection('transactions')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const transactions = transactionsQuery.docs.map(doc => {
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

  // Get available rewards
  const rewardsQuery = await db
    .collection('rewards')
    .where('available', '==', true)
    .orderBy('cost', 'asc')
    .get();

  const rewards = rewardsQuery.docs.map(doc => ({
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

  const db = firestoreAdmin as Firestore;
  const batch = db.batch();
  const now = new Date();

  // Welcome bonus transaction
  const welcomeBonusRef = db.collection('transactions').doc();
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
  const rewardPointsRef = db.collection('transactions').doc();
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

  const db = firestoreAdmin as Firestore;
  const batch = db.batch();
  const now = new Date();

  // Create transaction record
  const transactionRef = db.collection('transactions').doc();
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

  // Update wallet balance
  const walletRef = db.collection('wallets').doc(userId);
  const walletDoc = await walletRef.get();
  
  if (walletDoc.exists) {
    const currentData = walletDoc.data();
    const updates: any = { updatedAt: now };

    switch (type) {
      case 'credit':
        updates.balance = (currentData?.balance || 0) + amount;
        break;
      case 'debit':
        updates.balance = (currentData?.balance || 0) - amount;
        break;
      case 'reward':
        updates.rewardPoints = (currentData?.rewardPoints || 0) + amount;
        break;
      case 'redemption':
        updates.rewardPoints = (currentData?.rewardPoints || 0) - amount;
        break;
    }

    batch.update(walletRef, updates);
  }

  await batch.commit();
  return transactionRef.id;
}

/**
 * Redeem reward points for credits or features
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
  pointsCost: number
): Promise<{ success: boolean; message: string }> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;

  // Get user's current wallet data
  const walletDoc = await db.collection('wallets').doc(userId).get();
  if (!walletDoc.exists) {
    return { success: false, message: 'Wallet not found' };
  }

  const walletData = walletDoc.data();
  const currentRewardPoints = walletData?.rewardPoints || 0;

  if (currentRewardPoints < pointsCost) {
    return { success: false, message: 'Insufficient reward points' };
  }

  // Get reward details
  const rewardDoc = await db.collection('rewards').doc(rewardId).get();
  if (!rewardDoc.exists) {
    return { success: false, message: 'Reward not found' };
  }

  const reward = rewardDoc.data();
  if (!reward?.available) {
    return { success: false, message: 'Reward not available' };
  }

  // Process redemption
  const batch = db.batch();
  const now = new Date();

  // Deduct reward points
  const walletRef = db.collection('wallets').doc(userId);
  batch.update(walletRef, {
    rewardPoints: currentRewardPoints - pointsCost,
    updatedAt: now
  });

  // Add redemption transaction
  const transactionRef = db.collection('transactions').doc();
  batch.set(transactionRef, {
    userId,
    type: 'redemption',
    amount: pointsCost,
    description: `Redeemed: ${reward.name}`,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    metadata: {
      rewardId,
      rewardType: reward.type,
      rewardName: reward.name
    }
  });

  // Apply reward benefits based on type
  if (reward.type === 'credits') {
    const creditsToAdd = reward.metadata?.creditsAmount || 100;
    batch.update(walletRef, {
      credits: (walletData?.credits || 0) + creditsToAdd
    });

    // Add credit transaction
    const creditTransactionRef = db.collection('transactions').doc();
    batch.set(creditTransactionRef, {
      userId,
      type: 'credit',
      amount: creditsToAdd,
      description: `Credits from reward: ${reward.name}`,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'reward_redemption',
        rewardId
      }
    });
  }

  await batch.commit();
  return { success: true, message: 'Reward redeemed successfully' };
}