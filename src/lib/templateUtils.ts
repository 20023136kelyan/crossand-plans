import { Plan } from '@/types/plan';

export interface TemplateCreationOptions {
  originalPlan: Plan;
  shouldCreateTemplate: boolean;
}

export interface TemplateData {
  id: string;
  isTemplate: true;
  parentTemplateId: string | null;
  authorId: string;
  templateOriginalHostId: string;
  templateOriginalHostName: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  creatorIsVerified: false;
  participantUserIds: [];
  invitedParticipantUserIds: [];
  participantResponses: {};
  waitlistUserIds: [];
  privateNotes: null;
  eventTime: null;
  name: string;
  description: string;
  location: string;
  city: string;
  eventType: string;
  priceRange: string;
  itinerary: any[];
  photoHighlights: any[];
  averageRating?: number | null;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates a template from a completed plan
 * @param originalPlan - The original plan to create a template from
 * @returns Template data ready for Firestore insertion
 */
export function createTemplateFromPlan(originalPlan: Plan): TemplateData {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    isTemplate: true,
    parentTemplateId: originalPlan.id, // This should be the ID of the plan being converted to template
    authorId: originalPlan.hostId,
    templateOriginalHostId: originalPlan.hostId,
    templateOriginalHostName: originalPlan.hostName || '',
    creatorName: originalPlan.hostName || '',
    creatorAvatarUrl: originalPlan.hostAvatarUrl,
    creatorIsVerified: false,
    participantUserIds: [],
    invitedParticipantUserIds: [],
    participantResponses: {},
    waitlistUserIds: [],
    privateNotes: null,
    eventTime: null,
    name: originalPlan.name,
    description: originalPlan.description || '',
    location: originalPlan.location,
    city: originalPlan.city,
    eventType: originalPlan.eventType || '',
    priceRange: originalPlan.priceRange,
    itinerary: originalPlan.itinerary.map(item => ({
      ...item,
      startTime: item.startTime ? new Date(item.startTime).toTimeString().split(' ')[0] : null,
      endTime: item.endTime ? new Date(item.endTime).toTimeString().split(' ')[0] : null
    })),
    photoHighlights: originalPlan.photoHighlights || [],
    averageRating: originalPlan.averageRating || null,
    reviewCount: originalPlan.reviewCount || 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Gets default template fields for new plan creation
 * @returns Object with template fields set to undefined
 */
export function getDefaultTemplateFields() {
  return {
    templateOriginalHostId: undefined,
    templateOriginalHostName: undefined,
  };
}

/**
 * Checks if a plan should be converted to a template
 * @param plan - The plan to check
 * @returns Whether the plan should become a template
 */
export function shouldCreateTemplate(plan: Plan): boolean {
  // Add your template creation logic here
  // This could include checks for plan quality, user permissions, etc.
  return true; // Placeholder - implement your logic
} 