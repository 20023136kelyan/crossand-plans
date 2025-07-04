// src/app/api/reports/post/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { postId, reason, description } = body;

    if (!postId || !reason) {
      return NextResponse.json({ error: 'Post ID and reason are required' }, { status: 400 });
    }

    // Check if the post exists
    const postRef = db!.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const postData = postDoc.data();
    
    // Check if user has already reported this post
    const existingReportQuery = await db!.collection('reports')
      .where('contentType', '==', 'post')
      .where('contentId', '==', postId)
      .where('reportingUserId', '==', authResult.userId)
      .limit(1)
      .get();

    if (!existingReportQuery.empty) {
      return NextResponse.json({ error: 'You have already reported this post' }, { status: 400 });
    }

    // Create the report
    const reportData = {
      contentType: 'post',
      contentId: postId,
      reportedUserId: postData?.userId || null,
      reportingUserId: authResult.userId,
      reason,
      description: description || '',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: {
        postTitle: postData?.caption || '',
        postType: postData?.type || 'unknown'
      }
    };

    // Use a batch to create the report and update post report count
    const batch = db!.batch();
    
    // Add the report
    const reportRef = db!.collection('reports').doc();
    batch.set(reportRef, reportData);
    
    // Update post report count
    batch.update(postRef, {
      reportCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    await batch.commit();

    return NextResponse.json({ 
      message: 'Post reported successfully',
      reportId: reportRef.id 
    });
  },
  { defaultError: 'Failed to report post' }
);