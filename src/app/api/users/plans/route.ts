import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, getQueryParams } from '@/lib/api/middleware';

export const GET = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    // Get query parameters with validation
    const { params, error } = getQueryParams(request, {
      userId: { required: false },
      status: { required: false },
      category: { required: false },
      page: { required: false, defaultValue: '1' },
      limit: { required: false, defaultValue: '20' },
      sortBy: { required: false, defaultValue: 'createdAt' },
      sortOrder: { required: false, defaultValue: 'desc' }
    });
    if (error) return error;

    const targetUserId = params.userId || authResult.userId;
    const status = params.status;
    const category = params.category;
    const page = parseInt(params.page!) || 1;
    const limit = Math.min(parseInt(params.limit!) || 20, 50); // Cap at 50
    const sortBy = params.sortBy!;
    const sortOrder = params.sortOrder! as 'asc' | 'desc';

    // Check privacy (if viewing another user's plans)
    const isOwnProfile = targetUserId === authResult.userId;
    if (!isOwnProfile) {
      // Check if the target user's profile is public or if current user follows them
      const targetUserRef = db!.collection('users').doc(targetUserId);
      const targetUserDoc = await targetUserRef.get();
      
      if (!targetUserDoc.exists) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const targetUserData = targetUserDoc.data();
      const isPublicProfile = targetUserData?.profileVisibility === 'public';
      
      if (!isPublicProfile) {
        // Check if current user follows target user
        const followingRef = db!.collection('following').doc(authResult.userId);
        const followingDoc = await followingRef.get();
        const isFollowing = followingDoc.exists && 
                           followingDoc.data()?.users?.includes(targetUserId);
        
        if (!isFollowing) {
          return NextResponse.json(
            { error: 'Access denied to private profile' },
            { status: 403 }
          );
        }
      }
    }

    // Build query for user's plans
    let query: any = db!.collection('plans')
      .where('userId', '==', targetUserId);

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }
    if (category) {
      query = query.where('category', '==', category);
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const plansSnapshot = await query.limit(limit).get();

    const plans: any[] = [];
    plansSnapshot.forEach((doc: any) => {
      const data = doc.data();
      plans.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        category: data.category,
        eventType: data.eventType,
        location: data.location,
        date: data.date,
        time: data.time,
        duration: data.duration,
        maxParticipants: data.maxParticipants,
        currentParticipants: data.currentParticipants || 0,
        price: data.price || 0,
        currency: data.currency || 'USD',
        status: data.status,
        visibility: data.visibility,
        tags: data.tags || [],
        images: data.images || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        likesCount: data.likesCount || 0,
        commentsCount: data.commentsCount || 0,
        sharesCount: data.sharesCount || 0
      });
    });

    // Get total count for pagination
    const totalSnapshot = await db!
      .collection('plans')
      .where('userId', '==', targetUserId)
      .get();
    const totalPlans = totalSnapshot.size;
    const totalPages = Math.ceil(totalPlans / limit);

    return NextResponse.json({
      plans,
      pagination: {
        page,
        limit,
        totalPlans,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        status,
        category,
        sortBy,
        sortOrder
      }
    });
  },
  { defaultError: 'Failed to fetch user plans' }
);