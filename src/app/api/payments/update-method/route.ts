import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    try {
      // Get the request body
      const body = await request.json();
      const { returnUrl } = body;

      // Validate return URL (optional)
      const validReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/users/settings`;

      // Get or create Stripe customer
      let customerId: string;
      
      // First, try to find existing customer by Firebase UID
      const existingCustomers = await stripe.customers.list({
        metadata: { firebase_uid: userId },
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer if not found
        const customer = await stripe.customers.create({
          metadata: {
            firebase_uid: userId
          }
        });
        customerId = customer.id;
      }

      // Create a setup intent for updating payment method
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: {
          firebase_uid: userId,
          purpose: 'payment_method_update'
        }
      });

      // Create a Stripe Checkout session for payment method update
      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer: customerId,
        setup_intent_data: {
          metadata: {
            firebase_uid: userId,
            purpose: 'payment_method_update'
          }
        },
        success_url: `${validReturnUrl}?payment_update=success`,
        cancel_url: `${validReturnUrl}?payment_update=cancelled`,
        payment_method_types: ['card']
      });

      if (!session.url) {
        throw new Error('Failed to create checkout session URL');
      }

      return NextResponse.json({
        success: true,
        url: session.url,
        sessionId: session.id
      });

    } catch (stripeError: any) {
      console.error('Stripe error:', stripeError);
      return NextResponse.json(
        { 
          error: 'Payment service error', 
          details: stripeError.message 
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Payment update API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate payment method update',
        details: error.message 
      },
      { status: 500 }
    );
  }
}