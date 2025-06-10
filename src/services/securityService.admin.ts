import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

interface SecurityEvent {
  id?: string;
  type: 'failed_login' | 'suspicious_activity' | 'data_breach_attempt' | 'settings_changed' | 'unauthorized_access' | 'account_locked' | 'password_reset' | 'two_factor_enabled' | 'two_factor_disabled';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
  description: string;
  status: 'active' | 'resolved' | 'blocked' | 'investigating';
  metadata?: Record<string, any>;
}

const SECURITY_EVENTS_COLLECTION = 'securityEvents';

/**
 * Log a security event to the database
 */
export async function logSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  user: string,
  ip: string,
  description: string,
  options: {
    userId?: string;
    userAgent?: string;
    status?: SecurityEvent['status'];
    metadata?: Record<string, any>;
  } = {}
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[logSecurityEvent] Firestore Admin SDK not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    const securityEvent: SecurityEvent = {
      type,
      severity,
      user,
      userId: options.userId,
      ip,
      userAgent: options.userAgent,
      timestamp: new Date().toISOString(),
      description,
      status: options.status || 'active',
      metadata: options.metadata
    };

    await db.collection(SECURITY_EVENTS_COLLECTION).add(securityEvent);
    console.log(`[logSecurityEvent] Security event logged: ${type} for user ${user}`);
    return true;
  } catch (error) {
    console.error('[logSecurityEvent] Error logging security event:', error);
    return false;
  }
}

/**
 * Log failed login attempt
 */
export async function logFailedLogin(
  email: string,
  ip: string,
  userAgent?: string,
  attemptCount: number = 1
): Promise<boolean> {
  const severity = attemptCount >= 5 ? 'high' : attemptCount >= 3 ? 'medium' : 'low';
  const description = `Failed login attempt ${attemptCount > 1 ? `(${attemptCount} attempts)` : ''} for ${email}`;
  
  return logSecurityEvent(
    'failed_login',
    severity,
    email,
    ip,
    description,
    { userAgent, metadata: { attemptCount } }
  );
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  userId: string,
  userEmail: string,
  ip: string,
  activity: string,
  userAgent?: string
): Promise<boolean> {
  return logSecurityEvent(
    'suspicious_activity',
    'high',
    userEmail,
    ip,
    `Suspicious activity detected: ${activity}`,
    { userId, userAgent, metadata: { activity } }
  );
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  userEmail: string,
  ip: string,
  resource: string,
  userAgent?: string
): Promise<boolean> {
  return logSecurityEvent(
    'unauthorized_access',
    'high',
    userEmail,
    ip,
    `Unauthorized access attempt to ${resource}`,
    { userAgent, metadata: { resource } }
  );
}

/**
 * Log account security changes
 */
export async function logSecurityChange(
  userId: string,
  userEmail: string,
  ip: string,
  changeType: 'password_reset' | 'two_factor_enabled' | 'two_factor_disabled' | 'account_locked',
  userAgent?: string
): Promise<boolean> {
  const severity = changeType === 'account_locked' ? 'high' : 'medium';
  const description = `Security change: ${changeType.replace('_', ' ')} for ${userEmail}`;
  
  return logSecurityEvent(
    changeType,
    severity,
    userEmail,
    ip,
    description,
    { userId, userAgent }
  );
}

/**
 * Get security events with pagination
 */
export async function getSecurityEvents(
  limit: number = 50,
  startAfter?: string
): Promise<SecurityEvent[]> {
  if (!firestoreAdmin) {
    console.error('[getSecurityEvents] Firestore Admin SDK not initialized');
    return [];
  }

  try {
    const db = firestoreAdmin as Firestore;
    let query = db.collection(SECURITY_EVENTS_COLLECTION)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (startAfter) {
      const startAfterDoc = await db.collection(SECURITY_EVENTS_COLLECTION).doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SecurityEvent[];
  } catch (error) {
    console.error('[getSecurityEvents] Error fetching security events:', error);
    return [];
  }
}

/**
 * Resolve a security event
 */
export async function resolveSecurityEvent(
  eventId: string,
  resolvedBy: string
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[resolveSecurityEvent] Firestore Admin SDK not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    await db.collection(SECURITY_EVENTS_COLLECTION).doc(eventId).update({
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy
    });
    return true;
  } catch (error) {
    console.error('[resolveSecurityEvent] Error resolving security event:', error);
    return false;
  }
}