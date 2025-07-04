import { db as clientDb } from '@/lib/firebase';
import { collection, doc, runTransaction, writeBatch } from 'firebase/firestore';
import type { DocumentSnapshot, QuerySnapshot, CollectionReference, Query } from 'firebase/firestore';

/**
 * Unified Firebase adapter that abstracts client vs admin SDK differences
 * Provides consistent interface for database operations
 */

export type DatabaseAdapter = {
  collection: (path: string) => CollectionReference | any;
  doc: (path: string) => any;
  runTransaction: (fn: any) => Promise<any>;
  batch: () => any;
  isInitialized: () => boolean;
  type: 'client' | 'admin';
};

/**
 * Client SDK adapter for browser/client-side operations
 */
export const createClientAdapter = (): DatabaseAdapter => ({
  collection: (path: string) => {
    if (!clientDb) throw new Error('[FirebaseAdapter] Client SDK not initialized');
    return collection(clientDb, path);
  },
  doc: (path: string) => {
    if (!clientDb) throw new Error('[FirebaseAdapter] Client SDK not initialized');
    return doc(clientDb, path);
  },
  runTransaction: async (fn: any) => {
    if (!clientDb) throw new Error('[FirebaseAdapter] Client SDK not initialized');
    return runTransaction(clientDb, fn);
  },
  batch: () => {
    if (!clientDb) throw new Error('[FirebaseAdapter] Client SDK not initialized');
    return writeBatch(clientDb);
  },
  isInitialized: () => !!clientDb,
  type: 'client'
});

/**
 * Admin SDK adapter for server-side operations
 * Only imports admin SDK when actually needed
 */
export const createAdminAdapter = (): DatabaseAdapter => {
  // Dynamic import to avoid bundling admin SDK on client
  const getFirestoreAdmin = () => {
    if (typeof window !== 'undefined') {
      throw new Error('[FirebaseAdapter] Admin SDK cannot be used in browser environment');
    }
    
    try {
      const { firestoreAdmin } = require('@/lib/firebaseAdmin');
      if (!firestoreAdmin) {
        throw new Error('[FirebaseAdapter] Admin SDK not initialized');
      }
      return firestoreAdmin;
    } catch (error) {
      throw new Error('[FirebaseAdapter] Failed to load admin SDK: ' + (error as Error).message);
    }
  };

  return {
    collection: (path: string) => {
      const firestoreAdmin = getFirestoreAdmin();
      return firestoreAdmin.collection(path);
    },
    doc: (path: string) => {
      const firestoreAdmin = getFirestoreAdmin();
      return firestoreAdmin.doc(path);
    },
    runTransaction: async (fn: any) => {
      const firestoreAdmin = getFirestoreAdmin();
      return firestoreAdmin.runTransaction(fn);
    },
    batch: () => {
      const firestoreAdmin = getFirestoreAdmin();
      return firestoreAdmin.batch();
    },
    isInitialized: () => {
      try {
        const firestoreAdmin = getFirestoreAdmin();
        return !!firestoreAdmin;
      } catch {
        return false;
      }
    },
    type: 'admin'
  };
};

/**
 * Auto-detecting adapter that chooses client or admin based on environment
 */
export const createAutoAdapter = (): DatabaseAdapter => {
  // Check if we're in a server environment
  if (typeof window === 'undefined') {
    try {
      return createAdminAdapter();
    } catch {
      // Fallback to client if admin fails
      return createClientAdapter();
    }
  }
  
  // Browser environment - use client adapter
  return createClientAdapter();
};

/**
 * Default database adapter - automatically chooses the appropriate SDK
 */
export const db = createAutoAdapter();

/**
 * Explicitly get admin adapter for server-side operations
 */
export const getAdminAdapter = (): DatabaseAdapter => {
  if (typeof window !== 'undefined') {
    throw new Error('[FirebaseAdapter] Admin SDK not available in browser environment');
  }
  return createAdminAdapter();
};

/**
 * Explicitly get client adapter for client-side operations
 */
export const getClientAdapter = (): DatabaseAdapter => {
  if (!clientDb) {
    throw new Error('[FirebaseAdapter] Client SDK not available. Ensure you are in a browser environment.');
  }
  return createClientAdapter();
}; 