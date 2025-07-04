import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { PlanCollection, PlanCollectionType } from '@/types/user';
import { createAdminHandler, parseRequestBody } from '@/lib/api/middleware';

// GET /api/admin/content/collections - Get all collections
export const GET = createAdminHandler(
  async ({ request, authResult }) => {
    const collectionsSnapshot = await firestoreAdmin!
      .collection('planCollections')
      .orderBy('createdAt', 'desc')
      .get();

    const collections: PlanCollection[] = [];
    collectionsSnapshot.forEach(doc => {
      const data = doc.data();
      collections.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        planIds: data.planIds || [],
        coverImageUrl: data.coverImageUrl,
        type: data.type as PlanCollectionType,
        curatorName: data.curatorName,
        tags: data.tags || [],
        isFeatured: data.isFeatured || false,
        isDefault: data.isDefault || false,
        navigationCard: data.navigationCard || false,
        icon: data.icon,
        href: data.href,
        sortOrder: data.sortOrder,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    return NextResponse.json({ collections });
  },
  { defaultError: 'Failed to fetch collections' }
);

// POST /api/admin/content/collections - Create new collection
export const POST = createAdminHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const {
      title,
      description,
      type,
      curatorName,
      tags,
      isFeatured,
      coverImageUrl,
      planIds,
      isDefault,
      navigationCard,
      icon,
      href,
      sortOrder
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Validate plan IDs exist
    if (planIds && planIds.length > 0) {
      const planPromises = planIds.map((planId: string) => 
        firestoreAdmin!.collection('plans').doc(planId).get()
      );
      const planDocs = await Promise.all(planPromises);
      const invalidPlanIds = planIds.filter((planId: string, index: number) => 
        !planDocs[index].exists
      );
      
      if (invalidPlanIds.length > 0) {
        return NextResponse.json(
          { error: `Invalid plan IDs: ${invalidPlanIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const collectionData = {
      title: title.trim(),
      description: description?.trim() || '',
      type: type || 'curated_by_team',
      curatorName: curatorName || 'Crossand Team',
      tags: tags || [],
      isFeatured: isFeatured || false,
      coverImageUrl: coverImageUrl || '',
      planIds: planIds || [],
      isDefault: isDefault || false,
      navigationCard: navigationCard || false,
      icon: icon || '',
      href: href || '',
      sortOrder: sortOrder || 0,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.userId
    };

    const docRef = await firestoreAdmin!.collection('planCollections').add(collectionData);

    return NextResponse.json({
      success: true,
      collectionId: docRef.id,
      message: 'Collection created successfully'
    });
  },
  { defaultError: 'Failed to create collection' }
);