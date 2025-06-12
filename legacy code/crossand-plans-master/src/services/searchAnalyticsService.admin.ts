import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

export interface SearchAnalytics {
  id: string;
  searchTerm: string;
  userId?: string;
  timestamp: string;
  resultCounts: {
    people: number;
    plans: number;
    collections: number;
  };
  clickedResults: {
    type: 'person' | 'plan' | 'collection';
    id: string;
    position: number;
  }[];
  sessionId: string;
  userAgent?: string;
  location?: {
    city: string;
    country: string;
  };
}

export interface PopularSearchTerm {
  term: string;
  count: number;
  lastSearched: string;
  avgResultCounts: {
    people: number;
    plans: number;
    collections: number;
  };
}

export interface SearchTrends {
  popularTerms: PopularSearchTerm[];
  trendingTerms: PopularSearchTerm[];
  categoryTrends: Record<string, number>;
  locationTrends: Record<string, number>;
}

const SEARCH_ANALYTICS_COLLECTION = 'searchAnalytics';
const POPULAR_SEARCHES_COLLECTION = 'popularSearches';

/**
 * Log a search event for analytics
 */
export async function logSearchEvent(
  searchTerm: string,
  resultCounts: { people: number; plans: number; collections: number },
  userId?: string,
  sessionId?: string,
  userAgent?: string,
  location?: { city: string; country: string }
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[logSearchEvent] Firestore not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    const searchAnalytics: Omit<SearchAnalytics, 'id'> = {
      searchTerm: searchTerm.toLowerCase().trim(),
      userId,
      timestamp: new Date().toISOString(),
      resultCounts,
      clickedResults: [],
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAgent,
      location
    };

    await db.collection(SEARCH_ANALYTICS_COLLECTION).add(searchAnalytics);
    
    // Update popular searches aggregation
    await updatePopularSearches(searchTerm, resultCounts);
    
    return true;
  } catch (error) {
    console.error('[logSearchEvent] Error logging search event:', error);
    return false;
  }
}

/**
 * Log when a user clicks on a search result
 */
export async function logSearchResultClick(
  searchTerm: string,
  resultType: 'person' | 'plan' | 'collection',
  resultId: string,
  position: number,
  sessionId: string
): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[logSearchResultClick] Firestore not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    // Find the most recent search event for this session and term
    const recentSearchQuery = await db
      .collection(SEARCH_ANALYTICS_COLLECTION)
      .where('sessionId', '==', sessionId)
      .where('searchTerm', '==', searchTerm.toLowerCase().trim())
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (!recentSearchQuery.empty) {
      const searchDoc = recentSearchQuery.docs[0];
      const searchData = searchDoc.data() as SearchAnalytics;
      
      const updatedClickedResults = [
        ...searchData.clickedResults,
        { type: resultType, id: resultId, position }
      ];

      await searchDoc.ref.update({
        clickedResults: updatedClickedResults
      });
    }
    
    return true;
  } catch (error) {
    console.error('[logSearchResultClick] Error logging search result click:', error);
    return false;
  }
}

/**
 * Update popular searches aggregation
 */
async function updatePopularSearches(
  searchTerm: string,
  resultCounts: { people: number; plans: number; collections: number }
): Promise<void> {
  if (!firestoreAdmin) return;

  try {
    const db = firestoreAdmin as Firestore;
    const termKey = searchTerm.toLowerCase().trim();
    const popularSearchRef = db.collection(POPULAR_SEARCHES_COLLECTION).doc(termKey);
    
    const doc = await popularSearchRef.get();
    
    if (doc.exists) {
      const data = doc.data() as PopularSearchTerm;
      const newCount = data.count + 1;
      
      // Calculate running average of result counts
      const avgResultCounts = {
        people: Math.round((data.avgResultCounts.people * data.count + resultCounts.people) / newCount),
        plans: Math.round((data.avgResultCounts.plans * data.count + resultCounts.plans) / newCount),
        collections: Math.round((data.avgResultCounts.collections * data.count + resultCounts.collections) / newCount)
      };
      
      await popularSearchRef.update({
        count: newCount,
        lastSearched: new Date().toISOString(),
        avgResultCounts
      });
    } else {
      const newPopularSearch: PopularSearchTerm = {
        term: termKey,
        count: 1,
        lastSearched: new Date().toISOString(),
        avgResultCounts: resultCounts
      };
      
      await popularSearchRef.set(newPopularSearch);
    }
  } catch (error) {
    console.error('[updatePopularSearches] Error updating popular searches:', error);
  }
}

