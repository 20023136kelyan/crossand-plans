import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { paymentMethodId, isDefault } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    // Update user's payment method
    const userRef = db!.collection('users').doc(authResult.userId);
    const updateData: any = {
      paymentMethods: {
        [paymentMethodId]: {
          id: paymentMethodId,
          isDefault: isDefault || false,
          updatedAt: new Date()
        }
      },
      updatedAt: new Date()
    };

    if (isDefault) {
      updateData.defaultPaymentMethod = paymentMethodId;
    }

    await userRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully'
    });
  },
  { defaultError: 'Failed to update payment method' }
);