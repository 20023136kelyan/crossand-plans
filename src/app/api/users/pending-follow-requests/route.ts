import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { firestoreAdmin } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    if (!firestoreAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error: Database not available' }, { status: 500 });
    }
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization header' }, { status: 401 });
    }
    const idToken = authHeader.substring(7);
    if (!authAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error: Auth service not available' }, { status: 500 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;
    // Query notifications subcollection for follow_request notifications
    const notificationsRef = firestoreAdmin!.collection('users').doc(currentUserId).collection('notifications');
    const snapshot = await notificationsRef.where('type', '==', 'follow_request').where('isRead', '==', false).orderBy('createdAt', 'desc').get();
    
    type PendingRequest = { id: string; fromUserId?: string; createdAt?: any; type: string; isRead: boolean };
    const pendingFollowRequests = (snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as PendingRequest)
      .filter(request => !!request.fromUserId)) as PendingRequest[];

    // Fetch user profiles for each pending request
    const enrichedRequests = await Promise.all(
      pendingFollowRequests.map(async (request) => {
        if (!request.fromUserId) {
          // Should not happen due to filter, but guard for type safety
          return {
            ...request,
            requesterName: 'Unknown User',
            requesterAvatarUrl: null,
            requesterUsername: null
          };
        }
        try {
          const userProfileRef = firestoreAdmin!.collection('users').doc(request.fromUserId);
          const userProfileDoc = await userProfileRef.get();
          
          if (userProfileDoc.exists) {
            const userData = userProfileDoc.data();
            return {
              ...request,
              requesterName: userData?.username || userData?.firstName || userData?.name || 'Unknown User',
              requesterAvatarUrl: userData?.avatarUrl || null,
              requesterUsername: userData?.username || null
            };
          } else {
            return {
              ...request,
              requesterName: 'Unknown User',
              requesterAvatarUrl: null,
              requesterUsername: null
            };
          }
        } catch (error) {
          console.error(`Error fetching user profile for ${request.fromUserId}:`, error);
          return {
            ...request,
            requesterName: 'Unknown User',
            requesterAvatarUrl: null,
            requesterUsername: null
          };
        }
      })
    );

    return NextResponse.json({ pendingFollowRequests: enrichedRequests });
  } catch (error) {
    console.error('Error fetching pending follow requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pending follow requests' }, { status: 500 });
  }
} 