// src/app/api/reports/user/route.ts
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
    const reportingUserId = decodedToken.uid;

    const { userId, reason, description } = await request.json();

    if (!userId || !reason) {
      return NextResponse.json({ error: 'User ID and reason are required' }, { status: 400 });
    }

    // Prevent self-reporting
    if (userId === reportingUserId) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 });
    }

    // Check if the user exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    // Check if user has already reported this user
    const existingReportQuery = await db.collection('reports')
      .where('contentType', '==', 'user')
      .where('contentId', '==', userId)
      .where('reportingUserId', '==', reportingUserId)
      .limit(1)
      .get();

    if (!existingReportQuery.empty) {
      return NextResponse.json({ error: 'You have already reported this user' }, { status: 400 });
    }

    // Create the report
    const reportData = {
      contentType: 'user',
      contentId: userId,
      reportedUserId: userId,
      reportingUserId,
      reason,
      description: description || '',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: {
        reportedUsername: userData?.username || '',
        reportedDisplayName: userData?.displayName || ''
      }
    };

    // Use a batch to create the report and update user report count
    const batch = db.batch();
    
    // Add the report
    const reportRef = db.collection('reports').doc();
    batch.set(reportRef, reportData);
    
    // Update user report count
    batch.update(userRef, {
      reportCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    await batch.commit();

    return NextResponse.json({ 
      message: 'User reported successfully',
      reportId: reportRef.id 
    });

  } catch (error) {
    console.error('Error reporting user:', error);
    return NextResponse.json(
      { error: 'Failed to report user' },
      { status: 500 }
    );
  }
}