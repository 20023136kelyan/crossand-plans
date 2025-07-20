import { getDocs, getDoc, doc, collection, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Retry configuration
export const MAX_RETRIES = 3;
export const INITIAL_RETRY_DELAY = 1000; // 1 second
export const MAX_RETRY_DELAY = 10000; // 10 seconds

// Error types that should trigger retry
export const RETRYABLE_ERRORS = [
  'BloomFilterError',
  'unavailable',
  'deadline-exceeded',
  'resource-exhausted',
  'internal',
  'network-error',
  'permission-denied', // Sometimes temporary
  'unauthenticated' // Sometimes temporary auth issues
];

export function isRetryableError(error: any): boolean {
  const errorMessage = error?.message || error?.code || '';
  return RETRYABLE_ERRORS.some(retryableError => 
    errorMessage.toLowerCase().includes(retryableError.toLowerCase())
  );
}

export function getRetryDelay(attempt: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      const delay = getRetryDelay(attempt);
      console.warn(`Firebase operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export interface ListenerWithRetry<T> {
  unsubscribe: () => void;
  retry: () => void;
}

export function createListenerWithRetry<T>(
  setupListener: () => () => void,
  onUpdate: (data: T) => void,
  onError: (error: any) => void,
  fallbackOperation?: () => Promise<T>
): ListenerWithRetry<T> {
  let retryCount = 0;
  let unsubscribe: (() => void) | null = null;

  const setup = () => {
    try {
      unsubscribe = setupListener();
      retryCount = 0; // Reset retry count on success
    } catch (error) {
      console.error('Error setting up listener:', error);
      onError(error);
    }
  };

  const handleError = async (error: any) => {
    console.error('Firestore listener error:', error);
    
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = getRetryDelay(retryCount - 1);
      console.warn(`Retrying listener in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        if (unsubscribe) {
          unsubscribe();
          setup();
        }
      }, delay);
    } else if (fallbackOperation) {
      // Fallback to one-time fetch
      console.warn('Falling back to one-time fetch due to persistent listener errors');
      try {
        const data = await retryWithBackoff(fallbackOperation);
        onUpdate(data);
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
        onError(error);
      }
    } else {
      onError(error);
    }
  };

  setup();

  return {
    unsubscribe: () => {
      if (unsubscribe) {
        unsubscribe();
      }
    },
    retry: () => {
      if (unsubscribe) {
        unsubscribe();
      }
      retryCount = 0;
      setup();
    }
  };
}

// Generic fallback operations
export async function getCollectionFallback<T>(
  collectionPath: string,
  queryConstraints: any[] = [],
  transform: (doc: any) => T = (doc) => ({ id: doc.id, ...doc.data() } as T)
): Promise<T[]> {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const collectionRef = collection(db, collectionPath);
  const q = query(collectionRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(transform);
}

export async function getDocumentFallback<T>(
  documentPath: string,
  transform: (doc: any) => T = (doc) => ({ id: doc.id, ...doc.data() } as T)
): Promise<T | null> {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const docRef = doc(db, documentPath);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return transform(docSnap);
  }
  
  return null;
} 