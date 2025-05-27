import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  if (!auth || !db) {
    console.error('Firebase Admin services not initialized');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  try {
    // Verify admin authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Check if the user has admin custom claims
    if (!decodedToken.admin) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Get request body
    const { userId, role, isVerified } = await request.json();

    if (!userId || role === undefined) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Update custom claims in Firebase Auth
    const customClaims: { [key: string]: boolean } = {
      admin: role === 'admin',
      moderator: role === 'moderator',
      creator: role === 'creator',
      verified: isVerified
    };
    
    await auth.setCustomUserClaims(userId, customClaims);
    
    // Update user role in Firestore
    await db.collection('users').doc(userId).update({
      role,
      isVerified,
      updatedAt: new Date().toISOString(),
      updatedBy: decodedToken.uid
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 