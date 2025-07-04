import 'server-only';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { Timestamp as AdminTimestamp, type Query, type DocumentReference, type CollectionReference, type DocumentSnapshot, type QuerySnapshot, type WhereFilterOp } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// === Collection Constants ===
export const COLLECTIONS = {
  USERS: 'users',
  PLANS: 'plans',
  FEED_POSTS: 'feedPosts', 
  CHATS: 'chats',
  TRANSACTIONS: 'transactions',
  SUBSCRIPTIONS: 'subscriptions',
  REWARDS: 'rewards',
  WALLETS: 'wallets',
  BACKUPS: 'backups',
  MODERATION_REPORTS: 'moderationReports',
  SECURITY_EVENTS: 'securityEvents',
  SEARCH_ANALYTICS: 'searchAnalytics',
  POPULAR_SEARCHES: 'popularSearches',
  PLAN_SHARES: 'planShares',
  SETTINGS: 'settings',
} as const;

export const SUBCOLLECTIONS = {
  FRIENDSHIPS: 'friendships',
  COMMENTS: 'comments', 
  RATINGS: 'ratings',
  MESSAGES: 'messages',
} as const;

// === Query Builder Interface ===
interface QueryOptions {
  collection: string;
  subcollection?: { docId: string; name: string };
  filters?: Array<{ field: string; operator: WhereFilterOp; value: any }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  startAfter?: AdminTimestamp | string;
  startAt?: AdminTimestamp | string;
}

interface PaginationOptions {
  limit?: number;
  cursor?: string; // ISO timestamp string
  cursorField?: string; // Field to use for cursor (default: 'createdAt')
}

// === Core Query Builder Class ===
export class FirebaseQueryBuilder {
  private static validateFirestore(): void {
    if (!firestoreAdmin) {
      throw new Error('Firestore Admin SDK not initialized');
    }
  }

  // === Collection Reference Builders ===
  static collection(collectionName: string): CollectionReference {
    this.validateFirestore();
    return firestoreAdmin!.collection(collectionName);
  }

  static doc(collectionName: string, docId: string): DocumentReference {
    this.validateFirestore();
    return firestoreAdmin!.collection(collectionName).doc(docId);
  }

  static subcollection(collectionName: string, docId: string, subcollectionName: string): CollectionReference {
    this.validateFirestore();
    return firestoreAdmin!.collection(collectionName).doc(docId).collection(subcollectionName);
  }

  // === Generic Query Builder ===
  static buildQuery(options: QueryOptions): Query {
    this.validateFirestore();
    
    let query: Query;
    
    if (options.subcollection) {
      query = this.subcollection(options.collection, options.subcollection.docId, options.subcollection.name);
    } else {
      query = this.collection(options.collection);
    }

    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    }

    // Apply ordering
    if (options.orderBy) {
      for (const order of options.orderBy) {
        query = query.orderBy(order.field, order.direction);
      }
    }

    // Apply pagination
    if (options.startAfter) {
      const timestamp = typeof options.startAfter === 'string' 
        ? AdminTimestamp.fromDate(new Date(options.startAfter))
        : options.startAfter;
      query = query.startAfter(timestamp);
    }

