import { messagingAdmin } from '@/lib/firebaseAdmin';
import { firestoreAdmin } from '@/lib/firebaseAdmin';

export async function sendFCMToTokens(tokens: string[], payload: any) {
  if (!messagingAdmin) throw new Error('Firebase Admin Messaging not initialized');
  if (!tokens.length) return;
  try {
    await messagingAdmin.sendEachForMulticast({
      tokens,
      ...payload,
    });
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error);
  }
}

export async function sendFCMToUser(userId: string, payload: any, getTokens: (userId: string) => Promise<string[]>) {
  const tokens = await getTokens(userId);
  if (tokens && tokens.length > 0) {
    await sendFCMToTokens(tokens, payload);
  }
}

export async function getFcmTokensForUser(userId: string): Promise<string[]> {
  if (!firestoreAdmin) return [];
  const tokensSnap = await firestoreAdmin
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .get();
  return tokensSnap.docs.map(doc => doc.id);
} 