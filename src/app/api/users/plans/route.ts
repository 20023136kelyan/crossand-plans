import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db, authAdmin } from '@/lib/firebaseAdmin';
import { createPublicHandler, getQueryParams } from '@/lib/api/middleware';

export const GET = createPublicHandler(
  async ({ request }) => {
    // Get authentication token if available
    const authHeader = request.headers.get('authorization');
    let authResult = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin!.verifyIdToken(token);
        authResult = {
          userId: decodedToken.uid,
          decodedToken
        };
      } catch (error) {
        // Continue without authentication
        console.log('[Plans API] Invalid token, proceeding as unauthenticated');
      }
    }
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

    const targetUserId = params.userId || authResult?.userId;
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const status = params.status;
    const category = params.category;
    const page = parseInt(params.page!) || 1;
    const limit = Math.min(parseInt(params.limit!) || 20, 50); // Cap at 50
    const sortBy = params.sortBy!;
    const sortOrder = params.sortOrder! as 'asc' | 'desc';

    // Check privacy (if viewing another user's plans)
    const isOwnProfile = authResult && targetUserId === authResult.userId;
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
        // Check if current user follows target user by looking at current user's following array
        const currentUserRef = db!.collection('users').doc(authResult!.userId);
        const currentUserDoc = await currentUserRef.get();
        
        if (!currentUserDoc.exists) {
          return NextResponse.json(
            { error: 'Current user profile not found' },
            { status: 404 }
          );
        }
        
        const currentUserData = currentUserDoc.data();
        const isFollowing = (currentUserData?.following || []).includes(targetUserId);
        
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
      .where('hostId', '==', targetUserId);

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
        name: data.name || data.title,
        description: data.description,
        category: data.category,
        eventType: data.eventType,
        location: data.location,
        eventTime: data.eventTime,
        city: data.city,
        priceRange: data.priceRange,
        status: data.status,
        planType: data.planType,
        hostId: data.hostId,
        hostName: data.hostName,
        hostAvatarUrl: data.hostAvatarUrl,
        invitedParticipantUserIds: data.invitedParticipantUserIds || [],
        participantResponses: data.participantResponses || {},
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
        likesCount: data.likesCount || 0,
        commentsCount: data.commentsCount || 0,
        sharesCount: data.sharesCount || 0
      });
    });

    // Get total count for pagination
    const totalSnapshot = await db!
      .collection('plans')
      .where('hostId', '==', targetUserId)
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