import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

async function generateChartData(from: Date, to: Date, interval: string) {
  // Generate user growth data
  const userGrowthData = await generateUserGrowthData(from, to, interval);
  
  // Generate plan distribution data
  const planDistributionData = await generatePlanDistributionData();
  
  // Generate engagement data
  const engagementData = await generateEngagementData(from, to);
  
  // Generate revenue data
  const revenueData = await generateRevenueData();
  
  return {
    userGrowthData,
    planDistributionData,
    engagementData,
    revenueData
  };
}

async function generateUserGrowthData(from: Date, to: Date, interval: string) {
  const data = [];
  const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const step = interval === 'daily' ? 1 : interval === 'weekly' ? 7 : 30;
  
  for (let i = 0; i <= daysDiff; i += step) {
    const date = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const usersSnapshot = await db
      .collection('users')
      .where('createdAt', '<=', date.toISOString())
      .get();
    
    data.push({
      date: date.toISOString().split('T')[0],
      users: usersSnapshot.size
    });
  }
  
  return data;
}

async function generatePlanDistributionData() {
  const plansSnapshot = await db.collection('plans').get();
  const categories: { [key: string]: number } = {};
  
  plansSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const category = data.eventType || 'Uncategorized';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  // Sort categories by count (descending)
  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const totalPlans = plansSnapshot.size;
  
  // Dynamic threshold: show top categories that represent at least 5% each
  // or ensure we show at least top 3 categories if there are more than 3
  const minPercentage = 0.05; // 5%
  const maxMainCategories = 6; // Maximum individual categories to show
  
  let mainCategories: Array<[string, number]> = [];
  let otherCount = 0;
  
  if (sortedCategories.length <= maxMainCategories) {
    // If we have few categories, show them all
    mainCategories = sortedCategories;
  } else {
    // Find categories that meet the threshold or are in top positions
    for (let i = 0; i < sortedCategories.length; i++) {
      const [name, count] = sortedCategories[i];
      const percentage = count / totalPlans;
      
      if (i < 3 || (percentage >= minPercentage && mainCategories.length < maxMainCategories)) {
        // Always include top 3, or include if above threshold and under limit
        mainCategories.push([name, count]);
      } else {
        // Add to "Other" category
        otherCount += count;
      }
    }
  }
  
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff6b6b', '#4ecdc4', '#45b7d1'];
  let colorIndex = 0;
  
  const result = mainCategories.map(([name, value]) => ({
    name,
    value,
    color: colors[colorIndex++ % colors.length]
  }));
  
  // Only add "Other" if there are actually categories grouped into it
  if (otherCount > 0) {
    result.push({
      name: 'Other',
      value: otherCount,
      color: colors[colorIndex % colors.length]
    });
  }
  
  return result;
}

async function generateEngagementData(from: Date, to: Date) {
  // Get daily active users (users who created plans or messages in the period)
  const activeUsersSnapshot = await db
    .collection('plans')
    .where('createdAt', '>=', from.toISOString())
    .where('createdAt', '<=', to.toISOString())
    .get();
  
  const uniqueUsers = new Set();
  activeUsersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.userId) uniqueUsers.add(data.userId);
  });
  
  // Get plans created in period
  const plansCreated = activeUsersSnapshot.size;
  
  // Get messages/comments in period
  const messagesSnapshot = await db
    .collection('messages')
    .where('createdAt', '>=', from.toISOString())
    .where('createdAt', '<=', to.toISOString())
    .get();
  
  // Get likes (assuming they're stored in a likes collection or as part of plans)
  const likesSnapshot = await db
    .collection('likes')
    .where('createdAt', '>=', from.toISOString())
    .where('createdAt', '<=', to.toISOString())
    .get();
  
  return [
    { metric: 'Daily Active Users', value: uniqueUsers.size },
    { metric: 'Plans Created', value: plansCreated },
    { metric: 'Comments', value: messagesSnapshot.size },
    { metric: 'Likes', value: likesSnapshot.size },
    { metric: 'Shares', value: Math.floor(likesSnapshot.size * 0.1) } // Estimate shares as 10% of likes
  ];
}

