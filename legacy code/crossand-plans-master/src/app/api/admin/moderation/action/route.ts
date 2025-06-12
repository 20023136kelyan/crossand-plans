import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  if (!auth || !db) {
    console.error('Firebase Admin services not initialized');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Verify authentication and admin status
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { reportId, action } = await request.json();

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Report ID and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approve or reject' }, { status: 400 });
    }

    // Validate reportId format
    if (!reportId || reportId.trim() === '') {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    // Get the report
    const reportDoc = await db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const reportData = reportDoc.data();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Start a batch operation
    const batch = db.batch();

    // Update report status
    const reportRef = db.collection('reports').doc(reportId);
    batch.update(reportRef, {
      status: newStatus,
      moderatedBy: userId,
      moderatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Take action based on the report type and decision
    if (action === 'reject') {
      // If rejecting the report, take action on the reported content
      switch (reportData?.type) {
        case 'plan':
          // Hide or remove the plan
          if (reportData.contentId) {
            const planRef = db.collection('plans').doc(reportData.contentId);
            batch.update(planRef, {
              status: 'hidden',
              hiddenReason: 'Content violation',
              hiddenAt: new Date().toISOString(),
              hiddenBy: userId
            });
          }
          break;

        case 'comment':
          // Hide or remove the comment
          if (reportData.contentId) {
            const commentRef = db.collection('comments').doc(reportData.contentId);
            batch.update(commentRef, {
              status: 'hidden',
              hiddenReason: 'Content violation',
              hiddenAt: new Date().toISOString(),
              hiddenBy: userId
            });
          }
          break;

        case 'profile':
          // Suspend or flag the user profile
          if (reportData.reportedUserId) {
            const userRef = db.collection('users').doc(reportData.reportedUserId);
            batch.update(userRef, {
              accountStatus: 'suspended',
              suspendedReason: 'Profile content violation',
              suspendedAt: new Date().toISOString(),
              suspendedBy: userId
            });
          }
          break;

        case 'message':
          // Hide the message
          if (reportData.contentId) {
            const messageRef = db.collection('messages').doc(reportData.contentId);
            batch.update(messageRef, {
              status: 'hidden',
              hiddenReason: 'Content violation',
              hiddenAt: new Date().toISOString(),
              hiddenBy: userId
            });
          }
          break;
      }

      // Add a strike to the reported user
      if (reportData?.reportedUserId) {
        const userRef = db.collection('users').doc(reportData.reportedUserId);
        batch.update(userRef, {
          strikes: db.FieldValue.increment(1),
          lastStrikeAt: new Date().toISOString()
        });

        // Create a moderation log entry
        const logRef = db.collection('moderationLogs').doc();
        batch.set(logRef, {
          type: 'content_violation',
          reportId,
          reportedUserId: reportData.reportedUserId,
          contentType: reportData.type,
          contentId: reportData.contentId,
          action: 'strike_added',
          moderatorId: userId,
          reason: reportData.reason || 'Content violation',
          createdAt: new Date().toISOString()
        });
      }
    } else {
      // If approving the report (content is fine), create a log entry
      const logRef = db.collection('moderationLogs').doc();
      batch.set(logRef, {
        type: 'report_approved',
        reportId,
        reportedUserId: reportData?.reportedUserId,
        contentType: reportData?.type,
        contentId: reportData?.contentId,
        action: 'report_dismissed',
        moderatorId: userId,
        reason: 'Content deemed appropriate',
        createdAt: new Date().toISOString()
      });
    }

    // Commit the batch
    await batch.commit();

    const actionMessage = action === 'approve' 
      ? 'Report approved - content deemed appropriate'
      : 'Report rejected - appropriate action taken';

    return NextResponse.json({
      success: true,
      message: actionMessage
    });

  } catch (error) {
    console.error('Error performing moderation action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}