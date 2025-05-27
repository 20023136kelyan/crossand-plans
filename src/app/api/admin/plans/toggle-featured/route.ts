import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  if (!auth || !db) {
    console.error('Firebase Admin services not initialized');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Verify admin status
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get request body
    const { planId, featured } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Update plan
    await db.collection('plans').doc(planId).update({
      featured: featured,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: decodedToken.uid
    });

    return NextResponse.json({
      success: true,
      message: featured ? 'Plan marked as featured' : 'Plan removed from featured'
    });
  } catch (error) {
    console.error('Error toggling featured status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 