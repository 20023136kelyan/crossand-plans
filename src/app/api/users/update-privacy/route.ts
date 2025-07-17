import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';
import { firestoreAdmin as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { isPrivate }: { isPrivate: boolean } = body;

    if (typeof isPrivate !== 'boolean') {
      return NextResponse.json({ 
        error: 'Missing or invalid isPrivate parameter' 
      }, { status: 400 });
    }

    // Update the users isPrivate field
    await adminDb.collection('users').doc(authResult.userId).update({
      isPrivate,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      success: true,
      message: isPrivate ? 'Account set to private' : 'Account set to public' 
    });
  },
  { defaultError: 'Failed to update privacy setting' }
); 