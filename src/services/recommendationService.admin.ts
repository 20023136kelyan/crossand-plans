import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import type { UserPreferences } from '@/types/user';
import type { Plan } from '@/types/plan';
import type { PlanCollection } from '@/types/user';
import type { SearchAnalytics } from './searchAnalyticsService.admin';
import { calculatePersonalizedScore } from '@/lib/utils/enhancedRanking';

export interface RecommendationScore {
  id: string;
  type: 'plan' | 'collection';
  score: number;
  reasons: string[];
  data: Plan | PlanCollection;
}

export interface PersonalizedRecommendations {
  plans: RecommendationScore[];
  collections: RecommendationScore[];
  trendingPlans: RecommendationScore[];
  similarUsers: string[];
  recommendedCategories: string[];
  recommendedLocations: string[];
}

const PLANS_COLLECTION = 'plans';
const COLLECTIONS_COLLECTION = 'collections';
const USERS_COLLECTION = 'users';
const SEARCH_ANALYTICS_COLLECTION = 'searchAnalytics';
const USER_INTERACTIONS_COLLECTION = 'userInteractions';

/**
 * Get personalized recommendations for a user
 */
export async function getPersonalizedRecommendations(
  userId: string,
  userPreferences?: UserPreferences,
  limit: number = 20
): Promise<PersonalizedRecommendations> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    // Get user preferences if not provided
    if (!userPreferences) {
      const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      userPreferences = userDoc.data()?.preferences || {};
    }

    // Get user's search history, interactions, and completed plans
    const [searchHistory, userInteractions, completedPlans] = await Promise.all([
      getUserSearchHistory(userId, db),
      getUserInteractions(userId, db),
      getUserCompletedPlans(userId, db)
    ]);

    // Analyze user behavior patterns including completion data
    const behaviorAnalysis = analyzeBehaviorPatterns(searchHistory, userInteractions, completedPlans);
    
    // Create default preferences if none provided
    const defaultPreferences: UserPreferences = {
      preferredCategories: [],
      preferredLocations: [],
      preferredPriceRange: '$$'
    };
    const effectivePreferences = userPreferences || defaultPreferences;

    // Get content recommendations
    const [planRecommendations, collectionRecommendations, trendingPlans] = await Promise.all([
      getRecommendedPlans(userId, effectivePreferences, behaviorAnalysis, db, limit),
      getRecommendedCollections(userId, effectivePreferences, behaviorAnalysis, db, limit),
      getTrendingPlans(effectivePreferences, behaviorAnalysis, db, Math.floor(limit / 2))
    ]);

    // Get similar users and category/location recommendations
    const [similarUsers, recommendedCategories, recommendedLocations] = await Promise.all([
      findSimilarUsers(userId, effectivePreferences, behaviorAnalysis, db),
      getRecommendedCategories(behaviorAnalysis, effectivePreferences),
      getRecommendedLocations(behaviorAnalysis, effectivePreferences)
    ]);

    return {
      plans: planRecommendations,
      collections: collectionRecommendations,
      trendingPlans,
      similarUsers,
      recommendedCategories,
      recommendedLocations
    };
  } catch (error) {
    console.error('[getPersonalizedRecommendations] Error:', error);
    return {
      plans: [],
      collections: [],
      trendingPlans: [],
      similarUsers: [],
      recommendedCategories: [],
      recommendedLocations: []
    };
  }
}

/**
 * Get user's search history
 */
async function getUserSearchHistory(userId: string, db: Firestore): Promise<SearchAnalytics[]> {
  try {
    const searchHistoryQuery = await db
      .collection(SEARCH_ANALYTICS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    return searchHistoryQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SearchAnalytics));
  } catch (error) {
    console.error('[getUserSearchHistory] Error:', error);
    return [];
  }
}

/**
 * Get user interactions (saves, views, completions)
 */
