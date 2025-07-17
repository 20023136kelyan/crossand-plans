import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const NOTIFICATIONS_COLLECTION = 'notifications';
const USERS_COLLECTION = 'users';
const DAYS_OLD = 30;

export const cleanupOldNotifications = functions.pubsub.schedule('every 24 hours').onRun(async (context: any) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_OLD);

  const usersSnapshot = await db.collection(USERS_COLLECTION).get();
  let totalDeleted = 0;

  for (const userDoc of usersSnapshot.docs) {
    const notificationsRef = db.collection(USERS_COLLECTION).doc(userDoc.id).collection(NOTIFICATIONS_COLLECTION);
    const oldHandled = await notificationsRef
      .where('handled', '==', true)
      .where('createdAt', '<', cutoff)
      .get();
    const oldRead = await notificationsRef
      .where('isRead', '==', true)
      .where('createdAt', '<', cutoff)
      .get();
    const batch = db.batch();
    oldHandled.docs.forEach((doc: any) => batch.delete(doc.ref));
    oldRead.docs.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += oldHandled.size + oldRead.size;
  }
  console.log(`Deleted ${totalDeleted} old notifications.`);
  return null;
});

export {}; 