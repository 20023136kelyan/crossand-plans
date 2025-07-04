import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FirebaseQueryBuilder, COLLECTIONS } from '@/lib/data/core/QueryBuilder';
import type { Firestore } from 'firebase-admin/firestore';

export interface ModerationReport {
  id: string;
  reportedUserId?: string;
  reportedPostId?: string;
  reportedPlanId?: string;
  reporterUserId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'harassment' | 'spam' | 'inappropriate_content' | 'violence' | 'hate_speech' | 'other';
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  action?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  reviewingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  reportsByCategory: Record<string, number>;
  reportsByPriority: Record<string, number>;
  averageResolutionTime: number;
  reportsToday: number;
  reportsThisWeek: number;
  reportsThisMonth: number;
}

/**
 * Submit a moderation report
 */
export async function submitModerationReport(
  reporterUserId: string,
  reportType: 'user' | 'post' | 'plan',
  targetId: string,
  reason: string,
  description?: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const report: Omit<ModerationReport, 'id'> = {
    reporterUserId,
    reason,
    description,
    status: 'pending',
    priority,
    category: categorizeReason(reason),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      reportType,
      userAgent: 'admin-panel'
    }
  };

  // Set target fields based on report type
  if (reportType === 'user') {
    report.reportedUserId = targetId;
  } else if (reportType === 'post') {
    report.reportedPostId = targetId;
  } else if (reportType === 'plan') {
    report.reportedPlanId = targetId;
  }

  const docRef = await FirebaseQueryBuilder.collection(COLLECTIONS.MODERATION_REPORTS).add(report);
  return docRef.id;
}

/**
 * Get moderation reports with filtering and pagination
 */
export async function getModerationReports(
  filters: {
    status?: string;
    priority?: string;
    category?: string;
    reportType?: string;
    startAfter?: string;
  } = {},
  limit: number = 20
): Promise<ModerationReport[]> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const queryFilters: { [key: string]: any } = {};
  
  if (filters.status) queryFilters.status = filters.status;
  if (filters.priority) queryFilters.priority = filters.priority;
  if (filters.category) queryFilters.category = filters.category;

  let query = FirebaseQueryBuilder.getFilteredQuery(
    COLLECTIONS.MODERATION_REPORTS,
    queryFilters,
    { limit }
  );

  // Apply report type filtering
  if (filters.reportType) {
    const typeField = `reported${filters.reportType.charAt(0).toUpperCase() + filters.reportType.slice(1)}Id`;
    query = query.where(typeField, '!=', null);
  }

  // Apply cursor pagination if provided
  if (filters.startAfter) {
    const startAfterDoc = await FirebaseQueryBuilder.doc(COLLECTIONS.MODERATION_REPORTS, filters.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const snapshot = await query.get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ModerationReport));
}

/**
 * Update moderation report status and add review information
 */
export async function updateModerationReport(
  reportId: string,
  updates: {
    status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
    reviewedBy?: string;
    action?: string;
    notes?: string;
  }
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const updateData: any = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (updates.status && ['resolved', 'dismissed'].includes(updates.status)) {
    updateData.reviewedAt = new Date().toISOString();
  }

  await FirebaseQueryBuilder.doc(COLLECTIONS.MODERATION_REPORTS, reportId).update(updateData);
}

/**
 * Auto-resolve a moderation report
 */
export async function autoResolveModerationReport(
  reportId: string,
  action: string,
  notes?: string
): Promise<void> {
  await updateModerationReport(reportId, {
    status: 'resolved',
    reviewedBy: 'system',
    action,
    notes
  });
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(): Promise<ModerationStats> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const snapshot = await FirebaseQueryBuilder.collection(COLLECTIONS.MODERATION_REPORTS).get();
  
  const stats: ModerationStats = {
    totalReports: snapshot.size,
    pendingReports: 0,
    reviewingReports: 0,
    resolvedReports: 0,
    dismissedReports: 0,
    reportsByCategory: {},
    reportsByPriority: {},
    averageResolutionTime: 0,
    reportsToday: 0,
    reportsThisWeek: 0,
    reportsThisMonth: 0
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalResolutionTime = 0;
  let resolvedCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data() as ModerationReport;
    
    // Count by status - use explicit type casting for status-based properties
    const statusKey = `${data.status}Reports` as 'pendingReports' | 'reviewingReports' | 'resolvedReports' | 'dismissedReports';
    if (statusKey in stats && typeof stats[statusKey] === 'number') {
      (stats[statusKey] as number) = (stats[statusKey] as number) + 1;
    }
    
    // Count by category
    stats.reportsByCategory[data.category] = (stats.reportsByCategory[data.category] || 0) + 1;
    
    // Count by priority
    stats.reportsByPriority[data.priority] = (stats.reportsByPriority[data.priority] || 0) + 1;
    
    // Date-based counts
    const createdAt = new Date(data.createdAt);
    if (createdAt >= today) stats.reportsToday++;
    if (createdAt >= weekAgo) stats.reportsThisWeek++;
    if (createdAt >= monthAgo) stats.reportsThisMonth++;
    
    // Calculate resolution time for resolved reports
    if (data.status === 'resolved' && data.reviewedAt) {
      const resolutionTime = new Date(data.reviewedAt).getTime() - new Date(data.createdAt).getTime();
      totalResolutionTime += resolutionTime;
      resolvedCount++;
    }
  });

  // Calculate average resolution time in hours
  stats.averageResolutionTime = resolvedCount > 0 
    ? Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60)) 
    : 0;

  return stats;
}

/**
 * Helper function to categorize reasons
 */
function categorizeReason(reason: string): ModerationReport['category'] {
  const lowerReason = reason.toLowerCase();
  
  if (lowerReason.includes('harassment') || lowerReason.includes('bullying')) {
    return 'harassment';
  } else if (lowerReason.includes('spam') || lowerReason.includes('fake')) {
    return 'spam';
  } else if (lowerReason.includes('inappropriate') || lowerReason.includes('explicit')) {
    return 'inappropriate_content';
  } else if (lowerReason.includes('violence') || lowerReason.includes('threat')) {
    return 'violence';
  } else if (lowerReason.includes('hate') || lowerReason.includes('discrimination')) {
    return 'hate_speech';
  } else {
    return 'other';
  }
}