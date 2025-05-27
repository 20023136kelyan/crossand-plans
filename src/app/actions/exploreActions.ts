// src/app/actions/exploreActions.ts
'use server';

import { getCompletedPlansAdmin } from '@/services/planService.server';
import { 
  getFeaturedCreatorsAdmin, 
  getFeaturedPlanCollectionsAdmin 
} from '@/services/exploreService.server';
import type { Plan, Influencer, PlanCollection, Profile, Category, City, UserPreferences, GeoPoint } from '@/types/user';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { FieldValue, Firestore, type DocumentData, type QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { calculateEnhancedPlanScore } from '@/lib/utils/enhancedRanking';

// Helper function to serialize timestamps
function serializeTimestamps<T extends Record<string, any>>(obj: T): T {
  const newObj = { ...obj };
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Timestamp) {
      (newObj as any)[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object') {
      (newObj as any)[key] = serializeTimestamps(value);
    }
  }
  return newObj;
}

const EXPLORE_PAGE_ITEM_LIMIT = 10;
const PAGINATION_PAGE_SIZE_INTERNAL = 12;

const COLLECTIONS = {
  FEATURED_PROFILES: 'featuredProfiles',
  CATEGORIES: 'categories',
  FEATURED_CITIES: 'featuredCities',
  PLANS: 'plans',
  USERS: 'users'
};

interface ExplorePageData {
  featuredProfiles: Profile[];
  completedPlans: Plan[];
  featuredCities: City[];
  categories: Category[];
}

interface LocationData {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface RankedPlan extends Plan {
  score: number;
}

async function rankPlans(plans: Plan[], userLocation?: LocationData): Promise<Plan[]> {
  const now = new Date();
  
  const rankedPlans = plans.map(plan => {
    let score = 0;
    
    // Featured plans get highest priority (1000 point boost)
    if (plan.featured) {
      score += 1000;
    }
    
    // Base score from ratings (40% weight)
    score += (plan.rating || 0) * 10;
    
    // Popularity score (30% weight total)
    // - Likes: 5% weight
    // - Shares: 10% weight (shares indicate stronger endorsement)
    // - Saves: 15% weight (saves indicate strongest interest/intent)
    score += (plan.likesCount || 0) * 0.5;  // 0.5 points per like
    score += (plan.sharesCount || 0) * 1.0; // 1.0 points per share
    score += (plan.savesCount || 0) * 1.5;  // 1.5 points per save
    
    // Location relevance (20% weight)
    if (userLocation?.city && plan.city) {
      if (plan.city.toLowerCase() === userLocation.city.toLowerCase()) {
        score += 50; // High boost for same city
      }
    }
    
    // Time relevance (10% weight - favor upcoming plans but not too far in future)
    const planDate = new Date(plan.eventTime);
    const daysUntilEvent = (planDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilEvent > 0 && daysUntilEvent < 30) {
      score += 30 - daysUntilEvent; // Higher score for closer events
    }
    
    return { ...plan, score };
  }) as RankedPlan[];
  
  // Sort by composite score
  return rankedPlans
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...plan }) => plan);
}

export type ExploreActionResult = {
  success: boolean;
  data?: ExplorePageData;
  error?: string;
};

async function getFeaturedProfiles(): Promise<Profile[]> {
  if (!firestoreAdmin) return [];
  const snapshot = await (firestoreAdmin as Firestore).collection(COLLECTIONS.FEATURED_PROFILES).get();
  return snapshot.docs.map(doc => serializeTimestamps({ id: doc.id, ...doc.data() }) as Profile);
}

async function getCategories(): Promise<Category[]> {
  if (!firestoreAdmin) return [];
  try {
    const plansRef = (firestoreAdmin as Firestore).collection(COLLECTIONS.PLANS).where('status', '==', 'published');
    const snapshot = await plansRef.get();
    
    const uniqueCategories = new Set<string>();
    snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      if (data.eventType) {
        uniqueCategories.add(data.eventType.toUpperCase());
      }
    });
    
    const defaultCategories = ['ALL', 'ART', 'FITNESS'];
    defaultCategories.forEach(cat => uniqueCategories.add(cat));
    
    return Array.from(uniqueCategories).sort().map(name => ({ name } as Category));
  } catch (error) {
    console.error('[getCategories] Error:', error);
    return [{ name: 'ALL' }, { name: 'ART' }, { name: 'FITNESS' }];
  }
}

interface CityWithCount extends Omit<City, 'imageUrl'> {
  count: number;
  imageUrl?: string;
}

async function getFeaturedCities(): Promise<City[]> {
  if (!firestoreAdmin) return [];
  try {
    const plansRef = (firestoreAdmin as Firestore).collection(COLLECTIONS.PLANS).where('status', '==', 'published');
    const snapshot = await plansRef.get();
    
    const cityCounts = new Map<string, number>();
    snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      if (data.city) {
        const cityName = data.city.trim();
        cityCounts.set(cityName, (cityCounts.get(cityName) || 0) + 1);
      }
    });
    
    const sortedCities = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]): CityWithCount => ({
        name,
        count,
        date: new Date().toISOString(),
        location: name
      }));
    
    return sortedCities;
  } catch (error) {
    console.error('[getFeaturedCities] Error:', error);
    return [];
  }
}

