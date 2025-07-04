import { createAdminHandler, parseRequestBody } from '@/lib/api/middleware';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';

export const POST = createAdminHandler(
  async ({ request, authResult }) => {
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { planId, featured } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Update plan
    await db.collection('plans').doc(planId).update({
      featured: featured,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: authResult.userId
    });

    return NextResponse.json({
      success: true,
      message: featured ? 'Plan marked as featured' : 'Plan removed from featured'
    });
  },
  { defaultError: 'Failed to toggle featured status' }
); 