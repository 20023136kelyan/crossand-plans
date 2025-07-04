import 'server-only';
import type { Plan } from '@/types/user';
import type { DocumentSnapshot as AdminDocumentSnapshot } from 'firebase-admin/firestore';
import { convertAdminTimestampToISO } from '../core/TimestampUtils.server';

/**
 * Server-side Plan mapping utilities
 * Maps admin Firebase SDK document snapshots to Plan interface
 */

/**
 * Maps admin Firebase document snapshot to Plan interface
 * Handles admin SDK snapshots only
 */
export const mapAdminDocumentToPlan = (docSnap: AdminDocumentSnapshot): Plan => {
  if (!docSnap.exists) {
    throw new Error('[PlanMapper.server] Cannot map non-existent document to Plan');
  }
  
  const data = docSnap.data();
  if (!data) {
    throw new Error('[PlanMapper.server] Document data is null or undefined');
  }

  return {
    id: docSnap.id,
    name: data.name,
    description: data.description || null,
    eventTime: convertAdminTimestampToISO(data.eventTime),
    location: data.location,
    city: data.city,
    eventType: data.eventType || null,
    eventTypeLowercase: data.eventTypeLowercase || (data.eventType || '').toLowerCase(),
    priceRange: data.priceRange || null,
    hostId: data.hostId,
    hostName: data.hostName || null,
    hostAvatarUrl: data.hostAvatarUrl || null,
    invitedParticipantUserIds: data.invitedParticipantUserIds || [],
    participantUserIds: data.participantUserIds || [],
    participantResponses: data.participantResponses || {},
    waitlistUserIds: data.waitlistUserIds || [],
    itinerary: data.itinerary?.map((item: any) => ({
      ...item,
      startTime: convertAdminTimestampToISO(item.startTime),
      endTime: item.endTime ? convertAdminTimestampToISO(item.endTime) : null,
    })) || [],
    status: data.status || 'draft',
    planType: data.planType || 'single-stop',
    originalPlanId: data.originalPlanId || null,
    sharedByUid: data.sharedByUid || null,
    averageRating: data.averageRating === undefined ? null : data.averageRating,
    reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
    photoHighlights: data.photoHighlights || [],
    privateNotes: data.privateNotes || '',
    completionConfirmedBy: data.completionConfirmedBy || [],
    isTemplate: data.isTemplate || false,
    creatorName: data.creatorName || null,
    creatorAvatarUrl: data.creatorAvatarUrl || null,
    creatorIsVerified: data.creatorIsVerified || false,
    createdAt: convertAdminTimestampToISO(data.createdAt),
    updatedAt: convertAdminTimestampToISO(data.updatedAt),
  } as Plan;
};

/**
 * Maps array of admin document snapshots to Plan array
 */
export const mapAdminDocumentsToPlanArray = (docs: AdminDocumentSnapshot[]): Plan[] => {
  return docs
    .filter(doc => doc.exists)
    .map(doc => mapAdminDocumentToPlan(doc));
};

/**
 * Legacy aliases for backward compatibility
 */
export const mapDocumentToPlan = mapAdminDocumentToPlan;
export const mapAdminDocToPlan = mapAdminDocumentToPlan; 