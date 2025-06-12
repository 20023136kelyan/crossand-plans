import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
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

    // Get current date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get reports by status
    const [pendingSnapshot, flaggedSnapshot, rejectedSnapshot] = await Promise.all([
      db.collection('reports').where('status', '==', 'pending').get(),
      db.collection('reports').where('status', '==', 'flagged').get(),
      db.collection('reports').where('status', '==', 'rejected').get()
    ]);

    const pendingCount = pendingSnapshot.size;
    const flaggedCount = flaggedSnapshot.size;
    const rejectedCount = rejectedSnapshot.size;

    // Get reports from today
    const todayReportsSnapshot = await db
      .collection('reports')
      .where('createdAt', '>=', todayStart.toISOString())
      .get();
    const reportsToday = todayReportsSnapshot.size;

    // Get resolved reports from the last week for response time calculation
    const resolvedReportsSnapshot = await db
      .collection('reports')
      .where('status', 'in', ['approved', 'rejected'])
      .where('updatedAt', '>=', weekAgo.toISOString())
      .get();

    // Calculate average response time
    let totalResponseTime = 0;
    let resolvedCount = 0;

    resolvedReportsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.updatedAt) {
        const created = new Date(data.createdAt);
        const updated = new Date(data.updatedAt);
        const responseTime = updated.getTime() - created.getTime();
        totalResponseTime += responseTime;
        resolvedCount++;
      }
    });

    let averageResponseTime = '0 hours';
    if (resolvedCount > 0) {
      const avgMs = totalResponseTime / resolvedCount;
      const avgHours = Math.round(avgMs / (1000 * 60 * 60) * 10) / 10;
      if (avgHours < 1) {
        const avgMinutes = Math.round(avgMs / (1000 * 60));
        averageResponseTime = `${avgMinutes} min`;
      } else {
        averageResponseTime = `${avgHours} hours`;
      }
    }

    // Calculate resolution rate
    const totalReports = pendingCount + flaggedCount + rejectedCount + resolvedCount;
    const resolutionRate = totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0;

    const stats = {
      averageResponseTime: resolvedCount > 0 ? averageResponseTime : '0 hours',
      reportsToday: reportsToday,
      resolutionRate: resolutionRate,
      pendingCount: pendingCount,
      flaggedCount: flaggedCount,
      rejectedCount: rejectedCount
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}