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

    // Get followers for the target user
    const followersRef = db!.collection('followers').doc(targetUserId);
    const followersDoc = await followersRef.get();

    if (!followersDoc.exists) {
      return NextResponse.json({
        followers: [],
        pagination: {
          page,
          limit,
          totalFollowers: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    const followersData = followersDoc.data();
    const followerIds = followersData?.users || [];
    const totalFollowers = followerIds.length;
    const totalPages = Math.ceil(totalFollowers / limit);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedFollowerIds = followerIds.slice(startIndex, startIndex + limit);

    // Get follower user profiles
    const followers: any[] = [];
    if (paginatedFollowerIds.length > 0) {
      const followerProfiles = await Promise.all(
        paginatedFollowerIds.map((followerId: string) =>
          db!.collection('users').doc(followerId).get()
        )
      );

      followerProfiles.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          followers.push({
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
      followers,
      pagination: {
        page,
        limit,
        totalFollowers,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  },
  { defaultError: 'Failed to fetch followers' }
);