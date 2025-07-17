import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { approveFollowRequestAdmin } from '@/services/userService.server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { markNotificationAsRead } from '@/services/notificationService.server';

export async function POST(request: NextRequest) {
  try {
    const { requesterId } = await request.json();
    
    if (!requesterId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameter: requesterId' 
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

    if (currentUserId === requesterId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot approve your own follow request' 
      }, { status: 400 });
    }

    // Approve the follow request
    await approveFollowRequestAdmin(currentUserId, requesterId);

    // Mark the related follow_request notification as handled and status 'approved'
    if (firestoreAdmin) {
      const notificationsRef = firestoreAdmin
        .collection('users')
        .doc(currentUserId)
        .collection('notifications');
      const notifQuery = await notificationsRef
        .where('type', 'in', ['friend_request', 'follow_request'])
        .where('fromUserId', '==', requesterId)
        .where('handled', '==', false)
        .limit(1)
        .get();
      if (!notifQuery.empty) {
        const notifDoc = notifQuery.docs[0];
        await notifDoc.ref.update({ handled: true, status: 'approved' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Follow request approved successfully' 
    });

  } catch (error) {
    console.error('Approve follow request error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 