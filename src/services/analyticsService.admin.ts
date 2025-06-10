import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

export interface AnalyticsDataPoint {
  date: string;
  newUsers: number;
  newPlans: number;
  totalRevenue: number;
  averageRating: number;
  completedPlans: number;
  completionRate: number;
}

export interface AnalyticsExportOptions {
  from: Date;
  to: Date;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

/**
 * Generate analytics data points for export
 */
export async function generateAnalyticsExport(options: AnalyticsExportOptions): Promise<AnalyticsDataPoint[]> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  const { from, to, interval } = options;

  // Generate time intervals
  const dataPoints = generateTimeIntervals(from, to, interval);
  const results: AnalyticsDataPoint[] = [];

  // Fetch data for each interval
  for (const point of dataPoints) {
    try {
      const analyticsData = await fetchAnalyticsForPeriod(db, point.from, point.to);
      results.push({
        date: point.date,
        ...analyticsData
      });
    } catch (error) {
      console.error(`Error fetching analytics for ${point.date}:`, error);
      // Add zero data for failed periods
      results.push({
        date: point.date,
        newUsers: 0,
        newPlans: 0,
        totalRevenue: 0,
        averageRating: 0,
        completedPlans: 0,
        completionRate: 0
      });
    }
  }

  return results;
}

/**
 * Convert analytics data to CSV format
 */
export function convertToCSV(data: AnalyticsDataPoint[]): string {
  const headers = ['Date', 'New Users', 'New Plans', 'Total Revenue', 'Average Rating', 'Completed Plans', 'Completion Rate'];
  const csvRows = [headers.join(',')];

  for (const point of data) {
    const row = [
      point.date,
      point.newUsers.toString(),
      point.newPlans.toString(),
      point.totalRevenue.toFixed(2),
      point.averageRating.toFixed(2),
      point.completedPlans.toString(),
      (point.completionRate * 100).toFixed(2) + '%'
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Generate time intervals based on the specified interval type
 */
function generateTimeIntervals(from: Date, to: Date, interval: string) {
  const points = [];
  const current = new Date(from);
  
  while (current <= to) {
    const nextDate = new Date(current);
    
    switch (interval) {
      case 'hourly':
        nextDate.setHours(nextDate.getHours() + 1);
        break;
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    
    points.push({
      date: formatDateForInterval(current, interval),
      from: new Date(current),
      to: new Date(Math.min(nextDate.getTime(), to.getTime()))
    });
    
    current.setTime(nextDate.getTime());
  }
  
  return points;
}

/**
 * Format date based on interval type
 */
function formatDateForInterval(date: Date, interval: string): string {
  switch (interval) {
    case 'hourly':
      return date.toISOString().slice(0, 13) + ':00:00';
    case 'daily':
      return date.toISOString().split('T')[0];
    case 'weekly':
      // Return the Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      return `Week of ${monday.toISOString().split('T')[0]}`;
    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Fetch analytics data for a specific time period
 */
async function fetchAnalyticsForPeriod(db: Firestore, from: Date, to: Date) {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  // Fetch new users
  const usersQuery = db
    .collection('users')
    .where('createdAt', '>=', fromISO)
    .where('createdAt', '<', toISO);
  
  const usersSnapshot = await usersQuery.get();
  const newUsers = usersSnapshot.size;

  // Fetch new plans
  const plansQuery = db
    .collection('plans')
    .where('createdAt', '>=', fromISO)
    .where('createdAt', '<', toISO);
  
  const plansSnapshot = await plansQuery.get();
  const newPlans = plansSnapshot.size;

  // Fetch revenue from subscriptions
  const subscriptionsQuery = db
    .collection('subscriptions')
    .where('createdAt', '>=', fromISO)
    .where('createdAt', '<', toISO);
  
  const subscriptionsSnapshot = await subscriptionsQuery.get();
  let totalRevenue = 0;
  
  subscriptionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.amount && typeof data.amount === 'number') {
      totalRevenue += data.amount;
    } else if (data.price && typeof data.price === 'number') {
      totalRevenue += data.price;
    }
  });

  // Fetch ratings and calculate average
  const ratingsQuery = db
    .collection('ratings')
    .where('createdAt', '>=', fromISO)
    .where('createdAt', '<', toISO);
  
  const ratingsSnapshot = await ratingsQuery.get();
  let totalRating = 0;
  let ratingCount = 0;
  
  ratingsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.rating && typeof data.rating === 'number') {
      totalRating += data.rating;
      ratingCount++;
    }
  });
  
  const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

  // Fetch completed plans
  const completedPlansQuery = db
    .collection('plans')
    .where('isCompleted', '==', true)
    .where('updatedAt', '>=', fromISO)
    .where('updatedAt', '<', toISO);
  
  const completedPlansSnapshot = await completedPlansQuery.get();
  const completedPlans = completedPlansSnapshot.size;

  // Calculate completion rate
  let totalEligiblePlans = 0;
  let totalCompletedPlans = 0;
  
  // Get all plans that have passed their event time in this period
  const eligiblePlansQuery = db
    .collection('plans')
    .where('eventTime', '>=', fromISO)
    .where('eventTime', '<', toISO);
  
  const eligiblePlansSnapshot = await eligiblePlansQuery.get();
  
  eligiblePlansSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const eventTime = new Date(data.eventTime);
    const now = new Date();
    
    // Only count plans where the event time has passed
    if (eventTime <= now) {
      totalEligiblePlans++;
      if (data.isCompleted) {
        totalCompletedPlans++;
      }
    }
  });
  
  const completionRate = totalEligiblePlans > 0 ? totalCompletedPlans / totalEligiblePlans : 0;

  return {
    newUsers,
    newPlans,
    totalRevenue,
    averageRating,
    completedPlans,
    completionRate
  };
}

/**
 * Get analytics summary for dashboard
 */
export async function getAnalyticsSummary(days: number = 30) {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const data = await fetchAnalyticsForPeriod(db, startDate, now);

  // Get previous period for comparison
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
  const previousData = await fetchAnalyticsForPeriod(db, previousStartDate, startDate);

  // Calculate growth percentages
  const userGrowth = previousData.newUsers > 0 
    ? ((data.newUsers - previousData.newUsers) / previousData.newUsers) * 100 
    : 0;
  
  const planGrowth = previousData.newPlans > 0 
    ? ((data.newPlans - previousData.newPlans) / previousData.newPlans) * 100 
    : 0;
  
  const revenueGrowth = previousData.totalRevenue > 0 
    ? ((data.totalRevenue - previousData.totalRevenue) / previousData.totalRevenue) * 100 
    : 0;

  return {
    current: data,
    previous: previousData,
    growth: {
      users: userGrowth,
      plans: planGrowth,
      revenue: revenueGrowth
    }
  };
}