async function getUserInteractions(userId: string, db: Firestore): Promise<any[]> {
  try {
    const interactionsQuery = await db
      .collection(USER_INTERACTIONS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    
    return interactionsQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('[getUserInteractions] Error:', error);
    return [];
  }
}

/**
 * Analyze user behavior patterns
 */
function analyzeBehaviorPatterns(searchHistory: SearchAnalytics[], interactions: any[], completedPlans?: any[]): {
  preferredCategories: Record<string, number>;
  preferredLocations: Record<string, number>;
  searchPatterns: Record<string, number>;
  timePatterns: Record<string, number>;
  interactionPatterns: Record<string, number>;
  completionPatterns: Record<string, number>;
} {
  const preferredCategories: Record<string, number> = {};
  const preferredLocations: Record<string, number> = {};
  const searchPatterns: Record<string, number> = {};
  const timePatterns: Record<string, number> = {};
  const interactionPatterns: Record<string, number> = {};
  const completionPatterns: Record<string, number> = {};

  // Analyze search history
  searchHistory.forEach(search => {
    const term = search.searchTerm.toLowerCase();
    searchPatterns[term] = (searchPatterns[term] || 0) + 1;
    
    // Extract time patterns
    const hour = new Date(search.timestamp).getHours();
    const timeSlot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;
    
    // Analyze clicked results for category preferences
    search.clickedResults?.forEach(click => {
      interactionPatterns[click.type] = (interactionPatterns[click.type] || 0) + 1;
    });
  });

  // Analyze user interactions
  interactions.forEach(interaction => {
    if (interaction.category) {
      preferredCategories[interaction.category] = (preferredCategories[interaction.category] || 0) + 1;
    }
    if (interaction.location) {
      preferredLocations[interaction.location] = (preferredLocations[interaction.location] || 0) + 1;
    }
    if (interaction.type) {
      interactionPatterns[interaction.type] = (interactionPatterns[interaction.type] || 0) + 1;
    }
  });

  // Analyze completed plans for stronger preference signals
  completedPlans?.forEach(plan => {
    if (plan.category) {
      preferredCategories[plan.category] = (preferredCategories[plan.category] || 0) + 3; // Weight completed plans higher
      completionPatterns[plan.category] = (completionPatterns[plan.category] || 0) + 1;
    }
    if (plan.city) {
      preferredLocations[plan.city] = (preferredLocations[plan.city] || 0) + 3;
    }
    if (plan.eventType) {
      interactionPatterns[plan.eventType] = (interactionPatterns[plan.eventType] || 0) + 2;
    }
  });

  return {
    preferredCategories,
    preferredLocations,
    searchPatterns,
    timePatterns,
    interactionPatterns,
    completionPatterns
  };
}

/**
 * Get recommended plans for a user
 */
async function getRecommendedPlans(
  userId: string,
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  db: Firestore,
  limit: number
): Promise<RecommendationScore[]> {
  try {
    // Get plans that match user preferences
    let plansQuery = db.collection(PLANS_COLLECTION).where('isPublic', '==', true);
    
    // Filter by preferred categories if available
    if (userPreferences.preferredCategories?.length) {
      plansQuery = plansQuery.where('category', 'in', userPreferences.preferredCategories.slice(0, 10));
    }
    
    const plansSnapshot = await plansQuery.limit(limit * 3).get(); // Get more to filter and rank
    const plans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
    
    // Score and rank plans
    const scoredPlans: RecommendationScore[] = [];
    
    for (const plan of plans) {
      const score = await calculateRecommendationScore(plan, userPreferences, behaviorAnalysis, 'plan');
      const reasons = generateRecommendationReasons(plan, userPreferences, behaviorAnalysis, 'plan');
      
      scoredPlans.push({
        id: plan.id,
        type: 'plan',
        score,
        reasons,
        data: plan
      });
    }
    
    // Sort by score and return top results
    return scoredPlans
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('[getRecommendedPlans] Error:', error);
    return [];
  }
}

/**
 * Get recommended collections for a user
 */
async function getRecommendedCollections(
  userId: string,
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  db: Firestore,
  limit: number
): Promise<RecommendationScore[]> {
  try {
    const collectionsSnapshot = await db
      .collection(COLLECTIONS_COLLECTION)
      .where('isPublic', '==', true)
      .limit(limit * 2)
      .get();
    
    const collections = collectionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanCollection));
    
    // Score and rank collections
    const scoredCollections: RecommendationScore[] = [];
    
    for (const collection of collections) {
      const score = await calculateRecommendationScore(collection, userPreferences, behaviorAnalysis, 'collection');
      const reasons = generateRecommendationReasons(collection, userPreferences, behaviorAnalysis, 'collection');
      
      scoredCollections.push({
        id: collection.id,
        type: 'collection',
        score,
        reasons,
        data: collection
      });
    }
    
    // Sort by score and return top results
    return scoredCollections
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('[getRecommendedCollections] Error:', error);
    return [];
  }
}

/**
 * Get trending plans based on user preferences
 */
