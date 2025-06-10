import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

interface ModerationReport {
  id?: string;
  type: 'plan' | 'comment' | 'profile' | 'message';
  status: 'pending' | 'flagged' | 'resolved' | 'dismissed';
  reportCount: number;
  reportedBy: string;
  reportedUser: string;
  reportedUserId: string;
  content: string;
  dateReported: string;
  contentId: string;
  reportReason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

const MODERATION_REPORTS_COLLECTION = 'moderationReports';

/**
 * Create a new moderation report
 */
export async function createModerationReport(
  type: ModerationReport['type'],
  reportedBy: string,
  reportedUser: string,
  reportedUserId: string,
  content: string,
  contentId: string,
  reportReason: string,
  options: {
    priority?: ModerationReport['priority'];
    metadata?: Record<string, any>;
  } = {}
): Promise<string | null> {
  if (!firestoreAdmin) {
    console.error('[createModerationReport] Firestore Admin SDK not initialized');
    return null;
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    // Check if a report already exists for this content
    const existingReportQuery = await db
      .collection(MODERATION_REPORTS_COLLECTION)
      .where('contentId', '==', contentId)
      .where('status', 'in', ['pending', 'flagged'])
      .get();

    if (!existingReportQuery.empty) {
      // Update existing report count
      const existingReport = existingReportQuery.docs[0];
      const currentData = existingReport.data();
      await existingReport.ref.update({
        reportCount: (currentData.reportCount || 1) + 1,
        lastReportedAt: new Date().toISOString(),
        lastReportedBy: reportedBy
      });
      return existingReport.id;
    }

    // Create new report
    const report: ModerationReport = {
      type,
      status: 'pending',
      reportCount: 1,
      reportedBy,
      reportedUser,
      reportedUserId,
      content,
      dateReported: new Date().toISOString(),
      contentId,
      reportReason,
      priority: options.priority || 'medium',
      metadata: options.metadata
    };

    const docRef = await db.collection(MODERATION_REPORTS_COLLECTION).add(report);
    console.log(`[createModerationReport] Report created: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('[createModerationReport] Error creating moderation report:', error);
    return null;
  }
}

/**
 * Get moderation reports with filtering and pagination
 */
export async function getModerationReports(
  filters: {
    status?: ModerationReport['status'];
    type?: ModerationReport['type'];
    priority?: ModerationReport['priority'];
    assignedTo?: string;
  } = {},
  limit: number = 50,
  startAfter?: string
): Promise<ModerationReport[]> {
  if (!firestoreAdmin) {
    console.error('[getModerationReports] Firestore Admin SDK not initialized');
    return [];
  }

  try {
    const db = firestoreAdmin as Firestore;
    let query = db.collection(MODERATION_REPORTS_COLLECTION)
      .orderBy('dateReported', 'desc')
      .limit(limit);

    // Apply filters
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.priority) {
      query = query.where('priority', '==', filters.priority);
    }
    if (filters.assignedTo) {
      query = query.where('assignedTo', '==', filters.assignedTo);
    }

    if (startAfter) {
      const startAfterDoc = await db.collection(MODERATION_REPORTS_COLLECTION).doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ModerationReport[];
  } catch (error) {
    console.error('[getModerationReports] Error fetching moderation reports:', error);
    return [];
  }
}

/**
 * Update moderation report status
 */
export async function updateModerationReportStatus(
  reportId: string,
  status: ModerationReport['status'],
  moderatorId: string,
  resolution?: string
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[updateModerationReportStatus] Firestore Admin SDK not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: moderatorId
    };

    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolvedAt = new Date().toISOString();
      updateData.resolvedBy = moderatorId;
      if (resolution) {
        updateData.resolution = resolution;
      }
    }

    await db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId).update(updateData);
    return true;
  } catch (error) {
    console.error('[updateModerationReportStatus] Error updating report status:', error);
    return false;
  }
}

/**
 * Assign moderation report to a moderator
 */
export async function assignModerationReport(
  reportId: string,
  moderatorId: string
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[assignModerationReport] Firestore Admin SDK not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    await db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId).update({
      assignedTo: moderatorId,
      assignedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('[assignModerationReport] Error assigning report:', error);
    return false;
  }
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(): Promise<{
  total: number;
  pending: number;
  flagged: number;
  resolved: number;
  dismissed: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  if (!firestoreAdmin) {
    console.error('[getModerationStats] Firestore Admin SDK not initialized');
    return {
      total: 0,
      pending: 0,
      flagged: 0,
      resolved: 0,
      dismissed: 0,
      byType: {},
      byPriority: {}
    };
  }

  try {
    const db = firestoreAdmin as Firestore;
    const snapshot = await db.collection(MODERATION_REPORTS_COLLECTION).get();
    
    const stats = {
      total: snapshot.size,
      pending: 0,
      flagged: 0,
      resolved: 0,
      dismissed: 0,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Count by status
      if (data.status === 'pending') stats.pending++;
      else if (data.status === 'flagged') stats.flagged++;
      else if (data.status === 'resolved') stats.resolved++;
      else if (data.status === 'dismissed') stats.dismissed++;
      
      // Count by type
      stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
      
      // Count by priority
      stats.byPriority[data.priority] = (stats.byPriority[data.priority] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[getModerationStats] Error fetching moderation stats:', error);
    return {
      total: 0,
      pending: 0,
      flagged: 0,
      resolved: 0,
      dismissed: 0,
      byType: {},
      byPriority: {}
    };
  }
}