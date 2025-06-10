import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createSubscription } from '@/services/subscriptionService.admin';
import type { SubscriptionPlan } from '@/types/subscription';
import Stripe from 'stripe';

// Stripe integration for subscription management
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

    // Get request body
    const { plan, paymentMethodId, priceId } = await request.json();

    if (!plan || !['basic', 'premium', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
    }

    // Check if user already has an active subscription
    const existingSubscription = await db
      .collection('subscriptions')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existingSubscription.empty) {
      return NextResponse.json({ error: 'User already has an active subscription' }, { status: 400 });
    }

    // Define pricing (in cents)
    const pricing = {
      basic: { amount: 0, currency: 'usd' }, // Free plan
      premium: { amount: 999, currency: 'usd' }, // $9.99/month
      enterprise: { amount: 2999, currency: 'usd' } // $29.99/month
    };

    const planPricing = pricing[plan as SubscriptionPlan];

    // For basic plan, create subscription directly
    if (plan === 'basic') {
      const subscriptionId = await createSubscription(
        userId,
        plan as SubscriptionPlan,
        priceId || 'price_basic',
        planPricing.amount,
        planPricing.currency,
        { type: 'card' }
      );

      return NextResponse.json({
        success: true,
        subscriptionId,
        message: 'Basic subscription activated'
      });
    }

    // For paid plans, integrate with Stripe
    let customerId: string;
    let stripeSubscription: Stripe.Subscription;
    
    // Get or create Stripe customer
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData?.stripeCustomerId) {
      customerId = userData.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          firebaseUID: userId
        },
        email: userData?.email
      });
      customerId = customer.id;
      
      // Save customer ID to user document
      await db.collection('users').doc(userId).update({
        stripeCustomerId: customerId,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Create Stripe subscription
    stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId || `price_${plan}`,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    
    // Get payment method details if available
    let paymentMethodDetails = { type: 'card' as const };
    if (paymentMethodId) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (paymentMethod.card) {
          paymentMethodDetails = {
            type: 'card' as const,
            lastFour: paymentMethod.card.last4,
            brand: paymentMethod.card.brand
          };
        }
      } catch (error) {
        console.warn('Could not retrieve payment method details:', error);
      }
    }
    
    // Create subscription in our database
    const subscriptionId = await createSubscription(
      userId,
      plan as SubscriptionPlan,
      priceId || `price_${plan}`,
      planPricing.amount,
      planPricing.currency,
      paymentMethodDetails,
      customerId,
      stripeSubscription.id
    );

    // Update user's subscription status in their profile
    await db.collection('users').doc(userId).update({
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      updatedAt: new Date().toISOString()
    });

    // Return subscription details with payment intent if needed
    const response: any = {
      success: true,
      subscriptionId,
      message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription created`,
      stripeSubscriptionId: stripeSubscription.id
    };
    
    // If payment requires confirmation, include client secret
    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    if (latestInvoice?.payment_intent) {
      const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;
      if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
        response.clientSecret = paymentIntent.client_secret;
        response.requiresPayment = true;
      }
    }
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}