async function getTrendingPlans(
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  db: Firestore,
  limit: number
): Promise<RecommendationScore[]> {
  try {
    // Get recently popular plans (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const trendingPlansSnapshot = await db
      .collection(PLANS_COLLECTION)
      .where('isPublic', '==', true)
      .where('updatedAt', '>=', sevenDaysAgo.toISOString())
      .orderBy('updatedAt', 'desc')
      .orderBy('saves', 'desc')
      .limit(limit * 2)
      .get();
    
    const trendingPlans = trendingPlansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
    
    // Score trending plans
    const scoredTrendingPlans: RecommendationScore[] = [];
    
    for (const plan of trendingPlans) {
      const baseScore = await calculateRecommendationScore(plan, userPreferences, behaviorAnalysis, 'plan');
      const trendingBoost = (plan.savesCount || 0) * 0.1 + (plan.recentViews?.length || 0) * 0.05;
      
      // Add completion rate boost for completed plans
      let completionBoost = 0;
      if (plan.status === 'completed') {
        const participantCount = plan.participantUserIds?.length || 0;
        const confirmationCount = plan.completionConfirmedBy?.length || 0;
        if (participantCount > 0) {
          const completionRate = confirmationCount / participantCount;
          completionBoost = completionRate * 0.3; // Boost plans with high completion rates
        }
      }
      
      const score = baseScore + trendingBoost + completionBoost;
      const reasons = ['Trending this week'];
      
      if (completionBoost > 0) {
        reasons.push('High completion rate');
      }
      
      reasons.push(...generateRecommendationReasons(plan, userPreferences, behaviorAnalysis, 'plan'));
      
      scoredTrendingPlans.push({
        id: plan.id,
        type: 'plan',
        score,
        reasons,
        data: plan
      });
    }
    
    return scoredTrendingPlans
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('[getTrendingPlans] Error:', error);
    return [];
  }
}

/**
 * Calculate recommendation score for content
 */