    if (options.startAt) {
      const timestamp = typeof options.startAt === 'string'
        ? AdminTimestamp.fromDate(new Date(options.startAt))
        : options.startAt;
      query = query.startAt(timestamp);
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  // === Common Query Patterns ===
  
  // Get published items (plans, posts, etc.)
  static getPublishedQuery(collectionName: string, options?: PaginationOptions): Query {
    const queryOptions: QueryOptions = {
      collection: collectionName,
      filters: [{ field: 'status', operator: '==', value: 'published' }],
      orderBy: [{ field: 'eventTime', direction: 'desc' }],
      limit: options?.limit || 20,
    };

    if (options?.cursor) {
      queryOptions.startAfter = options.cursor;
    }

    return this.buildQuery(queryOptions);
  }

  // Get user's items
  static getUserItemsQuery(collectionName: string, userId: string, options?: PaginationOptions): Query {
    const timeField = collectionName === COLLECTIONS.PLANS ? 'eventTime' : 'createdAt';
    
    const queryOptions: QueryOptions = {
      collection: collectionName,
      filters: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: [{ field: timeField, direction: 'desc' }],
      limit: options?.limit || 20,
    };

    if (options?.cursor) {
      queryOptions.startAfter = options.cursor;
    }

    return this.buildQuery(queryOptions);
  }

  // Get items by multiple IDs (handles chunking automatically)
  static async getItemsByIds<T>(
    collectionName: string, 
    ids: string[], 
    mapper: (doc: DocumentSnapshot) => T,
    maxChunkSize: number = 30
  ): Promise<T[]> {
    this.validateFirestore();
    
    if (!ids.length) return [];
    
    const items: T[] = [];
    
    for (let i = 0; i < ids.length; i += maxChunkSize) {
      const chunk = ids.slice(i, i + maxChunkSize);
      if (chunk.length === 0) continue;

      try {
        const query = this.collection(collectionName)
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk);
        const snapshot = await query.get();
        
        snapshot.forEach(doc => {
          if (doc.exists) {
            items.push(mapper(doc));
          }
        });
      } catch (error) {
        console.error(`[QueryBuilder] Error fetching ${collectionName} chunk:`, error);
      }
    }
    
    return items;
  }

  // Get filtered items with common patterns
  static getFilteredQuery(
    collectionName: string, 
    filters: { [key: string]: any },
    options?: PaginationOptions & { timeField?: string }
  ): Query {
    const timeField = options?.timeField || 'createdAt';
    
    const queryOptions: QueryOptions = {
      collection: collectionName,
      filters: Object.entries(filters).map(([field, value]) => ({
        field,
        operator: '==' as WhereFilterOp,
        value
      })),
      orderBy: [{ field: timeField, direction: 'desc' }],
      limit: options?.limit || 20,
    };

    if (options?.cursor) {
      queryOptions.startAfter = options.cursor;
    }

    return this.buildQuery(queryOptions);
  }

  // Get active subscriptions
  static getActiveSubscriptionsQuery(userId: string): Query {
    return this.buildQuery({
      collection: COLLECTIONS.SUBSCRIPTIONS,
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'status', operator: '==', value: 'active' }
      ],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 1
    });
  }

  // Get user transactions
  static getUserTransactionsQuery(userId: string, options?: PaginationOptions): Query {
    return this.buildQuery({
      collection: COLLECTIONS.TRANSACTIONS,
      filters: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: options?.limit || 50,
      startAfter: options?.cursor
    });
  }

  // Get friendships by status
  static getFriendshipsQuery(userId: string, status: string = 'friends'): Query {
    return this.buildQuery({
      collection: COLLECTIONS.USERS,
      subcollection: { docId: userId, name: SUBCOLLECTIONS.FRIENDSHIPS },
      filters: [{ field: 'status', operator: '==', value: status }]
    });
  }

  // Generic count query
  static async getCount(collectionName: string, filters?: { [key: string]: any }): Promise<number> {
    this.validateFirestore();
    
    let query: Query = this.collection(collectionName);
    
    if (filters) {
      Object.entries(filters).forEach(([field, value]) => {
        query = query.where(field, '==', value);
      });
    }
    
    const snapshot = await query.count().get();
    return snapshot.data().count;
  }

  // === Batch Operations ===
  static createBatch() {
    this.validateFirestore();
    return firestoreAdmin!.batch();
  }

  // Batch update multiple documents
  static async batchUpdate(updates: Array<{ ref: DocumentReference; data: any }>): Promise<void> {
    this.validateFirestore();
    
    const batch = this.createBatch();
    updates.forEach(({ ref, data }) => {
      batch.update(ref, data);
    });
    
    await batch.commit();
  }

  // === Utility Methods ===
  
  // Convert cursor string to AdminTimestamp
  static cursorToTimestamp(cursor: string): AdminTimestamp {
    return AdminTimestamp.fromDate(new Date(cursor));
  }

  // Validate collection name exists
  static validateCollection(collectionName: string): void {
    const validCollections = Object.values(COLLECTIONS);
    if (!validCollections.includes(collectionName as any)) {
      console.warn(`[QueryBuilder] Unknown collection: ${collectionName}`);
    }
  }
} 