async function generateRevenueData() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const data = [];
  
  for (let i = 0; i < 6; i++) {
    const month = new Date().getMonth() - 5 + i;
    const year = month < 0 ? currentYear - 1 : currentYear;
    const adjustedMonth = month < 0 ? month + 12 : month;
    
    const startOfMonth = new Date(year, adjustedMonth, 1);
    const endOfMonth = new Date(year, adjustedMonth + 1, 0);
    
    const subscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('createdAt', '>=', startOfMonth.toISOString())
      .where('createdAt', '<=', endOfMonth.toISOString())
      .get();
    
    let monthlyRevenue = 0;
    subscriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.price && typeof data.price === 'number') {
        monthlyRevenue += data.price;
      }
    });
    
    data.push({
      month: months[adjustedMonth],
      revenue: monthlyRevenue,
      subscriptions: subscriptionsSnapshot.size
    });
  }
  
  return data;
}

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

    // Get query parameters
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const interval = url.searchParams.get('interval') || 'daily';

    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    // Calculate previous period for comparison
    const periodLength = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - periodLength);
    const previousTo = new Date(from.getTime());

    // Get total users
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // Get users from previous period for comparison
    const previousUsersSnapshot = await db
      .collection('users')
      .where('createdAt', '<=', previousTo.toISOString())
      .get();
    const previousTotalUsers = previousUsersSnapshot.size;

    // Calculate user growth
    const userGrowth = previousTotalUsers > 0 
      ? ((totalUsers - previousTotalUsers) / previousTotalUsers * 100).toFixed(1)
      : '0';
    const userGrowthChange = `${userGrowth.startsWith('-') ? '' : '+'}${userGrowth}%`;

    // Get active plans
    const plansSnapshot = await db
      .collection('plans')
      .where('status', '==', 'published')
      .get();
    const activePlans = plansSnapshot.size;

    // Get plans from previous period
    const previousPlansSnapshot = await db
      .collection('plans')
      .where('status', '==', 'published')
      .where('createdAt', '<=', previousTo.toISOString())
      .get();
    const previousActivePlans = previousPlansSnapshot.size;

    // Calculate plans growth
    const plansGrowth = previousActivePlans > 0 
      ? ((activePlans - previousActivePlans) / previousActivePlans * 100).toFixed(1)
      : '0';
    const activePlansChange = `${plansGrowth.startsWith('-') ? '' : '+'}${plansGrowth}%`;

    // Get ratings for average calculation
    const ratingsSnapshot = await db.collection('ratings').get();
    let totalRating = 0;
    let ratingCount = 0;
    
    ratingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.rating && typeof data.rating === 'number') {
        totalRating += data.rating;
        ratingCount++;
      }
    });

    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 4.5;

    // Get previous period ratings
    const previousRatingsSnapshot = await db
      .collection('ratings')
      .where('createdAt', '<=', previousTo.toISOString())
      .get();
    
    let previousTotalRating = 0;
    let previousRatingCount = 0;
    
    previousRatingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.rating && typeof data.rating === 'number') {
        previousTotalRating += data.rating;
        previousRatingCount++;
      }
    });

    const previousAverageRating = previousRatingCount > 0 ? previousTotalRating / previousRatingCount : 4.2;
    const ratingChange = `${averageRating >= previousAverageRating ? '+' : ''}${(averageRating - previousAverageRating).toFixed(1)}`;

    // Get revenue data from subscriptions
    const subscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('status', '==', 'active')
      .get();

    let totalRevenue = 0;
    subscriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.price && typeof data.price === 'number') {
        totalRevenue += data.price;
      }
    });

    // Get previous period revenue
    const previousSubscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('status', '==', 'active')
      .where('createdAt', '<=', previousTo.toISOString())
      .get();

    let previousTotalRevenue = 0;
    previousSubscriptionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.price && typeof data.price === 'number') {
        previousTotalRevenue += data.price;
      }
    });

    // Calculate revenue growth
    const revenueGrowth = previousTotalRevenue > 0 
      ? ((totalRevenue - previousTotalRevenue) / previousTotalRevenue * 100).toFixed(1)
      : '0';
    const revenueChange = `${revenueGrowth.startsWith('-') ? '' : '+'}${revenueGrowth}%`;

    // Generate chart data
    const chartData = await generateChartData(from, to, interval);

    const analytics = {
      totalUsers: totalUsers,
      activePlans: activePlans,
      averageRating: ratingCount > 0 ? averageRating : 0,
      revenue: totalRevenue,
      userGrowthChange: userGrowthChange,
      activePlansChange: activePlansChange,
      ratingChange: ratingChange,
      revenueChange: revenueChange,
      chartData: chartData
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}