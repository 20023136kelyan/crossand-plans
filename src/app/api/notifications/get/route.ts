import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { firestoreAdmin } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
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

    const notificationsRef = firestoreAdmin.collection('users').doc(userId).collection('notifications');
    const snapshot = await notificationsRef.orderBy('createdAt', 'desc').get();
    
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ 
      success: true, 
      notifications 
    });
  } catch (error: any) {
    console.error('[get-notifications] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
} 