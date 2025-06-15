# Unified Plan Completion System

This document describes the streamlined and unified plan completion system that ensures consistent behavior across all components and services.

## Overview

The completion system tracks two levels of completion:

1. **Plan-level completion**: When the host marks a plan as completed
2. **User-level confirmation**: When individual participants confirm their attendance/completion

## Key Components

### 1. Data Structure

#### Plan Interface (`src/types/user.ts`)
```typescript
interface Plan {
  /** @deprecated Use status field instead */
  isCompleted?: boolean;           // Legacy completion flag
  status: PlanStatus;              // Primary completion tracking ('completed' when done)
  completedAt?: string;           // When host marked as completed
  completionConfirmedBy?: string[]; // User IDs who confirmed
  // ... other fields
}
```

#### PlanCompletion Collection
```typescript
interface PlanCompletion {
  id: string;
  planId: string;
  userId: string;
  completedAt: string;            // Individual completion timestamp
  verificationMethod: 'qr_code' | 'manual';
  participantIds: string[];
  qrCodeData?: string;
}
```

### 2. Unified Completion Service (`src/services/planCompletionService.server.ts`)

#### CompletionStatus Interface
```typescript
interface CompletionStatus {
  isPlanCompleted: boolean;       // Plan-level completion
  isUserConfirmed: boolean;       // User confirmed participation
  planCompletedAt?: string;       // Host completion timestamp
  userCompletedAt?: string;       // User completion timestamp
  totalConfirmations: number;     // Number of confirmations
  totalParticipants: number;      // Total participants
  confirmationRate: number;       // Percentage confirmed
}
```

#### Key Functions
- `getCompletionStatus(planId, userId)`: Get status for single plan
- `getBulkCompletionStatus(planIds, userId)`: Get status for multiple plans
- `isFullyCompleted(status)`: Check if plan is fully completed
- `recordPlanCompletion()`: Record individual completion

### 3. Client-side Hooks (`src/hooks/useCompletionStatus.ts`)

#### Available Hooks
- `useCompletionStatus(plan, userId)`: Single plan status
- `useBulkCompletionStatus(plans, userId)`: Multiple plans status
- `calculateCompletionStatus()`: Client-side calculation
- `getCompletionDisplayText()`: UI display helpers
- `getCompletionActionText()`: Button text helpers

### 4. API Endpoints

#### GET `/api/completion-status`
- Query single plan: `?planId=abc123`
- Query multiple plans: `?planIds=abc123,def456,ghi789`
- Requires Bearer token authentication

#### POST `/api/completion-status/refresh`
- Force refresh completion status cache
- Body: `{ planIds: ["abc123", "def456"] }`

## Completion Logic

### Plan Completion States

1. **Not Started**: `isPlanCompleted = false`
2. **Host Completed**: `isPlanCompleted = true`, some confirmations
3. **Fully Completed**: `isPlanCompleted = true`, sufficient confirmations

### Fully Completed Criteria

- **Small groups (≤4 people)**: All participants must confirm
- **Large groups (>4 people)**: At least 50% must confirm

### Visual Indicators

- **Green**: Fully completed (all criteria met)
- **Yellow**: Host completed, waiting for confirmations
- **Gray**: Not completed

## Usage Examples

### 1. Component with Completion Status

```typescript
import { useCompletionStatus, getCompletionDisplayText } from '@/hooks/useCompletionStatus';

function PlanCard({ plan, userId }: { plan: Plan; userId: string }) {
  const status = useCompletionStatus(plan, userId);
  const display = status ? getCompletionDisplayText(status) : null;
  
  return (
    <div>
      <h3>{plan.name}</h3>
      {display && (
        <Badge variant={display.variant} title={display.description}>
          {display.badge}
        </Badge>
      )}
    </div>
  );
}
```

### 2. Bulk Status for Plan Lists

```typescript
import { useBulkCompletionStatus } from '@/hooks/useCompletionStatus';

function PlanList({ plans, userId }: { plans: Plan[]; userId: string }) {
  const statuses = useBulkCompletionStatus(plans, userId);
  
  return (
    <div>
      {plans.map(plan => {
        const status = statuses[plan.id];
        return (
          <PlanCard key={plan.id} plan={plan} status={status} />
        );
      })}
    </div>
  );
}
```

### 3. Server-side Status Check

```typescript
import { getCompletionStatus, isFullyCompleted } from '@/services/planCompletionService.server';

export async function generateReport(planId: string, userId: string) {
  const status = await getCompletionStatus(planId, userId);
  
  if (!status) {
    throw new Error('Plan not found');
  }
  
  const isComplete = isFullyCompleted(status);
  
  return {
    planId,
    isComplete,
    confirmationRate: status.confirmationRate,
    completedAt: status.planCompletedAt
  };
}
```

## Migration Guide

### From Old System

1. **Use standardized status field for completion checks**:
   ```typescript
   // Standardized approach
   const isCompleted = plan.status === 'completed';
   
   // Or use completion service for detailed status
   const status = await getCompletionStatus(planId, userId);
   const isCompleted = status?.isPlanCompleted || false;
   ```

2. **Use unified completion display**:
   ```typescript
   // Old
   {plan.isCompleted && <Badge>Completed</Badge>}
   
   // New
   const display = status ? getCompletionDisplayText(status) : null;
   {display && <Badge variant={display.variant}>{display.badge}</Badge>}
   ```

3. **Update filtering logic**:
   ```typescript
   // Standard approach
   const completedPlans = plans.filter(p => p.status === 'completed');
   
   // For detailed completion tracking with confirmations
   const statuses = useBulkCompletionStatus(plans, userId);
   const completedPlans = plans.filter(p => statuses[p.id]?.isPlanCompleted);
   ```

## Best Practices

1. **Always use the unified hooks/functions** instead of direct field access
2. **Batch status requests** for lists using `useBulkCompletionStatus`
3. **Handle loading states** while status is being fetched
4. **Use appropriate visual indicators** based on completion state
5. **Validate completion status** after actions in server functions
6. **Cache status data** appropriately to avoid excessive API calls

## Troubleshooting

### Common Issues

1. **Inconsistent completion status**: Check that all components use unified hooks
2. **Missing confirmations**: Verify `confirmPlanCompletionAction` is called
3. **Stale data**: Use the refresh API endpoint after completion actions
4. **Performance issues**: Ensure bulk status hooks are used for lists

### Debug Tools

1. Check browser console for completion status logs
2. Use the `/api/completion-status` endpoint to verify server state
3. Inspect Firestore collections: `plans` and `plan_completions`
4. Monitor completion rate calculations in component props

## Future Enhancements

1. **Real-time updates**: WebSocket/SSE for live completion status
2. **Completion analytics**: Track completion patterns and rates
3. **Automated reminders**: Notify users to confirm completion
4. **Completion rewards**: Gamification for high completion rates
5. **Export functionality**: Generate completion reports