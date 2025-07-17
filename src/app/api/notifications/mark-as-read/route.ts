import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    if (!firestoreAdmin || !authAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      // Mark all notifications as read
      const notificationsRef = firestoreAdmin.collection('users').doc(userId).collection('notifications');
      const unreadNotifications = await notificationsRef.where('isRead', '==', false).get();
      
      const batch = firestoreAdmin.batch();
      unreadNotifications.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true, readAt: FieldValue.serverTimestamp() });
      });
      
      await batch.commit();
      
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    } else if (notificationId) {
      // Mark specific notification as read
      const notificationRef = firestoreAdmin.collection('users').doc(userId).collection('notifications').doc(notificationId);
      const notificationDoc = await notificationRef.get();
      
      if (!notificationDoc.exists) {
        return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
      }
      
      await notificationRef.update({ 
        isRead: true, 
        readAt: FieldValue.serverTimestamp() 
      });
      
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    } else {
      return NextResponse.json({ success: false, error: 'Missing notificationId or markAll parameter' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[mark-as-read] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
} 