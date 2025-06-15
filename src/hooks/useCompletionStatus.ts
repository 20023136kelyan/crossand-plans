import { useState, useEffect } from 'react';
import type { Plan } from '@/types/user';

// Client-side completion status interface (mirrors server-side)
export interface CompletionStatus {
  isPlanCompleted: boolean;
  isUserConfirmed: boolean;
  planCompletedAt?: string;
  userCompletedAt?: string;
  totalConfirmations: number;
  totalParticipants: number;
  confirmationRate: number;
}

/**
 * Calculate completion status on the client side
 * This provides immediate feedback without server round-trips
 */
export function calculateCompletionStatus(
  plan: Plan,
  userId: string,
  userCompletions?: Array<{ planId: string; completedAt: string }>
): CompletionStatus {
  const totalParticipants = 1 + (plan.participantUserIds?.length || 0);
  const totalConfirmations = plan.completionConfirmedBy?.length || 0;
  const confirmationRate = totalParticipants > 0 ? (totalConfirmations / totalParticipants) * 100 : 0;
  
  // Find user's individual completion record
  const userCompletion = userCompletions?.find(c => c.planId === plan.id);
  
  return {
    isPlanCompleted: plan.status === 'completed',
    isUserConfirmed: plan.completionConfirmedBy?.includes(userId) || false,
    planCompletedAt: plan.completedAt,
    userCompletedAt: userCompletion?.completedAt,
    totalConfirmations,
    totalParticipants,
    confirmationRate
  };
}

/**
 * Check if a plan should be considered "fully completed"
 */
export function isFullyCompleted(status: CompletionStatus): boolean {
  if (!status.isPlanCompleted) return false;
  
  // For small groups (4 or fewer), require all to confirm
  if (status.totalParticipants <= 4) {
    return status.totalConfirmations === status.totalParticipants;
  }
  
  // For larger groups, require at least 50% confirmation
  return status.confirmationRate >= 50;
}

/**
 * Hook to get completion status for a single plan
 */
export function useCompletionStatus(
  plan: Plan | null,
  userId: string | null,
  userCompletions?: Array<{ planId: string; completedAt: string }>
): CompletionStatus | null {
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  
  useEffect(() => {
    if (!plan || !userId) {
      setStatus(null);
      return;
    }
    
    const newStatus = calculateCompletionStatus(plan, userId, userCompletions);
    setStatus(newStatus);
  }, [plan, userId, userCompletions]);
  
  return status;
}

/**
 * Hook to get completion status for multiple plans
 */
export function useBulkCompletionStatus(
  plans: Plan[],
  userId: string | null,
  userCompletions?: Array<{ planId: string; completedAt: string }>
): Record<string, CompletionStatus> {
  const [statuses, setStatuses] = useState<Record<string, CompletionStatus>>({});
  
  useEffect(() => {
    if (!userId || plans.length === 0) {
      setStatuses({});
      return;
    }
    
    const newStatuses: Record<string, CompletionStatus> = {};
    
    plans.forEach(plan => {
      newStatuses[plan.id] = calculateCompletionStatus(plan, userId, userCompletions);
    });
    
    setStatuses(newStatuses);
  }, [plans, userId, userCompletions]);
  
  return statuses;
}

/**
 * Get display text for completion status
 */
export function getCompletionDisplayText(status: CompletionStatus): {
  badge: string;
  description: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (!status.isPlanCompleted) {
    return {
      badge: 'Upcoming',
      description: 'Plan has not been completed yet',
      variant: 'outline'
    };
  }
  
  if (isFullyCompleted(status)) {
    return {
      badge: '✓ Completed',
      description: `Completed by ${status.totalConfirmations}/${status.totalParticipants} participants`,
      variant: 'default'
    };
  }
  
  return {
    badge: 'Partially Completed',
    description: `${status.totalConfirmations}/${status.totalParticipants} participants confirmed (${Math.round(status.confirmationRate)}%)`,
    variant: 'secondary'
  };
}

/**
 * Get action text for completion buttons
 */
export function getCompletionActionText(
  status: CompletionStatus,
  isHost: boolean
): {
  canMarkCompleted: boolean;
  canConfirm: boolean;
  markCompletedText: string;
  confirmText: string;
} {
  return {
    canMarkCompleted: isHost && !status.isPlanCompleted,
    canConfirm: !isHost && status.isPlanCompleted && !status.isUserConfirmed,
    markCompletedText: 'Mark as Completed',
    confirmText: status.isUserConfirmed ? 'Confirmed' : 'Confirm Completion'
  };
}