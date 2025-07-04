import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';
import { firestoreAdmin as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

interface PrivacySettings {
  plansVisibility: 'public' | 'friends' | 'followers' | 'private';
  followersVisibility: 'public' | 'friends' | 'followers' | 'private';
  followingVisibility: 'public' | 'friends' | 'followers' | 'private';
}

export const GET = createAuthenticatedHandler(
  async ({ authResult }) => {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const userDoc = await adminDb.collection('users').doc(authResult.userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const privacySettings = userData?.privacySettings || {
      plansVisibility: 'public',
      followersVisibility: 'public',
      followingVisibility: 'public'
    };

    return NextResponse.json({ privacySettings });
  },
  { defaultError: 'Failed to fetch privacy settings' }
);

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { privacySettings }: { privacySettings: PrivacySettings } = body;

    // Validate privacy settings
    const validVisibilityOptions = ['public', 'friends', 'followers', 'private'];
    
    if (!privacySettings.plansVisibility || !validVisibilityOptions.includes(privacySettings.plansVisibility)) {
      return NextResponse.json({ error: 'Invalid plans visibility setting' }, { status: 400 });
    }
    
    if (!privacySettings.followersVisibility || !validVisibilityOptions.includes(privacySettings.followersVisibility)) {
      return NextResponse.json({ error: 'Invalid followers visibility setting' }, { status: 400 });
    }
    
    if (!privacySettings.followingVisibility || !validVisibilityOptions.includes(privacySettings.followingVisibility)) {
      return NextResponse.json({ error: 'Invalid following visibility setting' }, { status: 400 });
    }

    // Update user's privacy settings
    await adminDb.collection('users').doc(authResult.userId).update({
      privacySettings,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      message: 'Privacy settings updated successfully',
      privacySettings 
    });
  },
  { defaultError: 'Failed to update privacy settings' }
);