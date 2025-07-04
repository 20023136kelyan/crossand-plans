import type { Plan } from '@/types/user';
import type { DocumentSnapshot } from 'firebase/firestore';
import { convertTimestampToISO } from '../core/TimestampUtils';

/**
 * Client-side Plan mapping utilities
 * Maps client Firebase SDK document snapshots to Plan interface
 */

/**
 * Maps client Firebase document snapshot to Plan interface
 * Handles client SDK snapshots only
 */
export const mapDocumentToPlan = (docSnap: DocumentSnapshot): Plan => {
  if (!docSnap.exists()) {
    throw new Error('[PlanMapper] Cannot map non-existent document to Plan');
  }
  
  const data = docSnap.data();
  if (!data) {
    throw new Error('[PlanMapper] Document data is null or undefined');
  }

  return {
    id: docSnap.id,
    name: data.name,
    description: data.description || null,
    eventTime: convertTimestampToISO(data.eventTime),
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
      startTime: convertTimestampToISO(item.startTime),
      endTime: item.endTime ? convertTimestampToISO(item.endTime) : null,
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
    createdAt: convertTimestampToISO(data.createdAt),
    updatedAt: convertTimestampToISO(data.updatedAt),
  } as Plan;
};

/**
 * Maps array of document snapshots to Plan array
 */
export const mapDocumentsToPlanArray = (docs: DocumentSnapshot[]): Plan[] => {
  return docs
    .filter(doc => doc.exists())
    .map(doc => mapDocumentToPlan(doc));
};

/**
 * Legacy alias for backward compatibility
 * @deprecated Use mapDocumentToPlan instead
 */
export const mapDocToPlan = mapDocumentToPlan; 