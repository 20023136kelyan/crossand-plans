// src/app/api/users/block/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebaseAdmin';
import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent self-blocking
    if (userId === currentUserId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Check if the user exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already blocked
    const currentUserRef = db.collection('users').doc(currentUserId);
    const currentUserDoc = await currentUserRef.get();
    const currentUserData = currentUserDoc.data();
    const blockedUsers = currentUserData?.blockedUsers || [];

    if (blockedUsers.includes(userId)) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    // Use a batch to update both users
    const batch = db.batch();
    
    // Add to current user's blocked list
    batch.update(currentUserRef, {
      blockedUsers: FieldValue.arrayUnion(userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Remove from following/followers if they exist
    const followingRef = db.collection('following').doc(currentUserId);
    const followersRef = db.collection('followers').doc(userId);
    
    batch.update(followingRef, {
      users: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    batch.update(followersRef, {
      users: FieldValue.arrayRemove(currentUserId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Also remove the reverse relationship
    const reverseFollowingRef = db.collection('following').doc(userId);
    const reverseFollowersRef = db.collection('followers').doc(currentUserId);
    
    batch.update(reverseFollowingRef, {
      users: FieldValue.arrayRemove(currentUserId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    batch.update(reverseFollowersRef, {
      users: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    await batch.commit();

    return NextResponse.json({ 
      message: 'User blocked successfully'
    });

  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json(
      { error: 'Failed to block user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Remove from current user's blocked list
    const currentUserRef = db.collection('users').doc(currentUserId);
    await currentUserRef.update({
      blockedUsers: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      message: 'User unblocked successfully'
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json(
      { error: 'Failed to unblock user' },
      { status: 500 }
    );
  }
}