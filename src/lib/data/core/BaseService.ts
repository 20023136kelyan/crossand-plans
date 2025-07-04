import { createClientAdapter, createAdminAdapter, type DatabaseAdapter } from '../adapters/FirebaseAdapter';

/**
 * Base service class providing common patterns for all services
 * Centralizes error handling, logging, and database operations
 */

export abstract class BaseService {
  protected readonly db: DatabaseAdapter;
  protected readonly serviceName: string;

  constructor(serviceName: string, useAdmin: boolean = false) {
    this.serviceName = serviceName;
    this.db = useAdmin ? createAdminAdapter() : createClientAdapter();
  }

  /**
   * Standardized error logging
   */
  protected logError(operation: string, error: any, context?: any): void {
    console.error(`[${this.serviceName}:${operation}] Error:`, error);
    if (context) {
      console.error(`[${this.serviceName}:${operation}] Context:`, context);
    }
  }

  /**
   * Standardized info logging
   */
  protected logInfo(operation: string, message: string, data?: any): void {
    console.log(`[${this.serviceName}:${operation}] ${message}`);
    if (data) {
      console.log(`[${this.serviceName}:${operation}] Data:`, data);
    }
  }

  /**
   * Standardized warning logging
   */
  protected logWarning(operation: string, message: string, data?: any): void {
    console.warn(`[${this.serviceName}:${operation}] ${message}`);
    if (data) {
      console.warn(`[${this.serviceName}:${operation}] Data:`, data);
    }
  }

  /**
   * Check if database is initialized
   */
  protected ensureDbInitialized(): void {
    if (!this.db.isInitialized()) {
      throw new Error(`[${this.serviceName}] Database not initialized`);
    }
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, operation: string): void {
    const missing = Object.entries(params)
      .filter(([key, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`[${this.serviceName}:${operation}] Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Safe async operation wrapper with error handling
   */
  protected async safeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: any
  ): Promise<T> {
    try {
      this.ensureDbInitialized();
      return await fn();
    } catch (error) {
      this.logError(operation, error, context);
      throw error;
    }
  }

  /**
   * Standard collection constants
   */
  protected static readonly COLLECTIONS = {
    PLANS: 'plans',
    USERS: 'users',
    CHATS: 'chats',
    FEED_POSTS: 'feedPosts',
    PLAN_COLLECTIONS: 'planCollections',
    PLAN_SHARES: 'planShares',
  } as const;

  /**
   * Standard subcollection constants
   */
  protected static readonly SUBCOLLECTIONS = {
    RATINGS: 'ratings',
    COMMENTS: 'comments',
    MESSAGES: 'messages',
    FRIENDSHIPS: 'friendships',
  } as const;
} 