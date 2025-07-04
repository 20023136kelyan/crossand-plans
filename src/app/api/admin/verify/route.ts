import { createAuthenticatedHandler } from '@/lib/api/middleware';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';

export const GET = createAuthenticatedHandler(
  async ({ authResult }) => {
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    // Check admin status
    const userDoc = await db.collection('users').doc(authResult.userId).get();
    const userData = userDoc.data();

    return NextResponse.json({
      isAdmin: !!userData?.isAdmin
    });
  },
  { defaultError: 'Failed to verify admin status' }
); 