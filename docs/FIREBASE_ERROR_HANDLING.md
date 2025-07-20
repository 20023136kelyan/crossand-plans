# Firebase Error Handling Improvements

## Overview

This document describes the improvements made to handle Firebase Firestore errors, particularly the `BloomFilterError` that can occur during real-time listeners.

## Problem

The application was experiencing `BloomFilterError` from Firebase Firestore, which can occur due to:
- Network connectivity issues
- Temporary Firebase service disruptions
- Client-side connection problems
- Large dataset processing issues

## Solution

### 1. Shared Error Handling Utility

Created `src/lib/firebaseListenerUtils.ts` with:
- **Retry Logic**: Exponential backoff with configurable retry attempts
- **Error Classification**: Identifies retryable vs non-retryable errors
- **Fallback Mechanisms**: Graceful degradation to one-time fetches when real-time listeners fail
- **Generic Listeners**: Reusable wrapper for Firebase `onSnapshot` calls

### 2. Updated Services

#### Notification Listener (`src/services/notificationListener.ts`)
- Enhanced with retry logic and fallback operations
- Handles both notification lists and unread counts
- Graceful error recovery with user-friendly fallbacks

#### Client Services (`src/services/clientServices.ts`)
- Updated all real-time listeners to use the shared utility
- Functions affected:
  - `getFriendships`
  - `getUserChats`
  - `getPendingPlanSharesForUser`
  - `getPendingPlanInvitationsCount`
  - `getCompletedPlansForParticipant`
  - `getPostInteractionsForUser`
  - `getPostComments`

#### Plan Comments (`src/components/plans/PlanComments.tsx`)
- Updated comment listener to use shared error handling
- Maintains real-time updates with fallback to one-time fetch

### 3. Error Types Handled

The system now handles these retryable errors:
- `BloomFilterError` - Primary target
- `unavailable` - Service temporarily unavailable
- `deadline-exceeded` - Request timeout
- `resource-exhausted` - Rate limiting
- `internal` - Firebase internal errors
- `network-error` - Network connectivity issues
- `permission-denied` - Sometimes temporary auth issues
- `unauthenticated` - Sometimes temporary auth issues

### 4. Retry Configuration

- **Max Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds
- **Backoff Strategy**: Exponential (1s, 2s, 4s, 8s, 10s max)

### 5. Fallback Strategy

When real-time listeners persistently fail:
1. **First**: Retry with exponential backoff
2. **Then**: Fall back to one-time `getDocs` calls
3. **Finally**: Log error and continue with empty/default data

## Implementation Details

### Usage Example

```typescript
import { createListenerWithRetry, getCollectionFallback } from '@/lib/firebaseListenerUtils';

const listener = createListenerWithRetry(
  () => onSnapshot(query, (snapshot) => {
    // Handle real-time updates
    onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }),
  onUpdate, // Success callback
  onError,  // Error callback
  () => getCollectionFallback('collection-path', [queryConstraints]) // Fallback
);

return listener.unsubscribe;
```

### Benefits

1. **Improved Reliability**: Handles temporary Firebase issues gracefully
2. **Better UX**: Users don't see broken functionality during network issues
3. **Reduced Error Logs**: Fewer unhandled errors in production
4. **Maintainable**: Centralized error handling logic
5. **Flexible**: Easy to add new error types or adjust retry strategies

## Monitoring

The system logs:
- Retry attempts with timing information
- Fallback activations
- Persistent failures for debugging

## Future Improvements

1. **Metrics**: Add error tracking and success rate monitoring
2. **User Feedback**: Show connection status to users
3. **Offline Support**: Implement offline-first strategies
4. **Custom Retry**: Allow per-function retry configuration

## Testing

To test error handling:
1. Simulate network issues
2. Test with large datasets
3. Verify fallback behavior
4. Check retry timing and limits 