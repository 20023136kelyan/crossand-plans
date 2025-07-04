import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { returnUrl } = body;

    // Get user's subscription info
    const userRef = db!.collection('users').doc(authResult.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const subscriptionId = userData?.subscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // In a real implementation, you would create a Stripe customer portal session
    // For now, return a mock portal URL
    const portalUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription`;

    return NextResponse.json({
      success: true,
      url: portalUrl,
      message: 'Portal access created'
    });
  },
  { defaultError: 'Failed to create portal session' }
);