async function calculateRecommendationScore(
  content: Plan | PlanCollection,
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  type: 'plan' | 'collection'
): Promise<number> {
  let score = 0;
  
  // Base popularity score
  if ('savesCount' in content) {
    score += (content.savesCount || 0) * 0.3;
  }
  if ('recentViews' in content) {
    score += (content.recentViews?.length || 0) * 0.1;
  }
  if ('averageRating' in content) {
    score += (content.averageRating || 0) * 2;
  }
  
  // Category preference match for plans
  if (type === 'plan' && 'eventType' in content && content.eventType && userPreferences.preferredCategories?.includes(content.eventType)) {
    score += 10;
  }
  
  // Behavior pattern match for plans
  if (type === 'plan' && 'eventType' in content && content.eventType && behaviorAnalysis.preferredCategories[content.eventType]) {
    score += behaviorAnalysis.preferredCategories[content.eventType] * 2;
  }
  
  // Location preference match (for plans)
  if (type === 'plan' && (content as Plan).location) {
    const planLocation = (content as Plan).location;
    if (userPreferences.preferredLocations?.some(loc => 
      planLocation.toLowerCase().includes(loc.toLowerCase())
    )) {
      score += 8;
    }
    
    if (behaviorAnalysis.preferredLocations[planLocation]) {
      score += behaviorAnalysis.preferredLocations[planLocation] * 1.5;
    }
  }
  
  // Recency boost
  if (content.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(content.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) {
      score += (7 - daysSinceUpdate) * 0.5;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Generate reasons for recommendation
 */
function generateRecommendationReasons(
  content: Plan | PlanCollection,
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  type: 'plan' | 'collection'
): string[] {
  const reasons: string[] = [];
  
  if (type === 'plan' && 'eventType' in content && content.eventType && userPreferences.preferredCategories?.includes(content.eventType)) {
    reasons.push(`Matches your interest in ${content.eventType}`);
  }
  
  if (type === 'plan' && 'eventType' in content && content.eventType && behaviorAnalysis.preferredCategories[content.eventType]) {
    reasons.push(`Based on your search history`);
  }
  
  if (type === 'plan' && (content as Plan).location && userPreferences.preferredLocations?.some(loc => 
    (content as Plan).location.toLowerCase().includes(loc.toLowerCase())
  )) {
    reasons.push(`Located in your preferred area`);
  }
  
  if ('averageRating' in content && (content.averageRating || 0) >= 4.5) {
    reasons.push(`Highly rated (${content.averageRating?.toFixed(1)} stars)`);
  }
  
  if ('savesCount' in content && (content.savesCount || 0) > 100) {
    reasons.push(`Popular with ${content.savesCount} saves`);
  }
  
  if (content.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(content.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 3) {
      reasons.push('Recently updated');
    }
  }
  
  return reasons.slice(0, 3); // Limit to 3 reasons
}

/**
 * Find users with similar preferences
 */
async function findSimilarUsers(
  userId: string,
  userPreferences: UserPreferences,
  behaviorAnalysis: any,
  db: Firestore
): Promise<string[]> {
  try {
    // This is a simplified implementation
    // In a real system, you'd use more sophisticated similarity algorithms
    const similarUsers: string[] = [];
    
    if (userPreferences.preferredCategories?.length) {
      const usersQuery = await db
        .collection(USERS_COLLECTION)
        .where('preferences.preferredCategories', 'array-contains-any', userPreferences.preferredCategories.slice(0, 5))
        .limit(20)
        .get();
      
      usersQuery.docs.forEach(doc => {
        if (doc.id !== userId) {
          similarUsers.push(doc.id);
        }
      });
    }
    
    return similarUsers.slice(0, 10);
  } catch (error) {
    console.error('[findSimilarUsers] Error:', error);
    return [];
  }
}

/**
 * Get recommended categories based on behavior
 */
function getRecommendedCategories(
  behaviorAnalysis: any,
  userPreferences: UserPreferences
): string[] {
  const categoryScores: Record<string, number> = {};
  
  // Score based on search patterns
  Object.entries(behaviorAnalysis.preferredCategories).forEach(([category, count]) => {
    categoryScores[category] = (categoryScores[category] || 0) + (count as number) * 2;
  });
  
  // Add user preferences
  userPreferences.preferredCategories?.forEach(category => {
    categoryScores[category] = (categoryScores[category] || 0) + 5;
  });
  
  // Common categories to suggest
  const commonCategories = ['Food & Dining', 'Sightseeing', 'Entertainment', 'Shopping', 'Outdoor Activities', 'Culture & Arts', 'Nightlife', 'Sports & Recreation'];
  commonCategories.forEach(category => {
    if (!categoryScores[category]) {
      categoryScores[category] = 1;
    }
  });
  
  return Object.entries(categoryScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([category]) => category);
}

/**
 * Get recommended locations based on behavior
 */
function getRecommendedLocations(
  behaviorAnalysis: any,
  userPreferences: UserPreferences
): string[] {
  const locationScores: Record<string, number> = {};
  
  // Score based on search patterns
  Object.entries(behaviorAnalysis.preferredLocations).forEach(([location, count]) => {
    locationScores[location] = (locationScores[location] || 0) + (count as number) * 2;
  });
  
  // Add user preferences
  userPreferences.preferredLocations?.forEach(location => {
    locationScores[location] = (locationScores[location] || 0) + 5;
  });
  
  return Object.entries(locationScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([location]) => location);
}

/**
 * Get user's completed plans for behavior analysis
 */
async function getUserCompletedPlans(userId: string, db: Firestore): Promise<any[]> {
  try {
    // Get plans where user is host and plan is completed
    const hostedCompletedQuery = db.collection(PLANS_COLLECTION)
      .where('hostId', '==', userId)
      .where('status', '==', 'completed');
    
    // Get plans where user is participant and confirmed completion
    const participatedCompletedQuery = db.collection(PLANS_COLLECTION)
      .where('completionConfirmedBy', 'array-contains', userId);
    
    const [hostedSnapshot, participatedSnapshot] = await Promise.all([
      hostedCompletedQuery.get(),
      participatedCompletedQuery.get()
    ]);
    
    const completedPlans: any[] = [];
    const seenPlanIds = new Set<string>();
    
    // Add hosted completed plans
    hostedSnapshot.docs.forEach(doc => {
      if (!seenPlanIds.has(doc.id)) {
        completedPlans.push({ id: doc.id, ...doc.data() });
        seenPlanIds.add(doc.id);
      }
    });
    
    // Add participated completed plans (avoid duplicates)
    participatedSnapshot.docs.forEach(doc => {
      if (!seenPlanIds.has(doc.id)) {
        completedPlans.push({ id: doc.id, ...doc.data() });
        seenPlanIds.add(doc.id);
      }
    });
    
    return completedPlans;
  } catch (error) {
    console.error('[getUserCompletedPlans] Error:', error);
    return [];
  }
}