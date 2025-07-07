// src/app/actions/exploreActions.ts
'use server';

import { getCompletedPlansAdmin } from '@/services/planService.server';
import { 
  getFeaturedCreatorsAdmin, 
  getFeaturedPlanCollectionsAdmin,
  getNavigationCollectionsAdmin
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
  navigationCollections: PlanCollection[];
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

// Note: This function is deprecated in favor of calculateEnhancedPlanScore
// Keeping for backward compatibility but should not be used for new implementations
async function rankPlans(plans: Plan[], userLocation?: LocationData): Promise<Plan[]> {
  // Use the enhanced ranking system instead
  const userLocationGeoPoint = userLocation?.latitude && userLocation?.longitude 
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
    : null;
    
  const scoredPlans = plans.map(plan => ({
    ...plan,
    score: calculateEnhancedPlanScore(
      plan,
      userLocationGeoPoint,
      undefined, // userPreferences - not available in this context
      undefined  // userHistory - not available in this context
    )
  })) as RankedPlan[];
  
  // Sort by enhanced score
  return scoredPlans
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
    const plansRef = (firestoreAdmin as Firestore).collection(COLLECTIONS.PLANS).where('isTemplate', '==', true);
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
    const plansRef = (firestoreAdmin as Firestore).collection(COLLECTIONS.PLANS).where('isTemplate', '==', true);
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
        id: name,
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
    // First fetch featured template plans
    const featuredPlansSnapshot = await firestoreAdmin
      .collection(COLLECTIONS.PLANS)
      .where('isTemplate', '==', true)
      .where('featured', '==', true)
      .get();

    // Then fetch regular template plans
    const regularPlansSnapshot = await firestoreAdmin
      .collection(COLLECTIONS.PLANS)
      .where('isTemplate', '==', true)
      .where('featured', '==', false)
      .get();

    // Fetch other data in parallel
    const [profiles, categories, cities, navigationCollections] = await Promise.all([
      getFeaturedProfiles(),
      getCategories(),
      getFeaturedCities(),
      getNavigationCollectionsAdmin(),
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
      categories,
      navigationCollections: navigationCollections.map(collection => serializeTimestamps(collection))
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

export async function searchCollectionsAction(searchTerm: string): Promise<{
  success: boolean;
  collections?: PlanCollection[];
  error?: string;
}> {
  if (!firestoreAdmin) {
    return { success: false, error: 'Admin SDK not initialized' };
  }
  
  try {
    if (!searchTerm.trim()) {
      return { success: true, collections: [] };
    }

    const searchTermLower = searchTerm.toLowerCase();
    
    // Search in planCollections
    const collectionsSnapshot = await (firestoreAdmin as Firestore)
      .collection('planCollections')
      .where('isFeatured', '==', true)
      .limit(20)
      .get();

    const matchingCollections: PlanCollection[] = [];
    
    collectionsSnapshot.forEach(doc => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const curatorName = (data.curatorName || '').toLowerCase();
      const tags = (data.tags || []).map((tag: string) => tag.toLowerCase());
      
      // Check if search term matches title, description, curator name, or tags
      if (title.includes(searchTermLower) || 
          description.includes(searchTermLower) ||
          curatorName.includes(searchTermLower) ||
          tags.some((tag: string) => tag.includes(searchTermLower))) {
        
        const timestamps = {
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
        };
        
        matchingCollections.push({
          id: doc.id,
          title: data.title || "Untitled Collection",
          description: data.description || "",
          curatorName: data.curatorName || "Macaroom Team",
          curatorAvatarUrl: data.curatorAvatarUrl || null,
          planIds: data.planIds || [],
          coverImageUrl: data.coverImageUrl || null,
          dataAiHint: data.dataAiHint || data.title?.toLowerCase() || "collection",
          type: data.type || 'curated_by_team',
          tags: data.tags || [],
          isFeatured: data.isFeatured || false,
          createdAt: timestamps.createdAt,
          updatedAt: timestamps.updatedAt,
        } as PlanCollection);
      }
    });

    // Sort by relevance (exact title matches first, then by title alphabetically)
    matchingCollections.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      
      const aExactMatch = aTitle === searchTermLower;
      const bExactMatch = bTitle === searchTermLower;
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      const aStartsWith = aTitle.startsWith(searchTermLower);
      const bStartsWith = bTitle.startsWith(searchTermLower);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return aTitle.localeCompare(bTitle);
    });

    return { success: true, collections: matchingCollections };
  } catch (error: any) {
    console.error('[searchCollectionsAction] Error searching collections:', error);
    return { success: false, error: error.message || 'Failed to search collections' };
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
