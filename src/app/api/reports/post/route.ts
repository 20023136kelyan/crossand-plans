// src/app/api/reports/post/route.ts
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

    const { postId, reason, description } = await request.json();

    if (!postId || !reason) {
      return NextResponse.json({ error: 'Post ID and reason are required' }, { status: 400 });
    }

    // Check if the post exists
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const postData = postDoc.data();
    
    // Check if user has already reported this post
    const existingReportQuery = await db.collection('reports')
      .where('contentType', '==', 'post')
      .where('contentId', '==', postId)
      .where('reportingUserId', '==', reportingUserId)
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
      reportingUserId,
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
    const batch = db.batch();
    
    // Add the report
    const reportRef = db.collection('reports').doc();
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

  } catch (error) {
    console.error('Error reporting post:', error);
    return NextResponse.json(
      { error: 'Failed to report post' },
      { status: 500 }
    );
  }
}