import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, getQueryParams } from '@/lib/api/middleware';

export const GET = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    // Get query parameters with validation
    const { params, error } = getQueryParams(request, {
      userId: { required: false },
      page: { required: false, defaultValue: '1' },
      limit: { required: false, defaultValue: '20' }
    });
    if (error) return error;

    const targetUserId = params.userId || authResult.userId;
    const page = parseInt(params.page!) || 1;
    const limit = Math.min(parseInt(params.limit!) || 20, 50); // Cap at 50

    // Get following for the target user
    const followingRef = db!.collection('following').doc(targetUserId);
    const followingDoc = await followingRef.get();

    if (!followingDoc.exists) {
      return NextResponse.json({
        following: [],
        pagination: {
          page,
          limit,
          totalFollowing: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const followingData = followingDoc.data();
    const followingIds = followingData?.users || [];
    const totalFollowing = followingIds.length;
    const totalPages = Math.ceil(totalFollowing / limit);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedFollowingIds = followingIds.slice(startIndex, startIndex + limit);

    // Get following user profiles
    const following: any[] = [];
    if (paginatedFollowingIds.length > 0) {
      const followingProfiles = await Promise.all(
        paginatedFollowingIds.map((followingId: string) =>
          db!.collection('users').doc(followingId).get()
        )
      );

      followingProfiles.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          following.push({
            id: doc.id,
            firstName: data?.firstName || '',
            lastName: data?.lastName || '',
            email: data?.email || '',
            avatar: data?.avatar || '',
            isVerified: data?.isVerified || false,
            followerCount: data?.followerCount || 0,
            followingCount: data?.followingCount || 0,
            planCount: data?.planCount || 0
          });
        }
      });
    }

    return NextResponse.json({
      following,
      pagination: {
        page,
        limit,
        totalFollowing,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  },
  { defaultError: 'Failed to fetch following' }
);