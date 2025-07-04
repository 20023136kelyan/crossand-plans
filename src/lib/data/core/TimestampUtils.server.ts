import 'server-only';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

/**
 * Server-side timestamp conversion utilities
 * Handles admin Firebase SDK timestamps for server-only operations
 */

/**
 * Converts admin Firebase timestamp to ISO string
 * Handles admin SDK and legacy formats
 */
export const convertAdminTimestampToISO = (ts: any): string => {
  if (!ts) return new Date(0).toISOString();
  
  // Handle Admin SDK Timestamp
  if (ts instanceof AdminTimestamp) return ts.toDate().toISOString();
  
  // Handle server timestamp functions
  if (ts && typeof ts.toDate === 'function') {
    try { 
      return ts.toDate().toISOString(); 
    } catch (e) { 
      console.warn('[TimestampUtils.server] Failed to convert timestamp with toDate():', e);
    }
  }
  
  // Handle JavaScript Date
  if (ts instanceof Date) return ts.toISOString();
  
  // Handle ISO string
  if (typeof ts === 'string') {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  
  // Handle numeric timestamp (milliseconds since epoch)
  if (typeof ts === 'number' && !isNaN(ts)) {
    return new Date(ts).toISOString();
  }
  
  console.warn(`[TimestampUtils.server] Unexpected timestamp type: ${typeof ts}, value:`, ts);
  return new Date(0).toISOString();
};

/**
 * Converts admin timestamps for server-side plan data
 */
export const convertAdminPlanTimestamps = (data: any) => {
  const convert = convertAdminTimestampToISO;
  
  return {
    eventTime: convert(data.eventTime),
    createdAt: convert(data.createdAt), 
    updatedAt: convert(data.updatedAt),
    itinerary: data.itinerary?.map((item: any) => ({
      ...item,
      startTime: convert(item.startTime),
      endTime: item.endTime ? convert(item.endTime) : null,
    })) || [],
  };
};

// Export for backward compatibility
export const convertTimestampToISO = convertAdminTimestampToISO; 