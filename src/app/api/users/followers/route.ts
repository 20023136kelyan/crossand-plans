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

    // Get followers for the target user from their profile
    const userProfileRef = db!.collection('users').doc(targetUserId);
    const userProfileDoc = await userProfileRef.get();

    if (!userProfileDoc.exists) {
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

    const userProfileData = userProfileDoc.data();
    const followerIds = userProfileData?.followers || [];
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
            uid: doc.id,
            name: data?.name || null,
            username: data?.username || null,
            email: data?.email || null,
            avatarUrl: data?.avatarUrl || null,
            role: data?.role || null,
            isVerified: data?.isVerified || false,
            bio: data?.bio || null
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