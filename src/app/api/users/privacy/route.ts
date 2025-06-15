import { NextRequest, NextResponse } from 'next/server';
import { authAdmin as adminAuth, firestoreAdmin as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface PrivacySettings {
  plansVisibility: 'public' | 'friends' | 'followers' | 'private';
  followersVisibility: 'public' | 'friends' | 'followers' | 'private';
  followingVisibility: 'public' | 'friends' | 'followers' | 'private';
}

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!adminAuth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
    }
    
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    // Get user's privacy settings
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
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
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!adminAuth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
    }
    
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Parse the request body
    const body = await request.json();
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

    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    // Update user's privacy settings
    await adminDb.collection('users').doc(userId).update({
      privacySettings,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      message: 'Privacy settings updated successfully',
      privacySettings 
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}