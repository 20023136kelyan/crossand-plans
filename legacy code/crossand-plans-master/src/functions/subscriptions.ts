import * as functions from 'firebase-functions';
import { checkSubscriptionExpiry } from '../services/subscriptionService.admin';

// Run every day at midnight
export const checkExpiredSubscriptions = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async (_context: functions.EventContext) => {
    try {
      await checkSubscriptionExpiry();
      console.log('Successfully checked and updated expired subscriptions');
      return null;
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
      throw error;
    }
  }); 