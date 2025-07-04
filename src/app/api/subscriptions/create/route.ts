import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { planType, paymentMethodId } = body;

    if (!planType) {
      return NextResponse.json(
        { error: 'Plan type is required' },
        { status: 400 }
      );
    }

    // Create subscription in Firestore
    const subscriptionData = {
      userId: authResult.userId,
      planType: planType,
      status: 'active',
      paymentMethodId: paymentMethodId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };

    const subscriptionRef = await db!.collection('subscriptions').add(subscriptionData);

    // Update user document with subscription info
    await db!.collection('users').doc(authResult.userId).update({
      subscriptionId: subscriptionRef.id,
      subscriptionStatus: 'active',
      subscriptionPlan: planType,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscriptionRef.id,
      message: 'Subscription created successfully'
    });
  },
  { defaultError: 'Failed to create subscription' }
);