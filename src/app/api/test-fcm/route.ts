import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { sendFCMToUser, getFcmTokensForUser } from '@/services/fcmService.server';

export async function POST(request: NextRequest) {
  try {
    if (!authAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Send a test push notification with enhanced styling
    await sendFCMToUser(userId, {
      notification: {
        title: 'Sarah liked your post',
        body: 'Sarah just liked your "Weekend in Paris" plan',
        icon: '/crossand-logo.svg',
      },
      data: {
        actionUrl: '/users/notifications',
        type: 'post_interaction',
        interactionType: 'like',
        notificationId: 'test-' + Date.now(),
        imageUrl: '/images/Homepage.jpg', // Optional: show plan image
        userName: 'Sarah',
        planTitle: 'Weekend in Paris',
        timestamp: new Date().toISOString(),
      }
    }, getFcmTokensForUser);

    return NextResponse.json({ 
      success: true, 
      message: 'Test push notification sent successfully' 
    });
  } catch (error: any) {
    console.error('[test-fcm] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
} 