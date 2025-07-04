// src/app/api/reports/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { userId, reason, description } = body;

    if (!userId || !reason) {
      return NextResponse.json({ error: 'User ID and reason are required' }, { status: 400 });
    }

    // Prevent self-reporting
    if (userId === authResult.userId) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 });
    }

    // Check if the user exists
    const userRef = db!.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    // Check if user has already reported this user
    const existingReportQuery = await db!.collection('reports')
      .where('contentType', '==', 'user')
      .where('contentId', '==', userId)
      .where('reportingUserId', '==', authResult.userId)
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
      reportingUserId: authResult.userId,
      reason,
      description: description || '',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: {
        reportedUserName: userData?.firstName || 'Unknown User',
        reportedUserEmail: userData?.email || ''
      }
    };

    // Use a batch to create the report and update user report count
    const batch = db!.batch();
    
    // Add the report
    const reportRef = db!.collection('reports').doc();
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
  },
  { defaultError: 'Failed to report user' }
);