/**
 * Get search trends and popular terms
 */
export async function getSearchTrends(limit: number = 20): Promise<SearchTrends> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    // Get popular terms (by total count)
    const popularQuery = await db
      .collection(POPULAR_SEARCHES_COLLECTION)
      .orderBy('count', 'desc')
      .limit(limit)
      .get();
    
    const popularTerms: PopularSearchTerm[] = popularQuery.docs.map(doc => doc.data() as PopularSearchTerm);
    
    // Get trending terms (by recent activity)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const trendingQuery = await db
      .collection(POPULAR_SEARCHES_COLLECTION)
      .where('lastSearched', '>=', sevenDaysAgo)
      .orderBy('lastSearched', 'desc')
      .orderBy('count', 'desc')
      .limit(limit)
      .get();
    
    const trendingTerms: PopularSearchTerm[] = trendingQuery.docs.map(doc => doc.data() as PopularSearchTerm);
    
    // Analyze category and location trends from recent searches
    const recentSearchesQuery = await db
      .collection(SEARCH_ANALYTICS_COLLECTION)
      .where('timestamp', '>=', sevenDaysAgo)
      .get();
    
    const categoryTrends: Record<string, number> = {};
    const locationTrends: Record<string, number> = {};
    
    recentSearchesQuery.docs.forEach(doc => {
      const data = doc.data() as SearchAnalytics;
      
      // Simple keyword analysis for categories and locations
      const term = data.searchTerm.toLowerCase();
      
      // Common category keywords
      const categoryKeywords = ['food', 'restaurant', 'cafe', 'bar', 'museum', 'park', 'beach', 'shopping', 'nightlife', 'culture', 'art', 'music', 'sports', 'outdoor', 'adventure'];
      categoryKeywords.forEach(keyword => {
        if (term.includes(keyword)) {
          categoryTrends[keyword] = (categoryTrends[keyword] || 0) + 1;
        }
      });
      
      // Location trends from search analytics location data
      if (data.location) {
        const locationKey = `${data.location.city}, ${data.location.country}`;
        locationTrends[locationKey] = (locationTrends[locationKey] || 0) + 1;
      }
    });
    
    return {
      popularTerms,
      trendingTerms,
      categoryTrends,
      locationTrends
    };
  } catch (error) {
    console.error('[getSearchTrends] Error getting search trends:', error);
    return {
      popularTerms: [],
      trendingTerms: [],
      categoryTrends: {},
      locationTrends: {}
    };
  }
}

/**
 * Get user's search history
 */
export async function getUserSearchHistory(
  userId: string,
  limit: number = 50
): Promise<SearchAnalytics[]> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    const searchHistoryQuery = await db
      .collection(SEARCH_ANALYTICS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return searchHistoryQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SearchAnalytics));
  } catch (error) {
    console.error('[getUserSearchHistory] Error getting user search history:', error);
    return [];
  }
}

/**
 * Clear user's search history
 */
export async function clearUserSearchHistory(userId: string): Promise<boolean> {
  if (!firestoreAdmin) {
    console.error('[clearUserSearchHistory] Firestore not initialized');
    return false;
  }

  try {
    const db = firestoreAdmin as Firestore;
    
    const searchHistoryQuery = await db
      .collection(SEARCH_ANALYTICS_COLLECTION)
      .where('userId', '==', userId)
      .get();
    
    const batch = db.batch();
    searchHistoryQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('[clearUserSearchHistory] Error clearing user search history:', error);
    return false;
  }
}