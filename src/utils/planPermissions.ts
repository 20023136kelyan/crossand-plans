import type { Plan } from '@/types/user';

/**
 * Checks if a user can comment and rate a plan based on their participation and completion status
 * @param plan - The plan object
 * @param userId - The current user's ID
 * @returns boolean - true if user can comment/rate, false otherwise
 */
export function canUserCommentAndRate(plan: Plan, userId: string | null | undefined): boolean {
  // User must be authenticated
  if (!userId) {
    return false;
  }

  // Plan must be completed
  if (plan.status !== 'completed') {
    return false;
  }

  // Check if user is the host
  const isHost = plan.hostId === userId;
  
  // Check if user is an invited participant
  const isParticipant = plan.invitedParticipantUserIds?.includes(userId) || false;
  
  // Check if user used this plan as a template (confirmed completion)
  const hasUsedAsTemplate = plan.completionConfirmedBy?.includes(userId) || false;
  
  // User can comment/rate if they:
  // 1. Hosted the plan, OR
  // 2. Were an invited participant, OR 
  // 3. Used this plan as a template and marked it as completed
  return isHost || isParticipant || hasUsedAsTemplate;
}

/**
 * Checks if a user participated in a plan (either as host or participant)
 * @param plan - The plan object
 * @param userId - The current user's ID
 * @returns boolean - true if user participated, false otherwise
 */
export function didUserParticipateInPlan(plan: Plan, userId: string | null | undefined): boolean {
  if (!userId) {
    return false;
  }

  const isHost = plan.hostId === userId;
  const isParticipant = plan.invitedParticipantUserIds?.includes(userId) || false;
  
  return isHost || isParticipant;
}

/**
 * Checks if a user has RSVP'd to a plan
 * @param plan - The plan object
 * @param userId - The current user's ID
 * @returns boolean - true if user has RSVP'd (going/maybe/not_going), false if pending or not invited
 */
export function hasUserRSVPd(plan: Plan, userId: string | null | undefined): boolean {
  if (!userId) {
    return false;
  }

  // Host is automatically considered as having RSVP'd
  if (plan.hostId === userId) {
    return true;
  }

  // Check participant response
  const response = plan.participantResponses?.[userId];
  return response !== undefined && response !== 'pending';
}