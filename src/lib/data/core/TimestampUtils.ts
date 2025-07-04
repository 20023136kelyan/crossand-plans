import { Timestamp as ClientTimestamp } from 'firebase/firestore';

/**
 * Client-side timestamp conversion utilities
 * Handles only client Firebase SDK timestamps
 */

/**
 * Converts client Firebase timestamp to ISO string
 * Handles client SDK and legacy formats
 */
export const convertTimestampToISO = (ts: any): string => {
  if (!ts) return new Date(0).toISOString();
  
  // Handle Client SDK Timestamp  
  if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
  
  // Handle server timestamp functions
  if (ts && typeof ts.toDate === 'function') {
    try { 
      return ts.toDate().toISOString(); 
    } catch (e) { 
      console.warn('[TimestampUtils] Failed to convert timestamp with toDate():', e);
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
  
  console.warn(`[TimestampUtils] Unexpected timestamp type: ${typeof ts}, value:`, ts);
  return new Date(0).toISOString();
};

/**
 * Converts timestamp to milliseconds for sorting/comparison
 */
export const convertTimestampToMillis = (ts: any): number => {
  if (!ts) return 0;
  
  if (ts instanceof ClientTimestamp) return ts.toDate().getTime();
  
  if (ts && typeof ts.toDate === 'function') {
    try { 
      return ts.toDate().getTime(); 
    } catch (e) { 
      console.warn('[TimestampUtils] Failed to convert timestamp to millis:', e);
      return 0;
    }
  }
  
  if (ts instanceof Date) return ts.getTime();
  
  if (typeof ts === 'string') {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date.getTime();
  }
  
  if (typeof ts === 'number' && !isNaN(ts)) return ts;
  
  console.warn(`[TimestampUtils] Could not convert to millis: ${typeof ts}, value:`, ts);
  return 0;
};

/**
 * Converts timestamps for client-side plan data
 */
export const convertClientPlanTimestamps = (data: any) => {
  const convert = convertTimestampToISO;
  
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