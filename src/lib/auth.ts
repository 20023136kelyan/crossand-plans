import { auth as firebaseAuth } from './firebase';
import { cookies } from 'next/headers';
import { authAdmin } from './firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { calculateUserPremiumStatus, calculateUserActivityScore } from '@/services/userService.admin';

export const auth = async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token || !authAdmin) {
      return null;
    }

    const auth = authAdmin as Auth;
    const decodedToken = await auth.verifyIdToken(token);
    const user = await auth.getUser(decodedToken.uid);

    // Get user's premium status and activity score
    const [isPremium, activityScore] = await Promise.all([
      calculateUserPremiumStatus(user.uid),
      calculateUserActivityScore(user.uid)
    ]);

    return {
      user: {
        id: user.uid,
        email: user.email,
        name: user.displayName,
        isPremium,
        activityScore,
      }
    };
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}; 