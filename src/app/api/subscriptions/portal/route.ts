import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { getActiveSubscription } from '@/services/subscriptionService.admin';
import Stripe from 'stripe';

// This endpoint creates a customer portal session for subscription management
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: Request) {
  if (!auth || !db) {
    console.error('Firebase Admin services not initialized');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user's active subscription
    const subscription = await getActiveSubscription(userId);
    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Create Stripe customer portal session
    if (!subscription.customerId) {
      return NextResponse.json({ error: 'No customer ID found for subscription' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscription`
    });
    
    return NextResponse.json({
      url: session.url,
      message: 'Portal session created successfully'
    });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}