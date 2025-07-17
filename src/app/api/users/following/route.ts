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

    // Get following for the target user from their profile
    const userProfileRef = db!.collection('users').doc(targetUserId);
    const userProfileDoc = await userProfileRef.get();

    if (!userProfileDoc.exists) {
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

    const userProfileData = userProfileDoc.data();
    const followingIds = userProfileData?.following || [];
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