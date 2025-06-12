import { AppTimestamp } from './common';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise';

export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  createdAt: AppTimestamp;
  expiresAt: AppTimestamp;
  autoRenew: boolean;
  lastBillingDate: AppTimestamp;
  nextBillingDate: AppTimestamp | null;
  cancelledAt: AppTimestamp | null;
  features: {
    maxPlans: number;
    maxParticipants: number;
    premiumFeatures: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
  };
  paymentMethod: {
    type: 'card' | 'paypal';
    lastFour?: string;
    brand?: string;
  };
  priceId: string;
  amount: number;
  currency: string;
  customerId?: string;
  stripeSubscriptionId?: string;
}