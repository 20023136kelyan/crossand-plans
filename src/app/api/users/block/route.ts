// src/app/api/users/block/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

// POST /api/users/block - Block a user
export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent self-blocking
    if (userId === authResult.userId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Check if the user exists
    const userRef = db!.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already blocked
    const currentUserRef = db!.collection('users').doc(authResult.userId);
    const currentUserDoc = await currentUserRef.get();
    const currentUserData = currentUserDoc.data();
    const blockedUsers = currentUserData?.blockedUsers || [];

    if (blockedUsers.includes(userId)) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    // Use a batch to update both users
    const batch = db!.batch();
    
    // Add to current user's blocked list
    batch.update(currentUserRef, {
      blockedUsers: FieldValue.arrayUnion(userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Remove from following/followers arrays in user profiles
    const currentUserProfileRef = db!.collection('users').doc(authResult.userId);
    const targetUserProfileRef = db!.collection('users').doc(userId);
    
    batch.update(currentUserProfileRef, {
      following: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    batch.update(targetUserProfileRef, {
      followers: FieldValue.arrayRemove(authResult.userId),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    await batch.commit();

    return NextResponse.json({ 
      message: 'User blocked successfully'
    });
  },
  { defaultError: 'Failed to block user' }
);

// DELETE /api/users/block - Unblock a user
export const DELETE = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Remove from current user's blocked list
    const currentUserRef = db!.collection('users').doc(authResult.userId);
    await currentUserRef.update({
      blockedUsers: FieldValue.arrayRemove(userId),
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      message: 'User unblocked successfully'
    });
  },
  { defaultError: 'Failed to unblock user' }
);