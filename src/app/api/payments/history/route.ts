import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { getActiveSubscription } from '@/services/subscriptionService.admin';

export async function GET(request: Request) {
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

    // Get payment history from Firestore
    const paymentsQuery = await db
      .collection('payments')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const paymentHistory = paymentsQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        amount: data.amount || 0,
        currency: data.currency || 'usd',
        status: data.status || 'pending',
        plan: data.plan || 'unknown',
        invoiceUrl: data.invoiceUrl || null
      };
    });

    // If no payment history exists but user has a subscription with Stripe, fetch from Stripe
    if (paymentHistory.length === 0 && subscription?.customerId) {
      try {
        // Import Stripe only when needed
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Fetch payment intents for this customer
        const paymentIntents = await stripe.paymentIntents.list({
          customer: subscription.customerId,
          limit: 10
        });

        // Convert Stripe payment intents to our format
        const stripePayments = paymentIntents.data.map((intent: any) => ({
          id: intent.id,
          date: new Date(intent.created * 1000).toISOString(),
          amount: intent.amount / 100, // Convert from cents
          currency: intent.currency.toUpperCase(),
          status: intent.status === 'succeeded' ? 'paid' as const : 'pending' as const,
          plan: subscription.plan,
          invoiceUrl: intent.charges?.data?.[0]?.receipt_url || null
        }));

        paymentHistory.push(...stripePayments);
      } catch (error) {
        console.error('Error fetching Stripe payment history:', error);
        // If Stripe fetch fails, create a basic entry based on subscription
        if (subscription) {
          const basicPayment = {
            id: `sub_${subscription.id}`,
            date: subscription.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            amount: subscription.amount,
            currency: subscription.currency,
            status: 'paid' as const,
            plan: subscription.plan,
            invoiceUrl: null
          };
          paymentHistory.push(basicPayment);
        }
      }
    }

    return NextResponse.json({
      subscription,
      paymentHistory
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}