export const fetchExplorePageDataAction = async (
  userLocation?: { city: string; country: string; coordinates?: GeoPoint },
  isPremiumUser: boolean = false,
  activityScore: number = 0,
  userPreferences?: UserPreferences | null
): Promise<ExploreActionResult> => {
  if (!firestoreAdmin) {
    return { success: false, error: 'Admin SDK not initialized' };
  }

  try {
    // First fetch featured plans
    const featuredPlansSnapshot = await firestoreAdmin
      .collection(COLLECTIONS.PLANS)
      .where('status', '==', 'published')
      .where('featured', '==', true)
      .get();

    // Then fetch regular plans
    const regularPlansSnapshot = await firestoreAdmin
      .collection(COLLECTIONS.PLANS)
      .where('status', '==', 'published')
      .where('featured', '==', false)
      .get();

    // Fetch other data in parallel
    const [profiles, categories, cities] = await Promise.all([
      getFeaturedProfiles(),
      getCategories(),
      getFeaturedCities(),
    ]);

    // Combine and process all plans
    const allPlans = [
      ...featuredPlansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        featured: true
      })),
      ...regularPlansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        featured: false
      }))
    ];

    // Convert Firestore documents to Plans with serialized timestamps
    let plans = allPlans.map(data => serializeTimestamps(data) as Plan);

    // Filter by location if provided
    if (userLocation?.city) {
      plans = plans.filter(plan => {
        const isLocalPlan = plan.city?.toLowerCase() === userLocation.city?.toLowerCase();
        return isLocalPlan || isPremiumUser;
      });
    }

    // Filter premium-only plans
    plans = plans.filter(plan => {
      if (plan.isPremiumOnly && !isPremiumUser) return false;
      if (plan.minimumActivityScore && activityScore < plan.minimumActivityScore) return false;
      return true;
    });

    // Calculate scores and sort plans
    const scoredPlans = plans.map(plan => ({
      ...plan,
      score: calculateEnhancedPlanScore(
        plan,
        userLocation?.coordinates || null,
        userPreferences || undefined
      )
    }));

    // Sort by score
    scoredPlans.sort((a, b) => b.score - a.score);

    // Remove score property before returning
    plans = scoredPlans.map(({ score, ...plan }) => plan);

    // Serialize timestamps in all data
    const serializedData = {
      featuredProfiles: profiles.map(profile => serializeTimestamps(profile)),
      completedPlans: plans,
      featuredCities: cities.map(city => serializeTimestamps(city)),
      categories
    };

    return {
      success: true,
      data: serializedData
    };
  } catch (error) {
    console.error('Error fetching explore data:', error);
    return {
      success: false,
      error: 'Failed to fetch explore data'
    };
  }
};

export async function fetchAllFeaturedCreatorsAction(lastVisibleName?: string): Promise<{ 
  success: boolean; 
  creators?: Influencer[]; 
  error?: string;
  hasMore?: boolean;
  newLastVisibleName?: string;
}> {
  try {
    const { creators, hasMore, newLastVisibleName: nextCursor } = await getFeaturedCreatorsAdmin(PAGINATION_PAGE_SIZE_INTERNAL, lastVisibleName);
    return { success: true, creators, hasMore, newLastVisibleName: nextCursor };
  } catch (error: any) {
    console.error("[fetchAllFeaturedCreatorsAction] Error fetching creators:", error);
    return { success: false, error: error.message || "Failed to load creators." };
  }
}

export async function fetchAllPlanCollectionsAction(lastVisibleTitle?: string): Promise<{ 
  success: boolean; 
  collections?: PlanCollection[]; 
  error?: string;
  hasMore?: boolean;
  newLastVisibleTitle?: string;
}> {
  try {
    const { collections, hasMore, newLastVisibleTitle: nextCursor } = await getFeaturedPlanCollectionsAdmin(PAGINATION_PAGE_SIZE_INTERNAL, lastVisibleTitle);
    return { success: true, collections, hasMore, newLastVisibleTitle: nextCursor };
  } catch (error: any) {
    console.error("[fetchAllPlanCollectionsAction] Error fetching collections:", error);
    return { success: false, error: error.message || "Failed to load collections." };
  }
}

// Admin Actions
export async function addFeaturedProfile(profile: Omit<Profile, 'id'>): Promise<{ success: boolean; error?: string }> {
  if (!firestoreAdmin) return { success: false, error: 'Admin SDK not initialized' };
  try {
    await (firestoreAdmin as Firestore).collection(COLLECTIONS.FEATURED_PROFILES).add({
      ...profile,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('[addFeaturedProfile] Error:', error);
    return { success: false, error: 'Failed to add featured profile' };
  }
}

export async function addCategory(name: string): Promise<{ success: boolean; error?: string }> {
  if (!firestoreAdmin) return { success: false, error: 'Admin SDK not initialized' };
  try {
    await (firestoreAdmin as Firestore).collection(COLLECTIONS.CATEGORIES).add({
      name,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('[addCategory] Error:', error);
    return { success: false, error: 'Failed to add category' };
  }
}

export async function addFeaturedCity(city: Omit<City, 'id'>): Promise<{ success: boolean; error?: string }> {
  if (!firestoreAdmin) return { success: false, error: 'Admin SDK not initialized' };
  try {
    await (firestoreAdmin as Firestore).collection(COLLECTIONS.FEATURED_CITIES).add({
      ...city,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('[addFeaturedCity] Error:', error);
    return { success: false, error: 'Failed to add featured city' };
  }
}
