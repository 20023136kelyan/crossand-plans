import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!db) {
      console.error('Firestore Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get analytics overview data
    const [usersSnapshot, plansSnapshot, messagesSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('plans').get(),
      db.collection('messages').get()
    ]);

    // Get recent activity
    const [recentUsersSnapshot, recentPlansSnapshot, recentMessagesSnapshot] = await Promise.all([
      db.collection('users').where('createdAt', '>=', oneDayAgo.toISOString()).get(),
      db.collection('plans').where('createdAt', '>=', oneDayAgo.toISOString()).get(),
      db.collection('messages').where('createdAt', '>=', oneDayAgo.toISOString()).get()
    ]);

    // Calculate growth rates (simplified)
    const totalUsers = usersSnapshot.size;
    const totalPlans = plansSnapshot.size;
    const totalMessages = messagesSnapshot.size;
    
    const newUsersToday = recentUsersSnapshot.size;
    const newPlansToday = recentPlansSnapshot.size;
    const newMessagesToday = recentMessagesSnapshot.size;

    // Calculate engagement metrics
    const activeUsersToday = newUsersToday + Math.floor(totalUsers * 0.1); // Estimate active users
    const avgPlansPerUser = totalUsers > 0 ? (totalPlans / totalUsers).toFixed(2) : '0';
    const avgMessagesPerPlan = totalPlans > 0 ? (totalMessages / totalPlans).toFixed(2) : '0';

    const overview = {
      totalUsers,
      totalPlans,
      totalMessages,
      newUsersToday,
      newPlansToday,
      newMessagesToday,
      activeUsersToday,
      metrics: {
        avgPlansPerUser: parseFloat(avgPlansPerUser),
        avgMessagesPerPlan: parseFloat(avgMessagesPerPlan),
        userGrowthRate: totalUsers > 0 ? ((newUsersToday / totalUsers) * 100).toFixed(2) : '0',
        planGrowthRate: totalPlans > 0 ? ((newPlansToday / totalPlans) * 100).toFixed(2) : '0'
      },
      lastUpdated: now.toISOString()
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest) {
  try {
    // Verify admin authentication for HEAD requests
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return new NextResponse(null, { status: 401 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Error in HEAD request:', error);
    return new NextResponse(null, { status: 500 });
  }
}