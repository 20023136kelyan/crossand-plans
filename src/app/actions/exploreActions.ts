
// src/app/actions/exploreActions.ts
'use server';

import { getAllPublishedPlansAdmin } from '@/services/planService.server';
import { 
  getFeaturedCreatorsAdmin, 
  getFeaturedPlanCollectionsAdmin 
} from '@/services/exploreService.server';
import type { Plan, Influencer, PlanCollection } from '@/types/user';

const EXPLORE_PAGE_ITEM_LIMIT = 10;
// Removed PAGINATION_PAGE_SIZE export from here.
// It will be defined locally in client components that use it for UI logic,
// or server actions will use their own internal page size for fetching.
const PAGINATION_PAGE_SIZE_INTERNAL = 12; // Internal constant for actions

interface ExplorePageData {
  featuredCreators: Influencer[];
  featuredCollections: PlanCollection[];
  uniqueCategories: string[];
  uniqueCities: string[];
}

export async function fetchExplorePageDataAction(): Promise<{ success: boolean; data?: ExplorePageData; error?: string }> {
  try {
    const [
      publishedPlansResult, // Assuming getAllPublishedPlansAdmin might also return a structured object
      creatorsResult,
      collectionsResult
    ] = await Promise.all([
      getAllPublishedPlansAdmin(), // This directly returns Plan[]
      getFeaturedCreatorsAdmin(EXPLORE_PAGE_ITEM_LIMIT), 
      getFeaturedPlanCollectionsAdmin(EXPLORE_PAGE_ITEM_LIMIT) 
    ]);

    // Assuming getAllPublishedPlansAdmin directly returns Plan[]
    const publishedPlans = publishedPlansResult;

    const categorySet = new Set<string>();
    const citySet = new Set<string>();
    publishedPlans.forEach(plan => {
      if (plan.eventType) categorySet.add(plan.eventType);
      if (plan.city) citySet.add(plan.city);
    });

    const uniqueCategories = Array.from(categorySet).sort();
    const uniqueCities = Array.from(citySet).sort();

    return {
      success: true,
      data: {
        featuredCreators: creatorsResult.creators,
        featuredCollections: collectionsResult.collections,
        uniqueCategories,
        uniqueCities,
      }
    };
  } catch (error: any) {
    console.error("[fetchExplorePageDataAction] Error fetching explore page data:", error);
    return { success: false, error: error.message || "Failed to load explore page data." };
  }
}

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
