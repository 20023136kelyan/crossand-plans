import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const { targetUserId } = await request.json();
    
    if (!targetUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameter: targetUserId' 
      }, { status: 400 });
    }

    // Get the current user from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    if (!authAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error: Auth service not available' 
      }, { status: 500 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    if (currentUserId === targetUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot cancel follow request to yourself' 
      }, { status: 400 });
    }

    if (!firestoreAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error: Database not available' 
      }, { status: 500 });
    }

    // Check if the current user has a pending follow request to the target user
    const currentUserRef = firestoreAdmin.collection('users').doc(currentUserId);
    const targetUserRef = firestoreAdmin.collection('users').doc(targetUserId);
    
    const [currentUserDoc, targetUserDoc] = await Promise.all([
      currentUserRef.get(),
      targetUserRef.get()
    ]);

    if (!currentUserDoc.exists || !targetUserDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'One or both users not found' 
      }, { status: 404 });
    }

    const currentUserData = currentUserDoc.data();
    const targetUserData = targetUserDoc.data();

    // Check if current user has a pending request to target user
    const sentFollowRequests = currentUserData?.sentFollowRequests || [];
    const pendingFollowRequests = targetUserData?.pendingFollowRequests || [];
    if (!sentFollowRequests.includes(targetUserId) || !pendingFollowRequests.includes(currentUserId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'No pending follow request found' 
      }, { status: 400 });
    }

    // Remove the follow request from both users
    const batch = firestoreAdmin.batch();
    const now = FieldValue.serverTimestamp();

    batch.update(currentUserRef, {
      sentFollowRequests: FieldValue.arrayRemove(targetUserId),
      updatedAt: now
    });

    batch.update(targetUserRef, {
      pendingFollowRequests: FieldValue.arrayRemove(currentUserId),
      updatedAt: now
    });

    // Also remove the notification for the target user
    const notificationsRef = firestoreAdmin.collection('users').doc(targetUserId).collection('notifications');
    const notificationQuery = await notificationsRef
      .where('type', '==', 'follow_request')
      .where('fromUserId', '==', currentUserId)
      .where('isRead', '==', false)
      .get();

    notificationQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: 'Follow request cancelled successfully' 
    });

  } catch (error) {
    console.error('Cancel follow request error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 