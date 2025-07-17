import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const { createNotificationForMultipleUsers } = require('../services/notificationService.server');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const PLANS_COLLECTION = 'plans';
const NOTIFIED_FIELD = 'upcomingNotifiedUserIds';

export const sendUpcomingPlanNotifications = functions.pubsub.schedule('every 10 minutes').onRun(async (context: any) => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // Query for plans starting in the next hour
  const plansSnapshot = await db.collection(PLANS_COLLECTION)
    .where('eventTime', '>=', now)
    .where('eventTime', '<=', oneHourLater)
    .get();

  for (const planDoc of plansSnapshot.docs) {
    const plan = planDoc.data();
    const planId = planDoc.id;
    const eventTime = plan.eventTime?.toDate?.() || plan.eventTime;
    if (!eventTime) continue;
    const hostId = plan.hostId;
    const participantIds = plan.invitedParticipantUserIds || [];
    const allUserIds = Array.from(new Set([hostId, ...participantIds].filter(Boolean)));
    const alreadyNotified = plan[NOTIFIED_FIELD] || [];
    const toNotify = allUserIds.filter((uid: string) => !alreadyNotified.includes(uid));
    if (toNotify.length === 0) continue;
    await createNotificationForMultipleUsers(toNotify, {
      type: 'plan_share',
      title: 'Plan starting soon',
      description: plan.name ? `The plan "${plan.name}" starts in under an hour.` : 'A plan you are part of starts soon.',
      actionUrl: `/plans/${planId}`,
      isRead: false,
      metadata: { planId },
    });
    // Mark users as notified
    await planDoc.ref.update({
      [NOTIFIED_FIELD]: admin.firestore.FieldValue.arrayUnion(...toNotify)
    });
  }
  return null;
});

export {}; 