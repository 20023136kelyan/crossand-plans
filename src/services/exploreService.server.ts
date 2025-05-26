// src/services/exploreService.server.ts
'use server';

import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Influencer, PlanCollection, UserProfile, UserRoleType, AppTimestamp } from '@/types/user';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

const PLAN_COLLECTIONS = 'planCollections';
const USERS_COLLECTION = 'users';

const convertAdminCollectionTimestampsToISO = (data: any): Pick<PlanCollection, 'createdAt' | 'updatedAt'> => {
  const convert = (ts: any): string => { // Changed: ensure it always returns a string or handle undefined elsewhere
    if (!ts) return new Date(0).toISOString(); // Fallback for required fields
    if (ts instanceof AdminTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (typeof ts === 'string') {
      try {
        const parsed = new Date(ts);
        if (!isNaN(parsed.getTime())) return ts;
      } catch (e) { /* ignore */ }
    }
    console.warn(`[convertAdminCollectionTimestampsToISO] Unexpected collection timestamp type: ${typeof ts}, value: ${JSON.stringify(ts)}. Returning epoch.`);
    return new Date(0).toISOString();
  };
  return {
    createdAt: convert(data.createdAt),
    updatedAt: convert(data.updatedAt),
  };
};

export const getFeaturedCreatorsAdmin = async (
  limit?: number, 
  lastVisibleName?: string
): Promise<{ creators: Influencer[], hasMore: boolean, newLastVisibleName?: string }> => {
  if (!firestoreAdmin) {
    console.error("[getFeaturedCreatorsAdmin] Firestore Admin SDK is not initialized.");
    return { creators: [], hasMore: false };
  }
  try {
    const creatorsMap = new Map<string, Influencer>();
    const pageSize = limit || 10; // Default page size if limit is for "featured" display
    const fetchLimit = pageSize + 1; // Fetch one extra to check if there's more

    // Query for influencers
    let influencerQuery = firestoreAdmin
      .collection(USERS_COLLECTION)
      .where('role', '==', 'influencer' as UserRoleType)
      .where('isVerified', '==', true)
      .orderBy('name', 'asc');
    if (lastVisibleName) {
      influencerQuery = influencerQuery.startAfter(lastVisibleName);
    }
    const influencerSnapshot = await influencerQuery.limit(fetchLimit).get();
    
    influencerSnapshot.forEach(doc => {
      if (!creatorsMap.has(doc.id)) {
        const data = doc.data() as UserProfile;
        creatorsMap.set(doc.id, {
          id: doc.id,
          name: data.name || 'Macaroom Creator',
          avatarUrl: data.avatarUrl,
          bio: data.bio || data.generalPreferences || 'Featured Creator',
          dataAiHint: data.name ? data.name.split(' ')[0].toLowerCase() : 'creator profile',
          role: data.role || 'user',
          isVerified: data.isVerified || false,
        });
      }
    });

    // Query for admins (if still needed for this "featured" list, or adjust logic)
    let adminUserQuery = firestoreAdmin
      .collection(USERS_COLLECTION)
      .where('role', '==', 'admin' as UserRoleType)
      .where('isVerified', '==', true)
      .orderBy('name', 'asc');
    // Note: Paginating admins separately and merging might be complex if you want overall pagination
    // For now, if limit is small, this might fetch enough. If paginating "all" admins, this needs thought.
    if (lastVisibleName && creatorsMap.size < fetchLimit) { // Only paginate admins if influencers didn't fill the page
        // This simple startAfter might not be perfect if names overlap significantly between roles.
        // A more robust pagination here would involve a combined query or more complex merging.
        adminUserQuery = adminUserQuery.startAfter(lastVisibleName);
    }
    const adminSnapshot = await adminUserQuery.limit(fetchLimit - creatorsMap.size > 0 ? fetchLimit - creatorsMap.size : 0).get();
    
    adminSnapshot.forEach(doc => {
      if (!creatorsMap.has(doc.id) && creatorsMap.size < fetchLimit) {
        const data = doc.data() as UserProfile;
        creatorsMap.set(doc.id, {
          id: doc.id,
          name: data.name || 'Macaroom Admin',
          avatarUrl: data.avatarUrl,
          bio: data.bio || data.generalPreferences || 'Admin Account',
          dataAiHint: data.name ? data.name.split(' ')[0].toLowerCase() : 'admin profile',
          role: data.role || 'admin',
          isVerified: data.isVerified || false,
        });
      }
    });
    
    let creators = Array.from(creatorsMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    const hasMore = creators.length === fetchLimit;
    if (hasMore) {
      creators.pop(); // Remove the extra item
    }
    
    const newLastVisibleName = creators.length > 0 ? creators[creators.length - 1].name : undefined;

    return { creators, hasMore, newLastVisibleName };

  } catch (error) {
    console.error("[getFeaturedCreatorsAdmin] Error fetching featured creators:", error);
    return { creators: [], hasMore: false };
  }
};

export const getFeaturedPlanCollectionsAdmin = async (
  limit?: number,
  lastVisibleTitle?: string
): Promise<{ collections: PlanCollection[], hasMore: boolean, newLastVisibleTitle?: string }> => {
  if (!firestoreAdmin) {
    console.error("[getFeaturedPlanCollectionsAdmin] Firestore Admin SDK is not initialized.");
    return { collections: [], hasMore: false };
  }
  try {
    const pageSize = limit || 10;
    const fetchLimit = pageSize + 1;

    let query = firestoreAdmin.collection(PLAN_COLLECTIONS)
      .where('isFeatured', '==', true)
      .orderBy('title', 'asc');
    
    if (lastVisibleTitle) {
      query = query.startAfter(lastVisibleTitle);
    }
    
    const collectionsSnapshot = await query.limit(fetchLimit).get();
    
    const collections: PlanCollection[] = [];
    collectionsSnapshot.forEach(doc => {
      const data = doc.data();
      const timestamps = convertAdminCollectionTimestampsToISO(data);
      collections.push({
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
    });

    const hasMore = collections.length === fetchLimit;
    if (hasMore) {
      collections.pop(); // Remove the extra item
    }

    const newLastVisibleTitle = collections.length > 0 ? collections[collections.length - 1].title : undefined;

    return { collections, hasMore, newLastVisibleTitle };

  } catch (error) {
    console.error("[getFeaturedPlanCollectionsAdmin] Error fetching collections:", error);
    return { collections: [], hasMore: false };
  }
};


export const getCollectionByIdAdmin = async (collectionId: string): Promise<PlanCollection | null> => {
  if (!firestoreAdmin) {
    console.error("[getCollectionByIdAdmin] Firestore Admin SDK is not initialized.");
    return null;
  }
  try {
    const collectionDoc = await firestoreAdmin.collection(PLAN_COLLECTIONS).doc(collectionId).get();
    if (!collectionDoc.exists) {
      return null;
    }
    const data = collectionDoc.data();
    if (!data) return null;
    const timestamps = convertAdminCollectionTimestampsToISO(data);

    return {
      id: collectionDoc.id,
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
    } as PlanCollection;
  } catch (error) {
    console.error(`[getCollectionByIdAdmin] Error fetching collection ${collectionId}:`, error);
    return null;
  }
};
